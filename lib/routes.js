'use strict';

const {
  db, withTx, actorFrom, logEvent, nextProjectCode, now, s,
} = require('./db');
const {
  FR_DELIVERABLES, PRD_EXTRA_DELIVERABLES, BUFFER_CHECKS, GATES_ALL, DELIV_STATUS, RISK_KINDS,
  ApiError, int, bool01, oneOf, getProject, assertStateConsistent, gateGaps,
  validateProjectInput, procurementInfo, validateDateField,
} = require('./domain');
const {
  ROLES, ensureAuth, requireRole, createSession, deleteSession,
  sessionFromRequest, setSessionCookie, clearSessionCookie, verifyPassword,
  cleanupExpiredSessions,
} = require('./auth');

const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 28800); // 8 hours
const COOKIE_SECURE = (process.env.COOKIE_SECURE || 'false').toLowerCase() === 'true';

function buildRoutes() {
  const routes = [];
  function route(method, pattern, handler) {
    const names = [];
    const rx = new RegExp('^' + pattern.replace(/:[a-zA-Z_]+/g, m => { names.push(m.slice(1)); return '([^/]+)'; }) + '$');
    routes.push({ method, rx, names, handler });
  }

  // Auth endpoints
  route('POST', '/api/auth/login', (m, q, body, req) => {
    const username = s(body.username, 100);
    const password = String(body.password || '');
    if (!username || !password) throw new ApiError(401, 'Kredensial tidak valid');
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
    if (!user) throw new ApiError(401, 'Kredensial tidak valid');
    const ok = verifyPassword(password, user.password_hash);
    if (!ok) throw new ApiError(401, 'Kredensial tidak valid');
    const { token, expiresAt } = createSession(user.id, SESSION_TTL_SECONDS);
    setSessionCookie(resFor(req), token, SESSION_TTL_SECONDS, COOKIE_SECURE);
    logEvent(`${user.full_name} [${user.role}]`, null, '', 'Login', `user ${user.username}`);
    return { ok: true, user: { username: user.username, full_name: user.full_name, role: user.role }, expires_at: expiresAt };
  });

  route('POST', '/api/auth/logout', (m, q, body, req) => {
    const session = sessionFromRequest(req);
    if (session) {
      deleteSession(parseCookies(req.headers.cookie)[require('./auth').SESSION_COOKIE]);
      logEvent(`${session.fullName} [${session.role}]`, null, '', 'Logout', `user ${session.username}`);
    }
    clearSessionCookie(resFor(req), COOKIE_SECURE);
    return { ok: true };
  });

  route('GET', '/api/auth/session', (m, q, body, req) => {
    const session = sessionFromRequest(req);
    if (!session) throw new ApiError(401, 'Autentikasi diperlukan');
    return { user: { username: session.username, full_name: session.fullName, role: session.role } };
  });

  route('GET', '/api/kpis', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'read');
    const { computeKpis } = require('./domain');
    return computeKpis();
  });

  route('GET', '/api/projects', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'read');
    const args = [];
    let sql = "SELECT * FROM projects WHERE deleted_at = ''";
    if (q.get('track')) { sql += ' AND track = ?'; args.push(q.get('track')); }
    if (q.get('gate')) { sql += ' AND gate = ?'; args.push(q.get('gate')); }
    if (q.get('status')) { sql += ' AND status = ?'; args.push(q.get('status')); }
    if (q.get('include_deleted') === 'true' || q.get('include_deleted') === '1') {
      sql = sql.replace("deleted_at = ''", '1=1');
    }
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) AS c');
    const total = db.prepare(countSql).get(...args).c;
    const limit = Math.min(Math.max(int(q.get('limit') || 50), 1), 200);
    const offset = Math.max(int(q.get('offset') || 0), 0);
    sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    const rows = db.prepare(sql).all(...args, limit, offset);
    return {
      data: rows.map(p => ({ ...p, procurement: procurementInfo(p) })),
      pagination: { total, limit, offset },
    };
  });

  route('POST', '/api/projects', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'write_project');
    const actor = actorFrom(req, session);
    const data = validateProjectInput(body, false);
    assertStateConsistent(data);
    const code = nextProjectCode();
    const t = now();
    const submitBy = data.procurement_doc && data.procurement_target_start
      ? require('./domain').addDays(data.procurement_target_start, -require('./domain').PROC_LEAD_DAYS[data.procurement_doc]) : '';

    const row = withTx(() => {
      db.prepare(`INSERT INTO projects
        (code, name, customer_cfu, tribe_unit, business_owner, pm, project_type, track, reason_shared_service,
         nde_no, nde_date, budget_status, procurement_doc, procurement_target_start, procurement_submit_by,
         onboarding_status, gate, status, fte, start_date, end_date, bridging_end, bpom_case, definitive_plan, notes, created_at, updated_at, deleted_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(code, data.name, data.customer_cfu || '', data.tribe_unit || '', data.business_owner || '', data.pm || '',
          data.project_type, data.track, data.reason_shared_service || '', data.nde_no || '', data.nde_date || '',
          data.budget_status || 'belum_diajukan', data.procurement_doc || '', data.procurement_target_start || '',
          submitBy, data.onboarding_status || 'belum_mulai', 'G0', 'active', data.fte || '', data.start_date || '',
          data.end_date || '', data.bridging_end || '', data.bpom_case ? 1 : 0, data.definitive_plan || '',
          data.notes || '', t, t, '');
      const p = db.prepare('SELECT * FROM projects WHERE code = ?').get(code);
      if (p.track === 'first_responder') {
        const ins = db.prepare('INSERT INTO deliverables (project_id, name, owner_role, status, updated_at, required) VALUES (?, ?, ?, ?, ?, ?)');
        for (const [name, role] of FR_DELIVERABLES) ins.run(p.id, name, role, 'belum_mulai', t, 1);
      } else {
        const ins = db.prepare('INSERT INTO buffer_checks (project_id, item, required) VALUES (?, ?, ?)');
        for (const item of BUFFER_CHECKS) ins.run(p.id, item, 1);
      }
      const insExtra = db.prepare('INSERT INTO deliverables (project_id, name, owner_role, status, updated_at, required) VALUES (?, ?, ?, ?, ?, ?)');
      for (const [name, role] of PRD_EXTRA_DELIVERABLES) insExtra.run(p.id, name, role, 'belum_mulai', t, 0);
      logEvent(actor, p.id, 'G0', 'Project dibuat (intake SOP-01)', `Kode ${code}; jalur ${p.track}`);
      return p;
    });
    return { id: row.id, code, procurement: procurementInfo(row) };
  });

  route('GET', '/api/projects/:id', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'read');
    const p = getProject(m.id);
    return {
      project: p,
      procurement: procurementInfo(p),
      deliverables: db.prepare('SELECT * FROM deliverables WHERE project_id = ? ORDER BY id').all(p.id),
      buffer_checks: db.prepare('SELECT * FROM buffer_checks WHERE project_id = ? ORDER BY id').all(p.id),
      reports: db.prepare('SELECT * FROM weekly_reports WHERE project_id = ? ORDER BY submitted_at DESC').all(p.id),
      risks: db.prepare('SELECT * FROM risks WHERE project_id = ? ORDER BY status, created_at DESC').all(p.id),
      changes: db.prepare('SELECT * FROM change_requests WHERE project_id = ? ORDER BY created_at DESC').all(p.id),
      events: db.prepare('SELECT * FROM events WHERE project_id = ? ORDER BY created_at DESC LIMIT 200').all(p.id),
      gate_notes: db.prepare('SELECT * FROM gate_notes WHERE project_id = ?').all(p.id),
      gate_info: gateGaps(p),
    };
  });

  route('PUT', '/api/projects/:id', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'write_project');
    const actor = actorFrom(req, session);
    const p = getProject(m.id);
    if (p.deleted_at) throw new ApiError(422, 'Proyek telah dihapus, tidak dapat diubah');
    const data = validateProjectInput(body, true);
    if (data.track !== undefined && data.track !== p.track) {
      throw new ApiError(422, 'Track tidak boleh diubah setelah intake');
    }
    assertStateConsistent(data, p);

    if (data.procurement_doc !== undefined || data.procurement_target_start !== undefined) {
      const { addDays, PROC_LEAD_DAYS } = require('./domain');
      const doc = data.procurement_doc !== undefined ? data.procurement_doc : p.procurement_doc;
      const target = data.procurement_target_start !== undefined ? data.procurement_target_start : p.procurement_target_start;
      data.procurement_submit_by = (doc && target) ? addDays(target, -PROC_LEAD_DAYS[doc]) : '';
    }

    const keys = Object.keys(data);
    if (!keys.length) return { ok: true };
    const sets = keys.map(k => `${k} = ?`);
    const args = keys.map(k => data[k]);
    sets.push('updated_at = ?'); args.push(now());
    args.push(p.id);
    withTx(() => {
      db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...args);
      logEvent(actor, p.id, p.gate, 'Data project diperbarui', keys.join(', '));
    });
    return getProject(p.id);
  });

  route('POST', '/api/projects/:id/advance', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'write_project');
    const actor = actorFrom(req, session);
    const p = getProject(m.id);
    if (p.deleted_at) throw new ApiError(422, 'Proyek telah dihapus');
    const { next, gaps } = gateGaps(p);
    if (!next) throw new ApiError(422, 'Project sudah berada pada gate akhir');
    const force = bool01(body.force);
    if (gaps.length && !force) {
      throw new ApiError(422, 'Syarat gate belum terpenuhi', { next, gaps });
    }
    if (force) {
      requireRole(session, 'approver_action');
    }
    if (force && !s(body.force_reason)) {
      throw new ApiError(422, 'Force advance wajib menyertakan force_reason');
    }
    const newStatus = next === 'CLOSED' ? 'closed' : 'active';
    const newPrevGate = next === 'CLOSED' ? p.gate : '';
    withTx(() => {
      db.prepare('UPDATE projects SET gate = ?, status = ?, prev_gate = ?, updated_at = ? WHERE id = ?')
        .run(next, newStatus, newPrevGate, now(), p.id);
      const note = force
        ? `ESKALASI force advance oleh ${actor}: ${s(body.force_reason, 1000)}; gaps: ${gaps.join('; ') || '-'}`
        : (gaps.length ? `Gap yang dieskalasi: ${gaps.join('; ')}` : `${p.gate} -> ${next}`);
      logEvent(actor, p.id, next, force ? 'Gate dinaikkan dengan ESKALASI' : 'Gate dinaikkan', note);
    });
    return { next, forced: force, gaps };
  });

  route('POST', '/api/projects/:id/close', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'pm_action');
    const actor = actorFrom(req, session);
    const p = getProject(m.id);
    if (p.deleted_at) throw new ApiError(422, 'Proyek telah dihapus');
    if (p.gate === 'CLOSED' && p.status === 'closed') return { ok: true, already_closed: true };
    if (p.gate !== 'G5') throw new ApiError(422, 'Proyek hanya boleh ditutup dari gate G5');
    const bastNo = body.bast_no !== undefined ? s(body.bast_no, 200) : p.bast_no;
    const bastDate = body.bast_date !== undefined ? validateDateField(body.bast_date, 'bast_date') : p.bast_date;
    const acceptance = body.acceptance_evidence !== undefined ? s(body.acceptance_evidence, 1000) : p.acceptance_evidence;
    const evaluation = body.closure_evaluation !== undefined ? s(body.closure_evaluation, 4000) : p.closure_evaluation;
    if (!bastNo || !acceptance) {
      throw new ApiError(422, 'Penutupan wajib menyertakan bast_no dan acceptance_evidence');
    }
    withTx(() => {
      db.prepare("UPDATE projects SET prev_gate = gate, gate = 'CLOSED', status = 'closed', bast_no = ?, bast_date = ?, acceptance_evidence = ?, closure_evaluation = ?, updated_at = ? WHERE id = ?")
        .run(bastNo, bastDate, acceptance, evaluation, now(), p.id);
      logEvent(actor, p.id, 'CLOSED', 'Project ditandai selesai', `Dari gate ${p.gate}; BAST ${bastNo}`);
    });
    return { ok: true, gate: 'CLOSED', status: 'closed', bast_no: bastNo, bast_date: bastDate, acceptance_evidence: acceptance };
  });

  route('POST', '/api/projects/:id/reopen', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'approver_action');
    const actor = actorFrom(req, session);
    const p = getProject(m.id);
    if (p.deleted_at) throw new ApiError(422, 'Proyek telah dihapus');
    const gate = s(p.prev_gate) || (p.gate === 'CLOSED' ? 'G5' : p.gate);
    withTx(() => {
      db.prepare("UPDATE projects SET gate = ?, status = 'active', prev_gate = '', updated_at = ? WHERE id = ?")
        .run(gate, now(), p.id);
      logEvent(actor, p.id, gate, 'Project dibuka kembali', `Status ${p.status} -> active; gate ${p.gate} -> ${gate}`);
    });
    return { ok: true, gate, status: 'active' };
  });

  route('DELETE', '/api/projects/:id', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'approver_action');
    const actor = actorFrom(req, session);
    const p = getProject(m.id);
    if (p.deleted_at) return { ok: true, deleted: p.code };
    withTx(() => {
      db.prepare("UPDATE projects SET deleted_at = ?, status = 'closed', updated_at = ? WHERE id = ?")
        .run(now(), now(), p.id);
      logEvent(actor, null, '', 'Project dihapus (soft delete)', `${p.code} — ${p.name}`);
    });
    return { ok: true, deleted: p.code };
  });

  route('PUT', '/api/projects/:id/gate_notes/:gate', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'write_project');
    const actor = actorFrom(req, session);
    const p = getProject(m.id);
    if (p.deleted_at) throw new ApiError(422, 'Proyek telah dihapus');
    if (!GATES_ALL.includes(m.gate)) throw new ApiError(422, 'Gate tidak valid');
    withTx(() => {
      db.prepare(`INSERT INTO gate_notes (project_id, gate, note, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(project_id, gate) DO UPDATE SET note = excluded.note, updated_at = excluded.updated_at`)
        .run(p.id, m.gate, s(body.note, 4000), now());
      logEvent(actor, p.id, m.gate, 'Catatan proses gate diperbarui', s(body.note, 500));
    });
    return { ok: true };
  });

  route('POST', '/api/projects/:id/deliverables', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'write_project');
    const actor = actorFrom(req, session);
    const p = getProject(m.id);
    if (p.deleted_at) throw new ApiError(422, 'Proyek telah dihapus');
    if (!s(body.name)) throw new ApiError(422, 'Nama deliverable wajib diisi');
    db.prepare('INSERT INTO deliverables (project_id, name, owner_role, status, due_date, updated_at, required) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(p.id, s(body.name, 300), s(body.owner_role, 200), 'belum_mulai', validateDateField(body.due_date, 'due_date'), now(), 0);
    logEvent(actor, p.id, p.gate, 'Deliverable ditambahkan', s(body.name, 300));
    return db.prepare('SELECT * FROM deliverables WHERE project_id = ? ORDER BY id DESC LIMIT 1').get(p.id);
  });

  route('DELETE', '/api/projects/:id/deliverables/:did', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'write_project');
    const actor = actorFrom(req, session);
    const p = getProject(m.id);
    if (p.deleted_at) throw new ApiError(422, 'Proyek telah dihapus');
    const d = db.prepare('SELECT * FROM deliverables WHERE id = ? AND project_id = ?').get(int(m.did), p.id);
    if (!d) throw new ApiError(404, 'Deliverable tidak ditemukan');
    if (d.required && p.gate !== 'CLOSED' && p.status !== 'closed') {
      throw new ApiError(422, 'Deliverable wajib tidak boleh dihapus sebelum gate melewati G2A atau proyek ditutup');
    }
    withTx(() => {
      db.prepare('DELETE FROM deliverables WHERE id = ?').run(d.id);
      logEvent(actor, p.id, p.gate, 'Deliverable dihapus', d.name);
    });
    return { ok: true };
  });

  route('PUT', '/api/projects/:id/deliverables/:did', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'write_project');
    const actor = actorFrom(req, session);
    const p = getProject(m.id);
    if (p.deleted_at) throw new ApiError(422, 'Proyek telah dihapus');
    const d = db.prepare('SELECT * FROM deliverables WHERE id = ? AND project_id = ?').get(int(m.did), p.id);
    if (!d) throw new ApiError(404, 'Deliverable tidak ditemukan');
    const status = body.status !== undefined ? require('./domain').oneOf(body.status, DELIV_STATUS, undefined) : d.status;
    if (status === undefined) throw new ApiError(422, 'Status deliverable tidak valid');
    const name = body.name !== undefined ? s(body.name, 300) : d.name;
    const owner = body.owner_role !== undefined ? s(body.owner_role, 200) : d.owner_role;
    const evidence = body.evidence_url !== undefined ? s(body.evidence_url, 1000) : d.evidence_url;
    const reviewer = body.reviewed_by !== undefined ? s(body.reviewed_by, 200) : d.reviewed_by;
    const due = body.due_date !== undefined ? validateDateField(body.due_date, 'due_date') : d.due_date;
    if (!name) throw new ApiError(422, 'Nama deliverable tidak boleh kosong');
    if (d.status !== 'disetujui' && status === 'disetujui' && (!evidence || !reviewer)) {
      throw new ApiError(422, 'Status disetujui wajib disertai evidence_url dan reviewed_by');
    }
    withTx(() => {
      db.prepare('UPDATE deliverables SET name = ?, owner_role = ?, status = ?, evidence_url = ?, reviewed_by = ?, due_date = ?, version = version + 1, updated_at = ? WHERE id = ?')
        .run(name, owner, status, evidence, reviewer, due, now(), d.id);
      logEvent(actor, p.id, p.gate, 'Deliverable diperbarui', `${d.name} -> ${status}`);
    });
    return db.prepare('SELECT * FROM deliverables WHERE id = ?').get(d.id);
  });

  route('POST', '/api/projects/:id/buffer_checks', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'write_project');
    const actor = actorFrom(req, session);
    const p = getProject(m.id);
    if (p.deleted_at) throw new ApiError(422, 'Proyek telah dihapus');
    if (!s(body.item)) throw new ApiError(422, 'Nama prasyarat wajib diisi');
    db.prepare('INSERT INTO buffer_checks (project_id, item, required) VALUES (?, ?, ?)').run(p.id, s(body.item, 300), 0);
    logEvent(actor, p.id, p.gate, 'Prasyarat Buffer ditambahkan', s(body.item, 300));
    return { ok: true };
  });

  route('DELETE', '/api/projects/:id/buffer_checks/:cid', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'write_project');
    const actor = actorFrom(req, session);
    const p = getProject(m.id);
    if (p.deleted_at) throw new ApiError(422, 'Proyek telah dihapus');
    const c = db.prepare('SELECT * FROM buffer_checks WHERE id = ? AND project_id = ?').get(int(m.cid), p.id);
    if (!c) throw new ApiError(404, 'Checklist tidak ditemukan');
    if (c.required && p.gate !== 'CLOSED' && p.status !== 'closed') {
      throw new ApiError(422, 'Prasyarat wajib tidak boleh dihapus sebelum gate melewati G2B atau proyek ditutup');
    }
    withTx(() => {
      db.prepare('DELETE FROM buffer_checks WHERE id = ?').run(c.id);
      logEvent(actor, p.id, p.gate, 'Prasyarat Buffer dihapus', c.item);
    });
    return { ok: true };
  });

  route('PUT', '/api/projects/:id/buffer_checks/:cid', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'write_project');
    const actor = actorFrom(req, session);
    const p = getProject(m.id);
    if (p.deleted_at) throw new ApiError(422, 'Proyek telah dihapus');
    const c = db.prepare('SELECT * FROM buffer_checks WHERE id = ? AND project_id = ?').get(int(m.cid), p.id);
    if (!c) throw new ApiError(404, 'Checklist tidak ditemukan');
    const verified = body.verified !== undefined ? bool01(body.verified) : c.verified;
    const item = body.item !== undefined ? s(body.item, 300) : c.item;
    const evidence = body.evidence !== undefined ? s(body.evidence, 1000) : c.evidence;
    const verifiedBy = body.verified_by !== undefined ? s(body.verified_by, 200) : c.verified_by;
    const notes = body.notes !== undefined ? s(body.notes, 2000) : c.notes;
    if (!item) throw new ApiError(422, 'Nama prasyarat tidak boleh kosong');
    if (!c.verified && verified && (!evidence || !verifiedBy)) {
      throw new ApiError(422, 'Verifikasi wajib disertai evidence dan verified_by');
    }
    const verifiedAt = verified ? (c.verified_at || now()) : '';
    withTx(() => {
      db.prepare('UPDATE buffer_checks SET item = ?, verified = ?, evidence = ?, verified_by = ?, verified_at = ?, notes = ? WHERE id = ?')
        .run(item, verified, evidence, verifiedBy, verifiedAt, notes, c.id);
      logEvent(actor, p.id, p.gate, 'Prasyarat Buffer diperbarui', `${c.item} -> ${verified ? 'terverifikasi' : 'belum'}`);
    });
    return db.prepare('SELECT * FROM buffer_checks WHERE id = ?').get(c.id);
  });

  route('POST', '/api/projects/:id/reports', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'write_project');
    const actor = actorFrom(req, session);
    const p = getProject(m.id);
    if (p.deleted_at) throw new ApiError(422, 'Proyek telah dihapus');
    if (!s(body.period)) throw new ApiError(422, 'Periode laporan wajib diisi');
    db.prepare(`INSERT INTO weekly_reports
      (project_id, period, talent_info, planned, actual, evidence_url, next_steps, blockers, decisions_needed,
       access_status, submitted_by, submitted_at, pm_confirmed, pm_confirmed_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(p.id, s(body.period, 100), s(body.talent_info, 500), s(body.planned, 4000), s(body.actual, 4000),
        s(body.evidence_url, 1000), s(body.next_steps, 4000), s(body.blockers, 4000), s(body.decisions_needed, 2000),
        s(body.access_status, 500), s(body.submitted_by, 200), now(), bool01(body.pm_confirmed), s(body.pm_confirmed_by, 200));
    logEvent(actor, p.id, p.gate, 'Weekly report disampaikan', s(body.period, 100));
    return { ok: true };
  });

  route('PUT', '/api/reports/:rid/confirm', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'pm_action');
    const actor = actorFrom(req, session);
    const r = db.prepare('SELECT * FROM weekly_reports WHERE id = ?').get(int(m.rid));
    if (!r) throw new ApiError(404, 'Laporan tidak ditemukan');
    withTx(() => {
      db.prepare('UPDATE weekly_reports SET pm_confirmed = 1, pm_confirmed_by = ? WHERE id = ?')
        .run(s(body.pm_confirmed_by, 200) || actor, r.id);
      logEvent(actor, r.project_id, '', 'Weekly report dikonfirmasi PM', `Periode ${r.period}`);
    });
    return { ok: true };
  });

  route('POST', '/api/projects/:id/risks', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'write_project');
    const actor = actorFrom(req, session);
    const p = getProject(m.id);
    if (p.deleted_at) throw new ApiError(422, 'Proyek telah dihapus');
    const kind = require('./domain').oneOf(body.kind, RISK_KINDS, undefined);
    if (!kind) throw new ApiError(422, 'Jenis item RAID tidak valid');
    if (!s(body.title)) throw new ApiError(422, 'Judul wajib diisi');
    db.prepare(`INSERT INTO risks (project_id, kind, title, description, impact, owner, due_date, mitigation, status, escalated, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(p.id, kind, s(body.title, 300), s(body.description, 4000), s(body.impact, 1000), s(body.owner, 200),
        validateDateField(body.due_date, 'due_date'), s(body.mitigation, 2000), 'open', bool01(body.escalated), now());
    logEvent(actor, p.id, p.gate, `${kind.charAt(0).toUpperCase() + kind.slice(1)} dicatat`, s(body.title, 300));
    return { ok: true };
  });

  route('PUT', '/api/risks/:rid', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'write_project');
    const actor = actorFrom(req, session);
    const r = db.prepare('SELECT * FROM risks WHERE id = ?').get(int(m.rid));
    if (!r) throw new ApiError(404, 'Item tidak ditemukan');
    withTx(() => {
      if (body.status !== undefined) {
        const st = require('./domain').oneOf(body.status, ['open', 'closed'], undefined);
        if (!st) throw new ApiError(422, 'Status tidak valid');
        db.prepare('UPDATE risks SET status = ?, closed_at = ? WHERE id = ?').run(st, st === 'closed' ? now() : '', r.id);
        logEvent(actor, r.project_id, '', 'Item RAID diperbarui', `${r.title} -> ${st}`);
      }
      if (body.owner !== undefined || body.due_date !== undefined || body.mitigation !== undefined) {
        const owner = body.owner !== undefined ? s(body.owner, 200) : r.owner;
        const due = body.due_date !== undefined ? validateDateField(body.due_date, 'due_date') : r.due_date;
        const mitigation = body.mitigation !== undefined ? s(body.mitigation, 2000) : r.mitigation;
        db.prepare('UPDATE risks SET owner = ?, due_date = ?, mitigation = ? WHERE id = ?')
          .run(owner, due, mitigation, r.id);
      }
    });
    return { ok: true };
  });

  route('POST', '/api/projects/:id/changes', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'write_project');
    const actor = actorFrom(req, session);
    const p = getProject(m.id);
    if (p.deleted_at) throw new ApiError(422, 'Proyek telah dihapus');
    if (!s(body.title)) throw new ApiError(422, 'Judul change request wajib diisi');
    db.prepare('INSERT INTO change_requests (project_id, title, description, impact_assessment, approver, status, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(p.id, s(body.title, 300), s(body.description, 4000), s(body.impact_assessment, 4000),
        s(body.approver, 200), 'diajukan', now());
    logEvent(actor, p.id, p.gate, 'Change request diajukan', s(body.title, 300));
    return { ok: true };
  });

  route('PUT', '/api/changes/:cid', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'approver_action');
    const actor = actorFrom(req, session);
    const c = db.prepare('SELECT * FROM change_requests WHERE id = ?').get(int(m.cid));
    if (!c) throw new ApiError(404, 'Change request tidak ditemukan');
    const st = require('./domain').oneOf(body.status, ['diajukan', 'disetujui', 'ditolak'], undefined);
    if (!st) throw new ApiError(422, 'Status tidak valid');
    withTx(() => {
      db.prepare('UPDATE change_requests SET status = ?, decided_at = ? WHERE id = ?').run(st, st === 'diajukan' ? '' : now(), c.id);
      logEvent(actor, c.project_id, '', 'Keputusan change request', `${c.title} -> ${st}`);
    });
    return { ok: true };
  });

  route('GET', '/api/meta', (m, q, body, req) => {
    const session = ensureAuth(req);
    requireRole(session, 'read');
    return {
      fr_deliverables: FR_DELIVERABLES,
      buffer_checks: BUFFER_CHECKS,
      proc_lead_days: require('./domain').PROC_LEAD_DAYS,
      gates: require('./domain').GATE_NEXT,
    };
  });

  return routes;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k) out[k] = decodeURIComponent(rest.join('='));
  }
  return out;
}

function resFor(req) {
  return req._response;
}

module.exports = { buildRoutes, resFor };
