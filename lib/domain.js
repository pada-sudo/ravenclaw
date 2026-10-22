'use strict';

const { db } = require('./db');

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
const GATE_NEXT = {
  first_responder: ['G0', 'G1', 'G2A', 'G3', 'G4', 'G5', 'CLOSED'],
  buffer: ['G0', 'G1', 'G2B', 'G3', 'G4', 'G5', 'CLOSED'],
};
const REQUIRED_FR_COUNT = FR_DELIVERABLES.length;
const REQUIRED_BUFFER_COUNT = BUFFER_CHECKS.length;

class ApiError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra || {};
  }
}

function int(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function bool01(v) {
  return (v === 1 || v === true || v === '1' || v === 'true') ? 1 : 0;
}

function oneOf(v, list, fallback) {
  return list.includes(v) ? v : fallback;
}

function s(v, max = 1000) {
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, max);
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function parseDateUTC(dateStr) {
  if (!dateStr) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const ts = Date.UTC(y, m - 1, d);
  if (Number.isNaN(ts)) return null;
  const back = new Date(ts).toISOString().slice(0, 10);
  if (back !== dateStr) return null;
  if (y < 1000 || y > 9999) return null;
  return ts;
}

function validateDateField(v, name) {
  const str = s(v, 20);
  if (str === '') return '';
  if (!parseDateUTC(str)) throw new ApiError(422, `Tanggal tidak valid untuk ${name}: ${v}`);
  return str;
}

function daysBetween(fromISO, toISO) {
  const a = parseDateUTC(fromISO);
  const b = parseDateUTC(toISO);
  if (a === null || b === null) return null;
  return Math.floor((b - a) / 86400000);
}

function addDays(dateStr, n) {
  const ts = parseDateUTC(dateStr || todayUTC());
  if (ts === null) return '';
  const d = new Date(ts + n * 86400000);
  return d.toISOString().slice(0, 10);
}

function getProject(id, includeDeleted = false) {
  const extra = includeDeleted ? '' : " AND deleted_at = ''";
  const p = db.prepare(`SELECT * FROM projects WHERE id = ?${extra}`).get(int(id));
  if (!p) throw new ApiError(404, 'Project tidak ditemukan');
  return p;
}

function assertStateConsistent(data, existing) {
  const gate = data.gate !== undefined ? data.gate : existing?.gate;
  const status = data.status !== undefined ? data.status : existing?.status;
  if (gate === 'CLOSED' && status !== 'closed') {
    throw new ApiError(422, 'Gate CLOSED hanya boleh dengan status closed');
  }
  if (status === 'closed' && gate !== 'CLOSED') {
    throw new ApiError(422, 'Status closed hanya boleh dengan gate CLOSED');
  }
}

function gateGaps(p, deliverablesOverride, checksOverride) {
  const gaps = [];
  const seq = GATE_NEXT[p.track];
  const idx = seq ? seq.indexOf(p.gate) : -1;
  if (!seq || idx < 0 || idx >= seq.length - 1) return { next: null, gaps: [] };
  const next = seq[idx + 1];

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
    const deliverables = deliverablesOverride || db.prepare('SELECT * FROM deliverables WHERE project_id = ? AND required = 1').all(p.id);
    if (deliverables.length < REQUIRED_FR_COUNT) {
      gaps.push(`Deliverable wajib First Responder belum lengkap (${deliverables.length}/${REQUIRED_FR_COUNT})`);
    }
    const open = deliverables.filter(d => d.status !== 'disetujui').length;
    if (open > 0) gaps.push(`${open} deliverable setup wajib belum berstatus disetujui (SOP-03)`);
  }
  if (p.gate === 'G2B') {
    const checks = checksOverride || db.prepare('SELECT * FROM buffer_checks WHERE project_id = ? AND required = 1').all(p.id);
    if (checks.length < REQUIRED_BUFFER_COUNT) {
      gaps.push(`Prasyarat teknis Buffer belum lengkap (${checks.length}/${REQUIRED_BUFFER_COUNT})`);
    }
    const open = checks.filter(c => !c.verified).length;
    if (open > 0) gaps.push(`${open} prasyarat teknis Buffer wajib belum terverifikasi (SOP-04, gate B1-B3)`);
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
  const active = db.prepare("SELECT * FROM projects WHERE status != 'closed' AND deleted_at = ''").all();
  const total = active.length || 1;
  const adminReady = active.filter(p => s(p.nde_no) && p.budget_status === 'disetujui' && p.onboarding_status !== 'belum_mulai').length;

  const frProjects = active.filter(p => p.track === 'first_responder');
  const frReadyStmt = db.prepare("SELECT COUNT(*) AS c FROM deliverables WHERE project_id = ? AND required = 1 AND status != 'disetujui'");
  const frReady = frProjects.filter(p => frReadyStmt.get(p.id).c === 0).length;

  const bufProjects = active.filter(p => p.track === 'buffer');
  const bufReadyStmt = db.prepare('SELECT COUNT(*) AS c FROM buffer_checks WHERE project_id = ? AND required = 1 AND verified = 0');
  const bufReady = bufProjects.filter(p => bufReadyStmt.get(p.id).c === 0).length;

  const delivery = active.filter(p => ['G3', 'G4', 'G5'].includes(p.gate));
  const weekAgo = addDays(todayUTC(), -7);
  const reportStmt = db.prepare('SELECT COUNT(*) AS c FROM weekly_reports WHERE project_id = ? AND submitted_at >= ?');
  const reportingOk = delivery.filter(p => reportStmt.get(p.id, weekAgo).c > 0).length;

  const blockers = db.prepare("SELECT r.*, p.code AS project_code, p.name AS project_name FROM risks r JOIN projects p ON p.id = r.project_id WHERE r.kind = 'blocker' AND r.status = 'open' AND p.deleted_at = ''").all();
  const ages = blockers.map(b => daysBetween(b.created_at, new Date().toISOString()) ?? 0);
  const avgAge = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;

  const transitionEligible = bufProjects.filter(p => s(p.bridging_end));
  const transitionReady = transitionEligible.filter(p => s(p.definitive_plan) && (daysBetween(todayUTC(), p.bridging_end) ?? -1) > 0).length;

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
      title: b.title, owner: b.owner, due_date: b.due_date, age_days: daysBetween(b.created_at, new Date().toISOString()),
    })),
  };
}

function validateProjectInput(body, partial) {
  const out = {};
  const dateFields = ['nde_date', 'procurement_target_start', 'start_date', 'end_date', 'bridging_end'];
  const stringFields = {
    name: 300, customer_cfu: 200, tribe_unit: 200, business_owner: 200, pm: 200,
    reason_shared_service: 2000, nde_no: 200, procurement_doc: 100,
    fte: 100, definitive_plan: 2000, notes: 4000,
  };
  const enumFields = {
    project_type: PROJECT_TYPES,
    track: TRACKS,
    budget_status: BUDGET_STATUS,
    onboarding_status: ONBOARDING_STATUS,
    status: ['active', 'pending', 'blocked', 'closed'],
  };

  if (!partial) {
    if (!body.name || !s(body.name)) throw new ApiError(422, 'Nama project wajib diisi');
    if (!TRACKS.includes(body.track)) throw new ApiError(422, 'Jalur (track) wajib first_responder atau buffer');
    if (!PROJECT_TYPES.includes(body.project_type)) throw new ApiError(422, 'Jenis project wajib new atau existing');
  }

  for (const [k, max] of Object.entries(stringFields)) {
    if (body[k] === undefined) continue;
    out[k] = s(body[k], max);
  }
  for (const k of dateFields) {
    if (body[k] === undefined) continue;
    out[k] = validateDateField(body[k], k);
  }
  for (const [k, list] of Object.entries(enumFields)) {
    if (body[k] === undefined) continue;
    if (!list.includes(body[k])) throw new ApiError(422, `Nilai tidak valid untuk field ${k}`);
    out[k] = body[k];
  }
  if (body.bpom_case !== undefined) out.bpom_case = bool01(body.bpom_case);

  if (out.procurement_doc !== undefined && out.procurement_doc !== '' && PROC_LEAD_DAYS[out.procurement_doc] === undefined) {
    throw new ApiError(422, 'Dokumen procurement tidak valid');
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
  if (submitBy < todayUTC()) {
    warning = `Dokumen ${doc} seharusnya sudah diajukan paling lambat ${submitBy} (${lead} hari sebelum mulai) — terlambat ${Math.abs(daysBetween(submitBy, todayUTC()))} hari`;
  }
  return { doc, lead_days: lead, submit_by: submitBy, warning };
}

module.exports = {
  FR_DELIVERABLES, BUFFER_CHECKS, TRACKS, PROJECT_TYPES, GATES_ALL,
  BUDGET_STATUS, ONBOARDING_STATUS, DELIV_STATUS, RISK_KINDS, PROC_LEAD_DAYS,
  GATE_NEXT, REQUIRED_FR_COUNT, REQUIRED_BUFFER_COUNT,
  ApiError, int, bool01, oneOf, s, todayUTC, parseDateUTC, validateDateField,
  daysBetween, addDays, getProject, assertStateConsistent, gateGaps,
  computeKpis, validateProjectInput, procurementInfo,
};
