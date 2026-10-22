'use strict';

const { generateToken } = require('./auth');

const TRUSTED_ORIGINS = new Set();
function loadTrustedOrigins() {
  TRUSTED_ORIGINS.clear();
  const env = process.env.TRUSTED_ORIGINS || '';
  for (const o of env.split(',')) {
    const trimmed = o.trim();
    if (trimmed) TRUSTED_ORIGINS.add(trimmed.toLowerCase());
  }
  // Always trust same-origin requests when no explicit origin header is present.
  // Origins listed here are matched case-insensitively.
}
loadTrustedOrigins();

function getRequestId(req) {
  return req.headers['x-request-id'] || generateToken().slice(0, 16);
}

function securityHeaders(res, isApi) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Strict CSP for an internal admin app. No inline scripts/styles allowed.
  // Frontend must load all JS/CSS from same origin or nonces (not implemented).
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests");
  if (isApi) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}

function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // Same-origin browser request or non-browser client.
  const host = req.headers.host;
  // Exact match against configured trusted origins (scheme+host).
  if (TRUSTED_ORIGINS.has(origin.toLowerCase())) return true;
  // Derive expected origin from Host header for same-origin requests.
  const proto = (req.headers['x-forwarded-proto'] || 'http').toString().split(',')[0].trim();
  if (host && origin.toLowerCase() === `${proto}://${host}`.toLowerCase()) return true;
  return false;
}

function requireSameOrigin(req) {
  return originAllowed(req);
}

// Rate limiter with bounded memory. Keyed by identity (user id or session token)
// with a fallback to IP only for unauthenticated requests. Entries expire
// lazily when their window passes; a periodic sweep keeps the map small.
class RateLimiter {
  constructor({ windowMs = 60000, max = 120, sweepIntervalMs = 300000 } = {}) {
    this.windowMs = windowMs;
    this.max = max;
    this.buckets = new Map();
    this.sweepIntervalMs = sweepIntervalMs;
    this.lastSweep = Date.now();
  }

  key(req, identity) {
    const ip = ((req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').toString().split(',')[0] || 'unknown').trim();
    if (identity) return `u:${identity}`;
    return `ip:${ip}`;
  }

  sweepIfNeeded() {
    const now = Date.now();
    if (now - this.lastSweep < this.sweepIntervalMs) return;
    for (const [k, v] of this.buckets) {
      if (now > v.reset) this.buckets.delete(k);
    }
    this.lastSweep = now;
  }

  isLimited(req, identity) {
    this.sweepIfNeeded();
    const now = Date.now();
    const k = this.key(req, identity);
    let bucket = this.buckets.get(k);
    if (!bucket || now > bucket.reset) {
      bucket = { count: 0, reset: now + this.windowMs };
      this.buckets.set(k, bucket);
    }
    bucket.count += 1;
    return bucket.count > this.max;
  }

  reset() {
    this.buckets.clear();
  }
}

const rateLimiter = new RateLimiter({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  max: Number(process.env.RATE_LIMIT_MAX || 120),
});

module.exports = {
  getRequestId,
  securityHeaders,
  originAllowed,
  requireSameOrigin,
  RateLimiter,
  rateLimiter,
  loadTrustedOrigins,
};
