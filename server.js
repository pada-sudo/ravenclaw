'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'ddp.sqlite'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  customer_cfu TEXT DEFAULT '',
  tribe_unit TEXT DEFAULT '',
  business_owner TEXT DEFAULT '',
  pm TEXT DEFAULT '',
  project_type TEXT NOT NULL DEFAULT 'new',
  track TEXT NOT NULL,
  reason_shared_service TEXT DEFAULT '',
  nde_no TEXT DEFAULT '',
  nde_date TEXT DEFAULT '',
  budget_status TEXT NOT NULL DEFAULT 'belum_diajukan',
  procurement_doc TEXT DEFAULT '',
  procurement_target_start TEXT DEFAULT '',
  procurement_submit_by TEXT DEFAULT '',
  onboarding_status TEXT NOT NULL DEFAULT 'belum_mulai',
  gate TEXT NOT NULL DEFAULT 'G0',
  status TEXT NOT NULL DEFAULT 'active',
  prev_gate TEXT DEFAULT '',
  fte TEXT DEFAULT '',
  start_date TEXT DEFAULT '',
  end_date TEXT DEFAULT '',
  bridging_end TEXT DEFAULT '',
  bpom_case INTEGER NOT NULL DEFAULT 0,
  definitive_plan TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS deliverables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  owner_role TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'belum_mulai',
  evidence_url TEXT DEFAULT '',
  reviewed_by TEXT DEFAULT '',
  due_date TEXT DEFAULT '',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS buffer_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  evidence TEXT DEFAULT '',
  verified_by TEXT DEFAULT '',
  verified_at TEXT DEFAULT '',
  notes TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS weekly_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  talent_info TEXT DEFAULT '',
  planned TEXT DEFAULT '',
  actual TEXT DEFAULT '',
  evidence_url TEXT DEFAULT '',
  next_steps TEXT DEFAULT '',
  blockers TEXT DEFAULT '',
  decisions_needed TEXT DEFAULT '',
  access_status TEXT DEFAULT '',
  submitted_by TEXT DEFAULT '',
  submitted_at TEXT NOT NULL,
  pm_confirmed INTEGER NOT NULL DEFAULT 0,
  pm_confirmed_by TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS risks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  impact TEXT DEFAULT '',
  owner TEXT DEFAULT '',
  due_date TEXT DEFAULT '',
  mitigation TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  escalated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  closed_at TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS change_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  impact_assessment TEXT DEFAULT '',
  approver TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'diajukan',
  created_at TEXT NOT NULL,
  decided_at TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  gate TEXT DEFAULT '',
  action TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'operator web',
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gate_notes (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  gate TEXT NOT NULL,
  note TEXT DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, gate)
);
`);

const FR_DELIVERABLES = [
  ['WBS', 'Project Manager'],
  ['BRD', 'PM dan/atau Business Analyst'],
  ['SAD', 'Solution Architect'],
  ['Workforce Plan', 'Solution Architect'],
  ['Initial Data Solution', 'Data Team'],
  ['Initial Design Documentation', 'Design Team'],
  ['Project Charter', 'Ditandatangani seluruh pemangku kepentingan'],
];
const BUFFER_CHECKS = [
  'BRD existing tersedia dan telah direview',
  'SAD existing tersedia dan telah direview',
  'Coding repository, change log, user story tersedia dan telah direview',
  'Knowledge transfer dari tim sebelumnya selesai',
  'Scope/timeline/kapasitas (role, FTE, periode, task) disepakati',
  'Akses dokumentasi relevan diperoleh talent',
  'Weekly progress disampaikan ke PM setiap minggu',
  'Risk/blocker dilaporkan sedini mungkin (RAID log)',
];
const TRACKS = ['first_responder', 'buffer'];
const PROJECT_TYPES = ['new', 'existing'];
const GATES_ALL = ['G0', 'G1', 'G2A', 'G2B', 'G3', 'G4', 'G5', 'CLOSED'];
const BUDGET_STATUS = ['belum_diajukan', 'diajukan', 'disetujui'];
const ONBOARDING_STATUS = ['belum_mulai', 'berjalan', 'selesai'];
const DELIV_STATUS = ['belum_mulai', 'dalam_proses', 'review', 'disetujui'];
const RISK_KINDS = ['risiko', 'isu', 'blocker', 'dependensi'];
const PROC_LEAD_DAYS = {
  'PKDF': 60,
  'Justifikasi Kontrak Lumsum': 45,
  'Surat Pesanan dengan new item': 30,
  'Surat Pesanan tanpa new item': 14,
};

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

function s(v, max = 1000) {
  if (v === undefined || v === null) return '';
  const t = String(v).trim();
  return t.slice(0, max);
}
function int(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}
function bool01(v) { return (v === 1 || v === true || v === '1' || v === 'true') ? 1 : 0; }
function oneOf(v, list, fallback) { return list.includes(v) ? v : fallback; }
function daysBetween(fromISO, toISO) {
  const a = Date.parse(fromISO);
  const b = Date.parse(toISO);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.floor((b - a) / 86400000);
}
function addDays(dateStr, n) {
  const d = new Date(dateStr || today());
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

class ApiError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

function getProject(id) {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(int(id));
  if (!p) throw new ApiError(404, 'Project tidak ditemukan');
  return p;
}
function logEvent(projectId, gate, action, note) {
  db.prepare('INSERT INTO events (project_id, gate, action, actor, note, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(projectId, gate, action, 'operator web', s(note, 2000), now());
}
function nextProjectCode() {
  const year = new Date().getFullYear();
  const row = db.prepare("SELECT COUNT(*) AS c FROM projects WHERE code LIKE ?").get(`PRJ-${year}-%`);
  return `PRJ-${year}-${String(row.c + 1).padStart(3, '0')}`;
}

if (!db.prepare('PRAGMA table_info(projects)').all().some(c => c.name === 'prev_gate')) {
  db.exec("ALTER TABLE projects ADD COLUMN prev_gate TEXT DEFAULT ''");
}

const GATE_NEXT = {
  first_responder: ['G0', 'G1', 'G2A', 'G3', 'G4', 'G5', 'CLOSED'],
  buffer: ['G0', 'G1', 'G2B', 'G3', 'G4', 'G5', 'CLOSED'],
};

function gateGaps(p) {
  const gaps = [];
  const idx = GATE_NEXT[p.track].indexOf(p.gate);
  if (idx < 0 || idx >= GATE_NEXT[p.track].length - 1) return { next: null, gaps: [] };
  const next = GATE_NEXT[p.track][idx + 1];
  if (p.gate === 'G0') {
    if (!p.track) gaps.push('Jalur penugasan (First Responder / Buffer) belum ditentukan');
    if (!s(p.reason_shared_service)) gaps.push('Alasan penggunaan Shared Service belum dicatat');
  }
  if (p.gate === 'G1') {
    if (!s(p.nde_no) || !s(p.nde_date)) gaps.push('NDE permintaan CFU belum tersedia (nomor/tanggal)');
    if (p.budget_status !== 'disetujui') gaps.push('Anggaran belum disetujui dan tersedia di sistem keuangan');
    if (p.onboarding_status === 'belum_mulai') gaps.push('Onboarding/akses talent belum berjalan');
  }
  if (p.gate === 'G2A') {
    const open = db.prepare("SELECT COUNT(*) AS c FROM deliverables WHERE project_id = ? AND status != 'disetujui'").get(p.id).c;
    if (open > 0) gaps.push(`${open} deliverable setup belum berstatus disetujui (SOP-03)`);
  }
  if (p.gate === 'G2B') {
    const open = db.prepare('SELECT COUNT(*) AS c FROM buffer_checks WHERE project_id = ? AND verified = 0').get(p.id).c;
    if (open > 0) gaps.push(`${open} prasyarat teknis Buffer belum terverifikasi (SOP-04, gate B1-B3)`);
  }
  if (p.gate === 'G3') {
    const openBlockers = db.prepare("SELECT COUNT(*) AS c FROM risks WHERE project_id = ? AND kind = 'blocker' AND status = 'open'").get(p.id).c;
    if (openBlockers > 0) gaps.push(`${openBlockers} blocker masih terbuka`);
    const reports = db.prepare('SELECT COUNT(*) AS c FROM weekly_reports WHERE project_id = ?').get(p.id).c;
    if (reports === 0) gaps.push('Belum ada weekly report (SOP-05)');
  }
  if (p.gate === 'G4') {
    const openRisks = db.prepare("SELECT COUNT(*) AS c FROM risks WHERE project_id = ? AND status = 'open'").get(p.id).c;
    if (openRisks > 0) {
      const undocumented = db.prepare("SELECT COUNT(*) AS c FROM risks WHERE project_id = ? AND status = 'open' AND (owner = '' OR due_date = '')").get(p.id).c;
      if (undocumented > 0) gaps.push(`${undocumented} isu residual belum memiliki owner dan due date (SOP-06)`);
    }
  }
  if (p.gate === 'G5') {
    if (!s(p.notes)) gaps.push('Lessons learned / catatan penutupan belum diisi');
  }
  return { next, gaps };
}

function computeKpis() {
  const active = db.prepare("SELECT * FROM projects WHERE status != 'closed'").all();
  const total = active.length || 1;
  const adminReady = active.filter(p => s(p.nde_no) && p.budget_status === 'disetujui' && p.onboarding_status !== 'belum_mulai').length;
  const frProjects = active.filter(p => p.track === 'first_responder');
  const frReady = frProjects.filter(p => {
    const open = db.prepare("SELECT COUNT(*) AS c FROM deliverables WHERE project_id = ? AND status != 'disetujui'").get(p.id).c;
    return open === 0;
  }).length;
  const bufProjects = active.filter(p => p.track === 'buffer');
  const bufReady = bufProjects.filter(p => {
    const open = db.prepare('SELECT COUNT(*) AS c FROM buffer_checks WHERE project_id = ? AND verified = 0').get(p.id).c;
    return open === 0;
  }).length;
  const delivery = active.filter(p => ['G3', 'G4', 'G5'].includes(p.gate));
  const weekAgo = addDays(today(), -7);
  const reportingOk = delivery.filter(p =>
    db.prepare('SELECT COUNT(*) AS c FROM weekly_reports WHERE project_id = ? AND submitted_at >= ?').get(p.id, weekAgo).c > 0
  ).length;
  const blockers = db.prepare("SELECT r.*, p.code AS project_code, p.name AS project_name FROM risks r JOIN projects p ON p.id = r.project_id WHERE r.kind = 'blocker' AND r.status = 'open'").all();
  const ages = blockers.map(b => daysBetween(b.created_at, now()) ?? 0);
  const avgAge = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
  const transitionEligible = bufProjects.filter(p => s(p.bridging_end));
  const transitionReady = transitionEligible.filter(p => s(p.definitive_plan) && (daysBetween(today(), p.bridging_end) ?? -1) > 0).length;
  return {
    active_projects: active.length,
    admin_readiness_pct: Math.round((adminReady / total) * 100),
    fr_readiness_pct: frProjects.length ? Math.round((frReady / frProjects.length) * 100) : null,
    buffer_tech_readiness_pct: bufProjects.length ? Math.round((bufReady / bufProjects.length) * 100) : null,
    weekly_reporting_compliance_pct: delivery.length ? Math.round((reportingOk / delivery.length) * 100) : null,
    blockers_open: blockers.length,
    blocker_avg_age_days: avgAge,
    blocker_max_age_days: ages.length ? Math.max(...ages) : 0,
    transition_ready_pct: transitionEligible.length ? Math.round((transitionReady / transitionEligible.length) * 100) : null,
    blocker_list: blockers.map(b => ({
      id: b.id, project_id: b.project_id, project_code: b.project_code, project_name: b.project_name,
      title: b.title, owner: b.owner, due_date: b.due_date, age_days: daysBetween(b.created_at, now()),
    })),
  };
}

function validateProjectInput(body, partial) {
  const out = {};
  const fields = {
    name: v => s(v, 300),
    customer_cfu: v => s(v, 200),
    tribe_unit: v => s(v, 200),
    business_owner: v => s(v, 200),
    pm: v => s(v, 200),
    project_type: v => oneOf(v, PROJECT_TYPES, undefined),
    track: v => oneOf(v, TRACKS, undefined),
    reason_shared_service: v => s(v, 2000),
    nde_no: v => s(v, 200),
    nde_date: v => s(v, 20),
    budget_status: v => oneOf(v, BUDGET_STATUS, undefined),
    procurement_doc: v => (v === '' || PROC_LEAD_DAYS[v] !== undefined) ? s(v, 100) : undefined,
    procurement_target_start: v => s(v, 20),
    onboarding_status: v => oneOf(v, ONBOARDING_STATUS, undefined),
    fte: v => s(v, 100),
    start_date: v => s(v, 20),
    end_date: v => s(v, 20),
    bridging_end: v => s(v, 20),
    bpom_case: v => bool01(v),
    definitive_plan: v => s(v, 2000),
    notes: v => s(v, 4000),
    status: v => oneOf(v, ['active', 'pending', 'blocked', 'closed'], undefined),
  };
  if (!partial && (!body.name || !s(body.name))) throw new ApiError(422, 'Nama project wajib diisi');
  if (!partial && !TRACKS.includes(body.track)) throw new ApiError(422, 'Jalur (track) wajib first_responder atau buffer');
  if (!partial && !PROJECT_TYPES.includes(body.project_type)) throw new ApiError(422, 'Jenis project wajib new atau existing');
  for (const [k, fn] of Object.entries(fields)) {
    if (body[k] === undefined) continue;
    const v = fn(body[k]);
    if (v === undefined) throw new ApiError(422, `Nilai tidak valid untuk field ${k}`);
    out[k] = v;
  }
  return out;
}

function procurementInfo(p) {
  const doc = s(p.procurement_doc);
  const lead = PROC_LEAD_DAYS[doc];
  const target = s(p.procurement_target_start);
  if (!doc || !target) return { doc, lead_days: lead || null, submit_by: '', warning: '' };
  const submitBy = addDays(target, -lead);
  let warning = '';
  if (submitBy < today()) warning = `Dokumen ${doc} seharusnya sudah diajukan paling lambat ${submitBy} (${lead} hari sebelum mulai) — terlambat ${Math.abs(daysBetween(submitBy, today()))} hari`;
  return { doc, lead_days: lead, submit_by: submitBy, warning };
}

const routes = [];
function route(method, pattern, handler) {
  const names = [];
  const rx = new RegExp('^' + pattern.replace(/:[a-zA-Z]+/g, m => { names.push(m.slice(1)); return '([^/]+)'; }) + '$');
  routes.push({ method, rx, names, handler });
}

route('GET', '/api/kpis', () => computeKpis());

route('GET', '/api/projects', (m, q) => {
  let sql = 'SELECT * FROM projects WHERE 1=1';
  const args = [];
  if (q.get('track')) { sql += ' AND track = ?'; args.push(q.get('track')); }
  if (q.get('gate')) { sql += ' AND gate = ?'; args.push(q.get('gate')); }
  if (q.get('status')) { sql += ' AND status = ?'; args.push(q.get('status')); }
  sql += ' ORDER BY updated_at DESC';
  const rows = db.prepare(sql).all(...args);
  return rows.map(p => ({ ...p, procurement: procurementInfo(p) }));
});

route('POST', '/api/projects', (m, q, body) => {
  const data = validateProjectInput(body, false);
  const t = now();
  const code = nextProjectCode();
  const submitBy = data.procurement_doc && data.procurement_target_start
    ? addDays(data.procurement_target_start, -PROC_LEAD_DAYS[data.procurement_doc]) : '';
  db.prepare(`INSERT INTO projects
    (code, name, customer_cfu, tribe_unit, business_owner, pm, project_type, track, reason_shared_service,
     nde_no, nde_date, budget_status, procurement_doc, procurement_target_start, procurement_submit_by,
     onboarding_status, gate, status, fte, start_date, end_date, bridging_end, bpom_case, definitive_plan, notes, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(code, data.name, data.customer_cfu || '', data.tribe_unit || '', data.business_owner || '', data.pm || '',
      data.project_type, data.track, data.reason_shared_service || '', data.nde_no || '', data.nde_date || '',
      data.budget_status || 'belum_diajukan', data.procurement_doc || '', data.procurement_target_start || '',
      submitBy, data.onboarding_status || 'belum_mulai', 'G0', 'active', data.fte || '', data.start_date || '',
      data.end_date || '', data.bridging_end || '', data.bpom_case ? 1 : 0, data.definitive_plan || '',
      data.notes || '', t, t);
  const p = db.prepare('SELECT * FROM projects WHERE code = ?').get(code);
  if (p.track === 'first_responder') {
    const ins = db.prepare('INSERT INTO deliverables (project_id, name, owner_role, updated_at) VALUES (?, ?, ?, ?)');
    for (const [name, role] of FR_DELIVERABLES) ins.run(p.id, name, role, t);
  } else {
    const ins = db.prepare('INSERT INTO buffer_checks (project_id, item) VALUES (?, ?)');
    for (const item of BUFFER_CHECKS) ins.run(p.id, item);
  }
  logEvent(p.id, 'G0', 'Project dibuat (intake SOP-01)', `Kode ${code}; jalur ${p.track}`);
  return { id: p.id, code, procurement: procurementInfo(p) };
});

route('GET', '/api/projects/:id', m => {
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

route('PUT', '/api/projects/:id', (m, q, body) => {
  const p = getProject(m.id);
  const data = validateProjectInput(body, true);
  const submitBy = data.procurement_doc !== undefined || data.procurement_target_start !== undefined
    ? ((data.procurement_doc ?? p.procurement_doc) && (data.procurement_target_start ?? p.procurement_target_start)
      ? addDays(data.procurement_target_start ?? p.procurement_target_start, -PROC_LEAD_DAYS[data.procurement_doc ?? p.procurement_doc]) : '')
    : undefined;
  const keys = Object.keys(data);
  if (!keys.length && submitBy === undefined) return { ok: true };
  const sets = keys.map(k => `${k} = ?`);
  const args = keys.map(k => data[k]);
  if (submitBy !== undefined) { sets.push('procurement_submit_by = ?'); args.push(submitBy); }
  sets.push('updated_at = ?'); args.push(now());
  args.push(p.id);
  db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...args);
  logEvent(p.id, p.gate, 'Data project diperbarui', keys.join(', '));
  return getProject(p.id);
});

route('POST', '/api/projects/:id/advance', (m, q, body) => {
  const p = getProject(m.id);
  const { next, gaps } = gateGaps(p);
  if (!next) throw new ApiError(422, 'Project sudah berada pada gate akhir');
  const force = bool01(body.force);
  if (gaps.length && !force) {
    throw new ApiError(422, 'Syarat gate belum terpenuhi', { next, gaps });
  }
  db.prepare('UPDATE projects SET gate = ?, status = ?, prev_gate = ?, updated_at = ? WHERE id = ?')
    .run(next, next === 'CLOSED' ? 'closed' : 'active', next === 'CLOSED' ? p.gate : '', now(), p.id);
  logEvent(p.id, next, force ? 'Gate dinaikkan dengan ESKALASI (gap dicatat)' : 'Gate dinaikkan', gaps.length ? `Gap yang dieskalasi: ${gaps.join('; ')}` : `G${p.gate} -> ${next}`);
  return { next, forced: force, gaps };
});

route('POST', '/api/projects/:id/close', m => {
  const p = getProject(m.id);
  if (p.gate === 'CLOSED' && p.status === 'closed') return { ok: true, already_closed: true };
  db.prepare("UPDATE projects SET prev_gate = gate, gate = 'CLOSED', status = 'closed', updated_at = ? WHERE id = ?").run(now(), p.id);
  logEvent(p.id, 'CLOSED', 'Project ditandai selesai', `Dari gate ${p.gate}; status ${p.status}`);
  return { ok: true, gate: 'CLOSED', status: 'closed' };
});

route('POST', '/api/projects/:id/reopen', m => {
  const p = getProject(m.id);
  const gate = s(p.prev_gate) || (p.gate === 'CLOSED' ? 'G5' : p.gate);
  db.prepare("UPDATE projects SET gate = ?, status = 'active', prev_gate = '', updated_at = ? WHERE id = ?").run(gate, now(), p.id);
  logEvent(p.id, gate, 'Project dibuka kembali', `Status ${p.status} -> active; gate ${p.gate} -> ${gate}`);
  return { ok: true, gate, status: 'active' };
});

route('DELETE', '/api/projects/:id', m => {
  const p = getProject(m.id);
  db.prepare('DELETE FROM projects WHERE id = ?').run(p.id);
  logEvent(null, '', 'Project dihapus', `${p.code} — ${p.name}`);
  return { ok: true, deleted: p.code };
});

route('PUT', '/api/projects/:id/gate_notes/:gate', (m, q, body) => {
  const p = getProject(m.id);
  if (!GATES_ALL.includes(m.gate)) throw new ApiError(422, 'Gate tidak valid');
  db.prepare(`INSERT INTO gate_notes (project_id, gate, note, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(project_id, gate) DO UPDATE SET note = excluded.note, updated_at = excluded.updated_at`)
    .run(p.id, m.gate, s(body.note, 4000), now());
  logEvent(p.id, m.gate, 'Catatan proses gate diperbarui', s(body.note, 500));
  return { ok: true };
});

route('POST', '/api/projects/:id/deliverables', (m, q, body) => {
  const p = getProject(m.id);
  if (!s(body.name)) throw new ApiError(422, 'Nama deliverable wajib diisi');
  db.prepare('INSERT INTO deliverables (project_id, name, owner_role, status, due_date, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(p.id, s(body.name, 300), s(body.owner_role, 200), 'belum_mulai', s(body.due_date, 20), now());
  logEvent(p.id, p.gate, 'Deliverable ditambahkan', s(body.name, 300));
  return db.prepare('SELECT * FROM deliverables WHERE project_id = ? ORDER BY id DESC LIMIT 1').get(p.id);
});

route('DELETE', '/api/projects/:id/deliverables/:did', m => {
  const p = getProject(m.id);
  const d = db.prepare('SELECT * FROM deliverables WHERE id = ? AND project_id = ?').get(int(m.did), p.id);
  if (!d) throw new ApiError(404, 'Deliverable tidak ditemukan');
  db.prepare('DELETE FROM deliverables WHERE id = ?').run(d.id);
  logEvent(p.id, p.gate, 'Deliverable dihapus', d.name);
  return { ok: true };
});

route('PUT', '/api/projects/:id/deliverables/:did', (m, q, body) => {
  const p = getProject(m.id);
  const d = db.prepare('SELECT * FROM deliverables WHERE id = ? AND project_id = ?').get(int(m.did), p.id);
  if (!d) throw new ApiError(404, 'Deliverable tidak ditemukan');
  const status = body.status !== undefined ? oneOf(body.status, DELIV_STATUS, undefined) : d.status;
  if (status === undefined) throw new ApiError(422, 'Status deliverable tidak valid');
  db.prepare('UPDATE deliverables SET name = ?, owner_role = ?, status = ?, evidence_url = ?, reviewed_by = ?, due_date = ?, updated_at = ? WHERE id = ?')
    .run(s(body.name, 300) || d.name, s(body.owner_role, 200) || d.owner_role, status,
      s(body.evidence_url, 1000) || d.evidence_url, s(body.reviewed_by, 200) || d.reviewed_by,
      s(body.due_date, 20) || d.due_date, now(), d.id);
  logEvent(p.id, p.gate, 'Deliverable diperbarui', `${d.name} -> ${status}`);
  return db.prepare('SELECT * FROM deliverables WHERE id = ?').get(d.id);
});

route('POST', '/api/projects/:id/buffer_checks', (m, q, body) => {
  const p = getProject(m.id);
  if (!s(body.item)) throw new ApiError(422, 'Nama prasyarat wajib diisi');
  db.prepare('INSERT INTO buffer_checks (project_id, item) VALUES (?, ?)').run(p.id, s(body.item, 300));
  logEvent(p.id, p.gate, 'Prasyarat Buffer ditambahkan', s(body.item, 300));
  return { ok: true };
});

route('DELETE', '/api/projects/:id/buffer_checks/:cid', m => {
  const p = getProject(m.id);
  const c = db.prepare('SELECT * FROM buffer_checks WHERE id = ? AND project_id = ?').get(int(m.cid), p.id);
  if (!c) throw new ApiError(404, 'Checklist tidak ditemukan');
  db.prepare('DELETE FROM buffer_checks WHERE id = ?').run(c.id);
  logEvent(p.id, p.gate, 'Prasyarat Buffer dihapus', c.item);
  return { ok: true };
});

route('PUT', '/api/projects/:id/buffer_checks/:cid', (m, q, body) => {
  const p = getProject(m.id);
  const c = db.prepare('SELECT * FROM buffer_checks WHERE id = ? AND project_id = ?').get(int(m.cid), p.id);
  if (!c) throw new ApiError(404, 'Checklist tidak ditemukan');
  const verified = body.verified !== undefined ? bool01(body.verified) : c.verified;
  db.prepare('UPDATE buffer_checks SET item = ?, verified = ?, evidence = ?, verified_by = ?, verified_at = ?, notes = ? WHERE id = ?')
    .run(s(body.item, 300) || c.item, verified, s(body.evidence, 1000) || c.evidence, s(body.verified_by, 200) || c.verified_by,
      verified ? (c.verified_at || now()) : '', s(body.notes, 2000) || c.notes, c.id);
  logEvent(p.id, p.gate, 'Prasyarat Buffer diperbarui', `${c.item} -> ${verified ? 'terverifikasi' : 'belum'}`);
  return db.prepare('SELECT * FROM buffer_checks WHERE id = ?').get(c.id);
});

route('POST', '/api/projects/:id/reports', (m, q, body) => {
  const p = getProject(m.id);
  if (!s(body.period)) throw new ApiError(422, 'Periode laporan wajib diisi');
  db.prepare(`INSERT INTO weekly_reports
    (project_id, period, talent_info, planned, actual, evidence_url, next_steps, blockers, decisions_needed,
     access_status, submitted_by, submitted_at, pm_confirmed, pm_confirmed_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(p.id, s(body.period, 100), s(body.talent_info, 500), s(body.planned, 4000), s(body.actual, 4000),
      s(body.evidence_url, 1000), s(body.next_steps, 4000), s(body.blockers, 4000), s(body.decisions_needed, 2000),
      s(body.access_status, 500), s(body.submitted_by, 200), now(), bool01(body.pm_confirmed), s(body.pm_confirmed_by, 200));
  logEvent(p.id, p.gate, 'Weekly report disampaikan', s(body.period, 100));
  return { ok: true };
});

route('PUT', '/api/reports/:rid/confirm', (m, q, body) => {
  const r = db.prepare('SELECT * FROM weekly_reports WHERE id = ?').get(int(m.rid));
  if (!r) throw new ApiError(404, 'Laporan tidak ditemukan');
  db.prepare('UPDATE weekly_reports SET pm_confirmed = 1, pm_confirmed_by = ? WHERE id = ?')
    .run(s(body.pm_confirmed_by, 200) || 'PM', r.id);
  return { ok: true };
});

route('POST', '/api/projects/:id/risks', (m, q, body) => {
  const p = getProject(m.id);
  const kind = oneOf(body.kind, RISK_KINDS, undefined);
  if (!kind) throw new ApiError(422, 'Jenis item RAID tidak valid');
  if (!s(body.title)) throw new ApiError(422, 'Judul wajib diisi');
  db.prepare(`INSERT INTO risks (project_id, kind, title, description, impact, owner, due_date, mitigation, status, escalated, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(p.id, kind, s(body.title, 300), s(body.description, 4000), s(body.impact, 1000), s(body.owner, 200),
      s(body.due_date, 20), s(body.mitigation, 2000), 'open', bool01(body.escalated), now());
  logEvent(p.id, p.gate, `${kind.charAt(0).toUpperCase() + kind.slice(1)} dicatat`, s(body.title, 300));
  return { ok: true };
});

route('PUT', '/api/risks/:rid', (m, q, body) => {
  const r = db.prepare('SELECT * FROM risks WHERE id = ?').get(int(m.rid));
  if (!r) throw new ApiError(404, 'Item tidak ditemukan');
  if (body.status !== undefined) {
    const st = oneOf(body.status, ['open', 'closed'], undefined);
    if (!st) throw new ApiError(422, 'Status tidak valid');
    db.prepare('UPDATE risks SET status = ?, closed_at = ? WHERE id = ?').run(st, st === 'closed' ? now() : '', r.id);
    logEvent(r.project_id, '', 'Item RAID diperbarui', `${r.title} -> ${st}`);
  }
  if (body.owner !== undefined || body.due_date !== undefined || body.mitigation !== undefined) {
    db.prepare('UPDATE risks SET owner = ?, due_date = ?, mitigation = ? WHERE id = ?')
      .run(s(body.owner, 200) || r.owner, s(body.due_date, 20) || r.due_date, s(body.mitigation, 2000) || r.mitigation, r.id);
  }
  return { ok: true };
});

route('POST', '/api/projects/:id/changes', (m, q, body) => {
  const p = getProject(m.id);
  if (!s(body.title)) throw new ApiError(422, 'Judul change request wajib diisi');
  db.prepare('INSERT INTO change_requests (project_id, title, description, impact_assessment, approver, status, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(p.id, s(body.title, 300), s(body.description, 4000), s(body.impact_assessment, 4000),
      s(body.approver, 200), 'diajukan', now());
  logEvent(p.id, p.gate, 'Change request diajukan', s(body.title, 300));
  return { ok: true };
});

route('PUT', '/api/changes/:cid', (m, q, body) => {
  const c = db.prepare('SELECT * FROM change_requests WHERE id = ?').get(int(m.cid));
  if (!c) throw new ApiError(404, 'Change request tidak ditemukan');
  const st = oneOf(body.status, ['diajukan', 'disetujui', 'ditolak'], undefined);
  if (!st) throw new ApiError(422, 'Status tidak valid');
  db.prepare('UPDATE change_requests SET status = ?, decided_at = ? WHERE id = ?').run(st, st === 'diajukan' ? '' : now(), c.id);
  logEvent(c.project_id, '', 'Keputusan change request', `${c.title} -> ${st}`);
  return { ok: true };
});

route('GET', '/api/meta', () => ({
  fr_deliverables: FR_DELIVERABLES,
  buffer_checks: BUFFER_CHECKS,
  proc_lead_days: PROC_LEAD_DAYS,
  gates: GATE_NEXT,
}));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function serveStatic(res, urlPath) {
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  const abs = path.normalize(path.join(PUBLIC, rel));
  if (!abs.startsWith(PUBLIC)) { res.writeHead(403); return res.end('Forbidden'); }
  let target = abs;
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    target = path.join(PUBLIC, 'index.html');
  }
  const ext = path.extname(target).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(target).pipe(res);
}

const rateMap = new Map();
function rateLimited(ip) {
  const t = Date.now();
  const e = rateMap.get(ip) || { c: 0, reset: t + 60000 };
  if (t > e.reset) { e.c = 0; e.reset = t + 60000; }
  e.c += 1;
  rateMap.set(ip, e);
  return e.c > 240;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > 1_000_000) { reject(new ApiError(413, 'Body terlalu besar')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new ApiError(400, 'JSON tidak valid')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  try {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
      if (rateLimited(ip)) throw new ApiError(429, 'Terlalu banyak permintaan, coba lagi nanti');
    }
    if (url.pathname.startsWith('/api/')) {
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = url.pathname.match(r.rx);
        if (!m) continue;
        const params = {};
        r.names.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
        const body = (req.method === 'POST' || req.method === 'PUT') ? await readBody(req) : {};
        const out = r.handler(params, url.searchParams, body);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify(out));
      }
      throw new ApiError(404, 'Endpoint tidak ditemukan');
    }
    if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
    serveStatic(res, url.pathname);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    if (status === 500) console.error('[error]', req.method, url.pathname, err);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: err.message || 'Kesalahan server', ...(err.extra || {}) }));
  }
});

function seed() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM projects').get().c;
  if (count > 0) return;
  const t = now();
  const ins = db.prepare(`INSERT INTO projects
    (code, name, customer_cfu, tribe_unit, business_owner, pm, project_type, track, reason_shared_service,
     nde_no, nde_date, budget_status, procurement_doc, procurement_target_start, procurement_submit_by,
     onboarding_status, gate, status, fte, start_date, end_date, bridging_end, bpom_case, definitive_plan, notes, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  ins.run('PRJ-2026-001', 'Dukungan PM BPOM - Delivery & Manage Service', 'BPOM', 'Tribe DPS', 'BPOM Business Owner', 'PM Buffer DPS',
    'existing', 'buffer', 'Kasus khusus Nota Dinas C.Tel.87/PS 000/DDP-B0200000/2026 - bridging PM Buffer 50% FTE',
    'NDE-BPOM/2026/014', '2026-10-05', 'disetujui', '', '', '', 'selesai', 'G3', 'active', '50%', '2026-10-07', '2026-11-06',
    '2026-11-06', 1, 'Tribe melakukan pemenuhan talent definitif paralel untuk Delivery dan Manage Service',
    'Kebutuhan: 70% FTE Delivery (3 bulan) + 30% FTE Manage Service. Dukungan DPS: 50% FTE maksimal 4 minggu.', t, t);

  ins.run('PRJ-2026-002', 'Setup Proyek Analitik Pelanggan', 'CFU Telkom Regional 1', 'Tribe Data', 'Owner CFU', 'PM First Responder',
    'new', 'first_responder', 'Presales-support dan setup awal proyek baru pascakontrak',
    'NDE-CFU/2026/032', '2026-10-10', 'disetujui', 'PKDF', '2026-12-15', '2026-10-16', 'berjalan', 'G2A', 'active', '', '2026-10-20', '', '', 0, '', '', t, t);

  ins.run('PRJ-2026-003', 'Pengembangan Fitur Aplikasi Internal', 'CFU Enterprise', 'Tribe Apps', 'Owner Enterprise', 'PM Enterprise',
    'existing', 'buffer', 'Eksekusi proyek berjalan dengan kontrak jelas; procurement tahap akhir',
    '', '', 'diajukan', 'Surat Pesanan dengan new item', '2026-11-10', '2026-10-11', 'belum_mulai', 'G1', 'pending', '100%', '', '', '', 0, '', '', t, t);

  const p1 = db.prepare("SELECT id FROM projects WHERE code = 'PRJ-2026-001'").get().id;
  const bIns = db.prepare('INSERT INTO buffer_checks (project_id, item, verified, verified_by, verified_at, notes) VALUES (?, ?, ?, ?, ?, ?)');
  bIns.run(p1, BUFFER_CHECKS[0], 1, 'Reviewer DPS', '2026-10-08', 'BRD existing review OK');
  bIns.run(p1, BUFFER_CHECKS[1], 1, 'Reviewer DPS', '2026-10-08', 'SAD existing review OK');
  bIns.run(p1, BUFFER_CHECKS[2], 1, 'Reviewer DPS', '2026-10-09', 'Repo + change log + user story OK');
  bIns.run(p1, BUFFER_CHECKS[3], 1, 'PM/SA sebelumnya', '2026-10-10', 'Handover KT selesai, MoM terlampir');
  bIns.run(p1, BUFFER_CHECKS[4], 1, 'Chapter DPS', '2026-10-10', '50% FTE, 7 Okt - 6 Nov 2026');
  bIns.run(p1, BUFFER_CHECKS[5], 1, 'Admin akses', '2026-10-10', 'Akses dokumen diberikan');
  bIns.run(p1, BUFFER_CHECKS[6], 0, '', '', '');
  bIns.run(p1, BUFFER_CHECKS[7], 0, '', '', '');

  db.prepare(`INSERT INTO weekly_reports (project_id, period, talent_info, planned, actual, evidence_url, next_steps, blockers, decisions_needed, access_status, submitted_by, submitted_at, pm_confirmed, pm_confirmed_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(p1, '2026-W42', 'PM Buffer DPS - 50% FTE', 'Fase Delivery: konsolidasi assessment dan rencana bridging',
      'Assessment selesai; rencana bridging disepakati; KT berjalan', 'link-evidence://bpom/w42',
      'Mulai eksekusi dukungan delivery minggu depan', 'Pemenuhan talent definitif oleh Tribe belum terkonfirmasi',
      'Konfirmasi kandidat definitif PM dari Tribe', 'Akses penuh OK', 'Talent Buffer', '2026-10-16T09:00:00.000Z', 1, 'PM BPOM');
  db.prepare(`INSERT INTO weekly_reports (project_id, period, talent_info, planned, actual, evidence_url, next_steps, blockers, decisions_needed, access_status, submitted_by, submitted_at, pm_confirmed, pm_confirmed_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(p1, '2026-W43', 'PM Buffer DPS - 50% FTE', 'Eksekusi dukungan delivery; monitoring bridging',
      'Dukungan delivery berjalan 50% FTE', 'link-evidence://bpom/w43',
      'Lanjutkan eksekusi; pantau deadline bridging 6 Nov', 'Bridging berakhir 2026-11-06; definitive plan perlu status',
      'Eskalasi ke Tribe untuk status pemenuhan definitif', 'Akses penuh OK', 'Talent Buffer', '2026-10-20T09:00:00.000Z', 0, '');

  db.prepare(`INSERT INTO risks (project_id, kind, title, description, impact, owner, due_date, mitigation, status, escalated, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(p1, 'blocker', 'Talent definitif PM belum dikonfirmasi Tribe', 'Bridging 50% FTE berakhir 6 Nov 2026; tidak boleh dijadikan pemenuhan permanen',
      'Kontinuitas Manage Service terancam setelah bridging berakhir', 'Owner Tribe DPS', '2026-11-01',
      'Eskalasi ke Tribe; kandidat definitif harus terkonfirmasi sebelum bridging berakhir', 'open', 1, '2026-10-18T03:00:00.000Z');

  const p2 = db.prepare("SELECT id FROM projects WHERE code = 'PRJ-2026-002'").get().id;
  const dIns = db.prepare('INSERT INTO deliverables (project_id, name, owner_role, status, evidence_url, reviewed_by, due_date, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  dIns.run(p2, 'WBS', 'Project Manager', 'disetujui', 'link-evidence://prj-002/wbs', 'PMO Reviewer', '2026-10-18', t);
  dIns.run(p2, 'BRD', 'PM dan/atau Business Analyst', 'disetujui', 'link-evidence://prj-002/brd', 'Business Owner', '2026-10-18', t);
  dIns.run(p2, 'SAD', 'Solution Architect', 'disetujui', 'link-evidence://prj-002/sad', 'SA Chapter', '2026-10-19', t);
  dIns.run(p2, 'Workforce Plan', 'Solution Architect', 'review', 'link-evidence://prj-002/wfp', 'Chapter DPS', '2026-10-22', t);
  dIns.run(p2, 'Initial Data Solution', 'Data Team', 'dalam_proses', '', 'Data Team Lead', '2026-10-24', t);
  dIns.run(p2, 'Initial Design Documentation', 'Design Team', 'belum_mulai', '', 'Design Team Lead', '2026-10-26', t);
  dIns.run(p2, 'Project Charter', 'Ditandatangani seluruh pemangku kepentingan', 'belum_mulai', '', 'Stakeholder', '2026-10-30', t);

  const p3 = db.prepare("SELECT id FROM projects WHERE code = 'PRJ-2026-003'").get().id;
  db.prepare(`INSERT INTO risks (project_id, kind, title, description, impact, owner, due_date, mitigation, status, escalated, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(p3, 'isu', 'NDE CFU belum terbit', 'Permintaan formal melalui NDE belum diterima',
      'Gate G1 tidak dapat dilewati; mobilisasi tertunda', 'Pemohon CFU', '2026-10-28', 'Follow up ke CFU dan Finance', 'open', 0, '2026-10-15T03:00:00.000Z');

  for (const [pid, gate, action, note, at] of [
    [p1, 'G0', 'Project dibuat (intake SOP-01)', 'Kode PRJ-2026-001; jalur buffer', '2026-10-07T02:00:00.000Z'],
    [p1, 'G2B', 'Gate dinaikkan', 'G2B -> G3', '2026-10-10T05:00:00.000Z'],
    [p2, 'G0', 'Project dibuat (intake SOP-01)', 'Kode PRJ-2026-002; jalur first_responder', '2026-10-10T06:00:00.000Z'],
    [p2, 'G1', 'Gate dinaikkan', 'G1 -> G2A', '2026-10-14T06:00:00.000Z'],
    [p3, 'G0', 'Project dibuat (intake SOP-01)', 'Kode PRJ-2026-003; jalur buffer', '2026-10-12T06:00:00.000Z'],
  ]) {
    db.prepare('INSERT INTO events (project_id, gate, action, actor, note, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(pid, gate, action, 'seed', note, at);
  }
}
seed();

server.listen(PORT, () => {
  console.log(`DDP Project Control berjalan di http://localhost:${PORT}`);
});
