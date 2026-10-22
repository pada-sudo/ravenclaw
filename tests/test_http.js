'use strict';

const path = require('node:path');
process.env.DATA_DIR = path.join(__dirname, '..', 'data', 'test-http');

const assert = require('node:assert');
const test = require('node:test');
const http = require('node:http');
const { spawn } = require('node:child_process');

let baseUrl;
let serverProc;
let cookieJar = {};

function parseCookies(setCookieHeader) {
  if (!setCookieHeader) return {};
  const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  const out = {};
  for (const h of headers) {
    const [pair] = h.split(';');
    const [k, v] = pair.trim().split('=');
    if (k) out[k] = decodeURIComponent(v || '');
  }
  return out;
}

function cookieHeader() {
  const pairs = Object.entries(cookieJar).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  return pairs.length ? pairs.join('; ') : undefined;
}

function req(method, path, body, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = { ...opts.headers };
    if (body) headers['Content-Type'] = 'application/json';
    const ch = cookieHeader();
    if (ch) headers.Cookie = ch;
    const r = http.request(url, { method, headers }, res => {
      let data = '';
      const cookies = parseCookies(res.headers['set-cookie']);
      Object.assign(cookieJar, cookies);
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data || '{}'), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, body: data, headers: res.headers }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function login(role) {
  cookieJar = {};
  const credentials = { operator: { username: 'operator', password: 'operator' }, pm: { username: 'pm', password: 'pm' }, approver: { username: 'approver', password: 'approver' }, auditor: { username: 'auditor', password: 'auditor' } };
  const res = await req('POST', '/api/auth/login', credentials[role] || credentials.operator);
  assert.equal(res.status, 200, `login as ${role} failed: ${JSON.stringify(res.body)}`);
  assert.equal(cookieJar.ddp_session?.length > 0, true);
  return res.body.user;
}

async function logout() {
  await req('POST', '/api/auth/logout');
  cookieJar = {};
}

test.before(async () => {
  await new Promise((resolve, reject) => {
    const env = { ...process.env, PORT: '0', NODE_ENV: 'test', RATE_LIMIT_MAX: '50' };
    serverProc = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, cwd: path.join(__dirname, '..') });
    let ready = false;
    serverProc.stdout.on('data', d => {
      const m = d.toString().match(/http:\/\/[^:]+:(\d+)/);
      if (m && !ready) {
        baseUrl = `http://localhost:${m[1]}`;
        ready = true;
        resolve();
      }
    });
    serverProc.stderr.on('data', d => {
      if (!ready) process.stderr.write(d);
    });
    serverProc.on('error', reject);
    setTimeout(() => reject(new Error('server start timeout')), 10000);
  });
});

test.after(async () => {
  if (serverProc) {
    serverProc.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
    if (!serverProc.killed) serverProc.kill('SIGKILL');
  }
});

test('anonymous requests are rejected', async () => {
  await logout();
  const res = await req('GET', '/api/projects');
  assert.equal(res.status, 401);
  const post = await req('POST', '/api/projects', { name: 'X', project_type: 'new', track: 'first_responder', reason_shared_service: 'r' });
  assert.equal(post.status, 401);
});

test('login and logout work', async () => {
  await login('operator');
  const session = await req('GET', '/api/auth/session');
  assert.equal(session.status, 200);
  assert.equal(session.body.user.role, 'operator');
  await logout();
  const after = await req('GET', '/api/auth/session');
  assert.equal(after.status, 401);
});

test('POST /api/projects then DELETE then POST again yields unique code', async () => {
  await login('approver');
  const a = await req('POST', '/api/projects', { name: 'HTTP A', project_type: 'new', track: 'first_responder', reason_shared_service: 'r' });
  assert.equal(a.status, 200);
  assert.match(a.body.code, /PRJ-\d{4}-\d{3}/);
  const del = await req('DELETE', `/api/projects/${a.body.id}`);
  assert.equal(del.status, 200);
  const b = await req('POST', '/api/projects', { name: 'HTTP B', project_type: 'new', track: 'first_responder', reason_shared_service: 'r' });
  assert.equal(b.status, 200);
  assert.notEqual(a.body.code, b.body.code);
});

test('POST /api/projects/:id/advance returns 422 with gaps when incomplete', async () => {
  await login('operator');
  const res = await req('POST', '/api/projects/2/advance');
  assert.equal(res.status, 422);
  assert.equal(res.body.error, 'Syarat gate belum terpenuhi');
  assert.ok(res.body.gaps.length > 0);
  assert.ok(res.body.gaps.some(g => g.includes('deliverable setup wajib')));
});

test('operator cannot force advance', async () => {
  await login('operator');
  const res = await req('POST', '/api/projects/2/advance', { force: 1, force_reason: 'test' });
  assert.equal(res.status, 403);
});

test('approver can force advance with reason', async () => {
  await login('approver');
  const res = await req('POST', '/api/projects/2/advance', { force: 1, force_reason: 'uji eskalasi' });
  assert.equal(res.status, 200);
  assert.equal(res.body.forced, true);
});

test('PUT /api/projects/:id rejects track change after intake', async () => {
  await login('operator');
  const create = await req('POST', '/api/projects', { name: 'HTTP Track', project_type: 'new', track: 'first_responder', reason_shared_service: 'r' });
  assert.equal(create.status, 200);
  const res = await req('PUT', `/api/projects/${create.body.id}`, { track: 'buffer' });
  assert.equal(res.status, 422);
  assert.match(res.body.error, /Track tidak boleh diubah/);
});

test('DELETE required deliverable on active project is rejected', async () => {
  await login('operator');
  const prj = await req('GET', '/api/projects/2');
  assert.equal(prj.status, 200);
  const did = prj.body.deliverables[0].id;
  const res = await req('DELETE', `/api/projects/2/deliverables/${did}`);
  assert.equal(res.status, 422);
  assert.match(res.body.error, /tidak boleh dihapus/);
});

test('PUT /api/projects/:id rejects impossible date', async () => {
  await login('operator');
  const create = await req('POST', '/api/projects', { name: 'HTTP Date', project_type: 'new', track: 'first_responder', reason_shared_service: 'r' });
  const res = await req('PUT', `/api/projects/${create.body.id}`, { start_date: '2026-13-45' });
  assert.equal(res.status, 422);
  assert.match(res.body.error, /Tanggal tidak valid/);
});

test('GET /api/projects supports pagination', async () => {
  await login('auditor');
  const res = await req('GET', '/api/projects?limit=1');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 1);
  assert.ok(res.body.pagination);
  assert.ok(res.body.pagination.total >= 3);
});

test('auditor cannot mutate projects', async () => {
  await login('auditor');
  const create = await req('POST', '/api/projects', { name: 'Auditor Create', project_type: 'new', track: 'first_responder', reason_shared_service: 'r' });
  assert.equal(create.status, 403);
});

test('Soft delete hides project from default list but keeps with include_deleted', async () => {
  await login('approver');
  const create = await req('POST', '/api/projects', { name: 'HTTP Soft', project_type: 'new', track: 'first_responder', reason_shared_service: 'r' });
  await req('DELETE', `/api/projects/${create.body.id}`);
  const all = await req('GET', '/api/projects');
  const included = await req('GET', '/api/projects?include_deleted=true');
  assert.ok(!all.body.data.some(p => p.id === create.body.id));
  assert.ok(included.body.data.some(p => p.id === create.body.id));
});

test('security headers are present on API responses', async () => {
  await login('auditor');
  const res = await req('GET', '/api/projects');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.ok(res.headers['content-security-policy']);
  assert.match(res.headers['cache-control'], /no-store/);
});

test('rate limit returns 429 after many unauthenticated requests', async () => {
  await logout();
  let hit429 = false;
  for (let i = 0; i < 60; i += 1) {
    const res = await req('GET', '/api/projects');
    if (res.status === 429) { hit429 = true; break; }
    if (res.status !== 401) break;
  }
  assert.equal(hit429, true);
});
