'use strict';

const assert = require('node:assert');
const test = require('node:test');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');

let baseUrl;
let serverProc;

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const opts = { method, headers: {} };
    if (body) { opts.headers['Content-Type'] = 'application/json'; }
    const r = http.request(url, opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data || '{}') }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

test.before(async () => {
  await new Promise((resolve, reject) => {
    const env = { ...process.env, PORT: '0', NODE_ENV: 'test' };
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

test('POST /api/projects then DELETE then POST again yields unique code', async () => {
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
  const res = await req('POST', '/api/projects/2/advance');
  assert.equal(res.status, 422);
  assert.equal(res.body.error, 'Syarat gate belum terpenuhi');
  assert.ok(res.body.gaps.length > 0);
  assert.ok(res.body.gaps.some(g => g.includes('deliverable setup wajib')));
});

test('PUT /api/projects/:id rejects track change after intake', async () => {
  const create = await req('POST', '/api/projects', { name: 'HTTP Track', project_type: 'new', track: 'first_responder', reason_shared_service: 'r' });
  assert.equal(create.status, 200);
  const res = await req('PUT', `/api/projects/${create.body.id}`, { track: 'buffer' });
  assert.equal(res.status, 422);
  assert.match(res.body.error, /Track tidak boleh diubah/);
});

test('DELETE required deliverable on active project is rejected', async () => {
  const prj = await req('GET', '/api/projects/2');
  assert.equal(prj.status, 200);
  const did = prj.body.deliverables[0].id;
  const res = await req('DELETE', `/api/projects/2/deliverables/${did}`);
  assert.equal(res.status, 422);
  assert.match(res.body.error, /tidak boleh dihapus/);
});

test('PUT /api/projects/:id rejects impossible date', async () => {
  const create = await req('POST', '/api/projects', { name: 'HTTP Date', project_type: 'new', track: 'first_responder', reason_shared_service: 'r' });
  const res = await req('PUT', `/api/projects/${create.body.id}`, { start_date: '2026-13-45' });
  assert.equal(res.status, 422);
  assert.match(res.body.error, /Tanggal tidak valid/);
});

test('GET /api/projects supports pagination', async () => {
  const res = await req('GET', '/api/projects?limit=1');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 1);
  assert.ok(res.body.pagination);
  assert.ok(res.body.pagination.total >= 3);
});

test('Soft delete hides project from default list but keeps with include_deleted', async () => {
  const create = await req('POST', '/api/projects', { name: 'HTTP Soft', project_type: 'new', track: 'first_responder', reason_shared_service: 'r' });
  await req('DELETE', `/api/projects/${create.body.id}`);
  const all = await req('GET', '/api/projects');
  const included = await req('GET', '/api/projects?include_deleted=true');
  assert.ok(!all.body.data.some(p => p.id === create.body.id));
  assert.ok(included.body.data.some(p => p.id === create.body.id));
});
