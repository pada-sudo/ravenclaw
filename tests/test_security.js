'use strict';

process.env.DATA_DIR = require('node:path').join(__dirname, '..', 'data', 'test-security');

const assert = require('node:assert');
const test = require('node:test');
const { RateLimiter } = require('../lib/security');

test('RateLimiter keys authenticated identities separately from IP', () => {
  const limiter = new RateLimiter({ windowMs: 60000, max: 3 });
  const req = { headers: {}, socket: { remoteAddress: '10.0.0.1' } };

  assert.equal(limiter.isLimited(req, 'user:alice'), false);
  assert.equal(limiter.isLimited(req, 'user:alice'), false);
  assert.equal(limiter.isLimited(req, 'user:alice'), false);
  assert.equal(limiter.isLimited(req, 'user:alice'), true);

  // Same IP but different authenticated identity should not be limited yet.
  assert.equal(limiter.isLimited(req, 'user:bob'), false);

  // Unauthenticated (IP-only) identity also has its own bucket.
  assert.equal(limiter.isLimited(req, null), false);
  assert.equal(limiter.isLimited(req, null), false);
  assert.equal(limiter.isLimited(req, null), false);
  assert.equal(limiter.isLimited(req, null), true);
});

test('RateLimiter sweep removes expired buckets', () => {
  const limiter = new RateLimiter({ windowMs: 10, max: 1, sweepIntervalMs: 0 });
  const req = { headers: {}, socket: { remoteAddress: '10.0.0.2' } };
  limiter.isLimited(req, 'user:sweep');
  assert.equal(limiter.buckets.size, 1);
  // Wait for window to expire, then trigger sweep via a new request.
  return new Promise(resolve => {
    setTimeout(() => {
      limiter.isLimited(req, 'user:sweep');
      assert.equal(limiter.buckets.size, 1); // old bucket replaced by new one
      limiter.lastSweep = 0;
      limiter.isLimited(req, 'user:sweep');
      assert.equal(limiter.buckets.size, 1);
      resolve();
    }, 20);
  });
});
