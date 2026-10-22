'use strict';

const assert = require('node:assert');
const test = require('node:test');
const { gateGaps, validateProjectInput, ApiError, FR_DELIVERABLES, BUFFER_CHECKS } = require('../lib/domain');

test('gateGaps: G2A first responder rejects when deliverables not all approved', () => {
  const deliverables = FR_DELIVERABLES.map(([name], i) => ({
    id: i + 1, name, owner_role: 'x', status: i < 3 ? 'disetujui' : 'belum_mulai',
    evidence_url: '', reviewed_by: '', due_date: '', required: 1,
  }));
  const result = gateGaps({ id: 1, track: 'first_responder', gate: 'G2A' }, deliverables, []);
  assert.equal(result.next, 'G3');
  assert.equal(result.gaps.length, 1);
  assert.match(result.gaps[0], /4 deliverable setup wajib belum berstatus disetujui/);
});

test('gateGaps: G2A first responder passes when all deliverables approved', () => {
  const deliverables = FR_DELIVERABLES.map(([name]) => ({
    id: 1, name, owner_role: 'x', status: 'disetujui', evidence_url: '', reviewed_by: '', due_date: '', required: 1,
  }));
  const result = gateGaps({ id: 1, track: 'first_responder', gate: 'G2A' }, deliverables, []);
  assert.equal(result.next, 'G3');
  assert.equal(result.gaps.length, 0);
});

test('gateGaps: G2B buffer rejects when checklist is empty', () => {
  const result = gateGaps({ id: 1, track: 'buffer', gate: 'G2B', procurement_doc: 'PKDF', procurement_target_start: '2026-11-01', procurement_submit_by: '2026-10-20' }, [], []);
  assert.equal(result.next, 'G3');
  assert.ok(result.gaps.some(g => g.includes('Prasyarat teknis Buffer belum lengkap')));
});

test('gateGaps: G2B buffer rejects when checklist items not verified', () => {
  const checks = BUFFER_CHECKS.map((item, i) => ({
    id: i + 1, item, verified: 0, verified_by: '', verified_at: '', notes: '', required: 1,
  }));
  const result = gateGaps({ id: 1, track: 'buffer', gate: 'G2B', procurement_doc: 'PKDF', procurement_target_start: '2026-11-01', procurement_submit_by: '2026-10-20' }, [], checks);
  assert.equal(result.next, 'G3');
  assert.ok(result.gaps.some(g => g.includes('prasyarat teknis Buffer wajib belum terverifikasi')));
});

test('gateGaps: G0 new project rejects without reason_shared_service', () => {
  const result = gateGaps({ id: 1, track: 'first_responder', project_type: 'new', reason_shared_service: '', gate: 'G0' }, [], []);
  assert.equal(result.next, 'G1');
  assert.ok(result.gaps.some(g => g.includes('Alasan penggunaan Shared Service')));
});

test('validateProjectInput accepts first intake track', () => {
  const out = validateProjectInput({ track: 'buffer' }, { track: '', gate: '' });
  assert.equal(out.track, 'buffer');
});

test('validateProjectInput rejects impossible date', () => {
  assert.throws(() => validateProjectInput({ start_date: '2026-13-45' }, { gate: 'G1' }), ApiError);
});

test('validateProjectInput accepts valid date', () => {
  const out = validateProjectInput({ start_date: '2026-10-15' }, { gate: 'G1' });
  assert.equal(out.start_date, '2026-10-15');
});

test('validateProjectInput preserves empty string for optional fields', () => {
  const out = validateProjectInput({ nde_no: '', notes: '' }, { gate: 'G1', nde_no: 'OLD' });
  assert.equal(out.nde_no, '');
  assert.equal(out.notes, '');
});

test('gateGaps: G1 first responder requires NDE, budget, and BO/PM', () => {
  const result = gateGaps({
    id: 1, track: 'first_responder', project_type: 'new', reason_shared_service: 'x',
    nde_no: '', nde_date: '', budget_status: 'belum_diajukan', customer_cfu: '',
    tribe_unit: '', business_owner: '', pm: '', gate: 'G1'
  }, [], []);
  assert.equal(result.next, 'G2A');
  assert.ok(result.gaps.some(g => g.includes('NDE permintaan CFU')));
  assert.ok(result.gaps.some(g => g.includes('Anggaran')));
});
