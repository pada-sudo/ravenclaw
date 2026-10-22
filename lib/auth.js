'use strict';

const crypto = require('node:crypto');
const { db, withTx, s, now } = require('./db');
const { ApiError } = require('./domain');

const ROLES = Object.freeze({
  OPERATOR: 'operator',
  PM: 'pm',
  APPROVER: 'approver',
  AUDITOR: 'auditor',
});

const ROLE_ORDER = Object.freeze([ROLES.OPERATOR, ROLES.PM, ROLES.APPROVER, ROLES.AUDITOR]);

// Permission matrix. Rows are roles (including anonymous), columns are actions.
const PERMISSIONS = Object.freeze({
  read: { roles: [ROLES.OPERATOR, ROLES.PM, ROLES.APPROVER, ROLES.AUDITOR] },
  write_project: { roles: [ROLES.OPERATOR, ROLES.PM, ROLES.APPROVER] },
  pm_action: { roles: [ROLES.PM, ROLES.APPROVER] },
  approver_action: { roles: [ROLES.APPROVER] },
});

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const SESSION_COOKIE = 'ddp_session';
const SESSION_PREFIX = 'ddp:sess:';

function roleLevel(role) {
  return ROLE_ORDER.indexOf(role);
}

function hasPermission(role, action) {
  const perm = PERMISSIONS[action];
  if (!perm) return false;
  return perm.roles.includes(role);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64, SCRYPT_PARAMS);
  return `${salt.toString('base64')}:${derived.toString('base64')}`;
}

async function hashPasswordAsync(password) {
  return hashPassword(password);
}

function verifyPassword(password, stored) {
  return new Promise((resolve, reject) => {
    const [saltB64, hashB64] = stored.split(':');
    if (!saltB64 || !hashB64) return resolve(false);
    const salt = Buffer.from(saltB64, 'base64');
    crypto.scrypt(password, salt, 64, SCRYPT_PARAMS, (err, derived) => {
      if (err) return reject(err);
      resolve(crypto.timingSafeEqual(derived, Buffer.from(hashB64, 'base64')));
    });
  });
}

function generateToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function sessionKey(token) {
  return `${SESSION_PREFIX}${token}`;
}

function createSession(userId, ttlSeconds) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(sessionKey(token), userId, expiresAt, now());
  return { token, expiresAt };
}

function getSession(token) {
  if (!token) return null;
  const row = db.prepare(`SELECT s.*, u.id AS user_id, u.username, u.full_name, u.role, u.active
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?`).get(sessionKey(token), now());
  if (!row || !row.active) return null;
  return {
    id: row.user_id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
  };
}

function deleteSession(token) {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token = ?').run(sessionKey(token));
}

function cleanupExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now());
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

function sessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  return getSession(cookies[SESSION_COOKIE]);
}

function ensureAuth(req) {
  const session = sessionFromRequest(req);
  if (!session) throw new ApiError(401, 'Autentikasi diperlukan');
  return session;
}

function requireRole(session, action) {
  if (!session || !hasPermission(session.role, action)) {
    throw new ApiError(403, 'Akses ditolak');
  }
}

function setSessionCookie(res, token, maxAgeSeconds, secure) {
  const flags = [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSeconds}`, 'Path=/'];
  if (secure) flags.push('Secure');
  res.setHeader('Set-Cookie', flags.join('; '));
}

function clearSessionCookie(res, secure) {
  const flags = [`${SESSION_COOKIE}=`, 'HttpOnly', 'SameSite=Strict', 'Max-Age=0', 'Path=/'];
  if (secure) flags.push('Secure');
  res.setHeader('Set-Cookie', flags.join('; '));
}

module.exports = {
  ROLES,
  PERMISSIONS,
  SESSION_COOKIE,
  hasPermission,
  hashPassword,
  hashPasswordAsync,
  verifyPassword,
  createSession,
  getSession,
  deleteSession,
  cleanupExpiredSessions,
  sessionFromRequest,
  ensureAuth,
  requireRole,
  setSessionCookie,
  clearSessionCookie,
  generateToken,
};
