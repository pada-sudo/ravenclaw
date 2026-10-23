'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

require('./lib/db');
const { buildRoutes, resFor } = require('./lib/routes');
const { FR_DELIVERABLES, PRD_EXTRA_DELIVERABLES, BUFFER_CHECKS, ApiError } = require('./lib/domain');
const { db, withTx, logEvent, now, s } = require('./lib/db');
const {
  getRequestId, securityHeaders, requireSameOrigin,
  rateLimiter,
} = require('./lib/security');
const { sessionFromRequest, cleanupExpiredSessions } = require('./lib/auth');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(__dirname, 'public');
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const routes = buildRoutes();

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

function writeJson(res, status, payload, isApi) {
  securityHeaders(res, isApi);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function logRequest({ requestId, method, path, status, durationMs, actor, error }) {
  if (LOG_LEVEL === 'silent') return;
  const line = {
    timestamp: now(),
    request_id: requestId,
    method,
    path,
    status,
    duration_ms: durationMs,
    actor: actor || 'anonymous',
  };
  if (error) {
    line.error = error;
  }
  console.log(JSON.stringify(line));
}

function seed() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM projects').get().c;
  if (count > 0) return;
  const t = now();
  const ins = db.prepare(`INSERT INTO projects
    (code, name, customer_cfu, tribe_unit, business_owner, pm, project_type, track, reason_shared_service,
     nde_no, nde_date, budget_status, procurement_doc, procurement_target_start, procurement_submit_by,
     onboarding_status, gate, status, fte, start_date, end_date, bridging_end, bpom_case, definitive_plan, notes, created_at, updated_at, deleted_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  ins.run('PRJ-2026-001', 'Dukungan PM BPOM - Delivery & Manage Service', 'BPOM', 'Tribe DPS', 'BPOM Business Owner', 'PM Buffer DPS',
    'existing', 'buffer', 'Kasus khusus Nota Dinas C.Tel.87/PS 000/DDP-B0200000/2026 - bridging PM Buffer 50% FTE',
    'NDE-BPOM/2026/014', '2026-10-05', 'disetujui', '', '', '', 'selesai', 'G3', 'active', '50%', '2026-10-07', '2026-11-06',
    '2026-11-06', 1, 'Tribe melakukan pemenuhan talent definitif paralel untuk Delivery dan Manage Service',
    'Kebutuhan: 70% FTE Delivery (3 bulan) + 30% FTE Manage Service. Dukungan DPS: 50% FTE maksimal 4 minggu.', t, t, '');

  ins.run('PRJ-2026-002', 'Setup Proyek Analitik Pelanggan', 'CFU Telkom Regional 1', 'Tribe Data', 'Owner CFU', 'PM First Responder',
    'new', 'first_responder', 'Presales-support dan setup awal proyek baru pascakontrak',
    'NDE-CFU/2026/032', '2026-10-10', 'disetujui', 'PKDF', '2026-12-15', '2026-10-16', 'berjalan', 'G2A', 'active', '', '2026-10-20', '', '', 0, '', '', t, t, '');

  ins.run('PRJ-2026-003', 'Pengembangan Fitur Aplikasi Internal', 'CFU Enterprise', 'Tribe Apps', 'Owner Enterprise', 'PM Enterprise',
    'existing', 'buffer', 'Eksekusi proyek berjalan dengan kontrak jelas; procurement tahap akhir',
    '', '', 'diajukan', 'Surat Pesanan dengan new item', '2026-11-10', '2026-10-11', 'belum_mulai', 'G1', 'pending', '100%', '', '', '', 0, '', '', t, t, '');

  const p1 = db.prepare("SELECT id FROM projects WHERE code = 'PRJ-2026-001'").get().id;
  const bIns = db.prepare('INSERT INTO buffer_checks (project_id, item, verified, verified_by, verified_at, notes, required) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (let i = 0; i < BUFFER_CHECKS.length; i++) {
    const verified = i < 6 ? 1 : 0;
    bIns.run(p1, BUFFER_CHECKS[i], verified, verified ? 'Reviewer' : '', verified ? '2026-10-08' : '', '', 1);
  }

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
  const dIns = db.prepare('INSERT INTO deliverables (project_id, name, owner_role, status, evidence_url, reviewed_by, due_date, updated_at, required) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const frStatuses = ['disetujui', 'disetujui', 'disetujui', 'review', 'dalam_proses', 'belum_mulai', 'belum_mulai'];
  for (let i = 0; i < FR_DELIVERABLES.length; i++) {
    const [name, role] = FR_DELIVERABLES[i];
    dIns.run(p2, name, role, frStatuses[i], '', '', '', t, 1);
  }
  for (const [name, role] of PRD_EXTRA_DELIVERABLES) dIns.run(p2, name, role, 'belum_mulai', '', '', '', t, 0);

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

const server = http.createServer(async (req, res) => {
  const requestId = getRequestId(req);
  req._response = res;
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const started = Date.now();
  let status = 200;
  let actor = null;
  let isApi = false;

  try {
    // Health check first, no auth required.
    if (url.pathname === '/healthz') {
      securityHeaders(res, true);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ status: 'ok', timestamp: now() }));
    }

    // CSRF / origin check for mutating requests.
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      if (!requireSameOrigin(req)) {
        throw new ApiError(403, 'Origin tidak diizinkan');
      }
    }

    // Rate limit by authenticated identity or IP fallback.
    const session = sessionFromRequest(req);
    actor = session ? `${session.username}:${session.role}` : null;
    if (rateLimiter.isLimited(req, actor)) {
      throw new ApiError(429, 'Terlalu banyak permintaan, coba lagi nanti');
    }

    if (url.pathname.startsWith('/api/')) {
      isApi = true;
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = url.pathname.match(r.rx);
        if (!m) continue;
        const params = {};
        r.names.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
        const body = (req.method === 'POST' || req.method === 'PUT') ? await readBody(req) : {};
        const out = await Promise.resolve(r.handler(params, url.searchParams, body, req));
        securityHeaders(res, true);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify(out));
      }
      throw new ApiError(404, 'Endpoint tidak ditemukan');
    }

    if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
    serveStatic(res, url.pathname);
  } catch (err) {
    status = err instanceof ApiError ? err.status : 500;
    const isServerError = status >= 500;
    const message = isServerError ? 'Kesalahan server' : (err.message || 'Kesalahan');
    const sessionForLog = sessionFromRequest(req);
    const actorForLog = actor || (sessionForLog ? `${sessionForLog.username}:${sessionForLog.role}` : 'anonymous');
    logRequest({ requestId, method: req.method, path: url.pathname, status, durationMs: Date.now() - started, actor: actorForLog, error: isServerError ? err.stack || err.message : undefined });
    const payload = { error: message };
    if (err instanceof ApiError && err.extra) Object.assign(payload, err.extra);
    writeJson(res, status, payload, isApi || url.pathname === '/healthz');
    return;
  }
  logRequest({ requestId, method: req.method, path: url.pathname, status, durationMs: Date.now() - started, actor });
});

// Periodic maintenance: expired sessions cleanup.
setInterval(() => {
  try { cleanupExpiredSessions(); }
  catch (err) { console.error(JSON.stringify({ timestamp: now(), event: 'cleanup_failed', error: err.message })); }
}, 300000);

server.listen(PORT, () => {
  const addr = server.address();
  console.log(`RavenClaw berjalan di http://localhost:${addr.port}`);
});
