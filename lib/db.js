'use strict';

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'ddp.sqlite'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

function getUserVersion() {
  return db.prepare('PRAGMA user_version').get().user_version;
}

function setUserVersion(v) {
  db.prepare(`PRAGMA user_version = ${v}`).run();
}

function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d{3}_.*\.sql$/.test(f))
    .sort();
}

function runMigrations() {
  const files = listMigrationFiles();
  const target = files.length;
  let current = getUserVersion();
  if (current >= target) return;

  db.exec('BEGIN EXCLUSIVE');
  try {
    current = getUserVersion();
    for (let i = current; i < target; i += 1) {
      const file = files[i];
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      db.exec(sql);
      setUserVersion(i + 1);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
runMigrations();

function hashPasswordSync(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt.toString('base64')}:${derived.toString('base64')}`;
}

function ensureDefaultUsers() {
  const users = [
    { username: 'operator', full_name: 'Operator Demo', role: 'operator', password: 'operator' },
    { username: 'pm', full_name: 'Project Manager Demo', role: 'pm', password: 'pm' },
    { username: 'approver', full_name: 'Approver Demo', role: 'approver', password: 'approver' },
    { username: 'auditor', full_name: 'Auditor Demo', role: 'auditor', password: 'auditor' },
  ];
  for (const u of users) {
    const hash = hashPasswordSync(u.password);
    db.prepare(`INSERT OR IGNORE INTO users
      (username, full_name, role, password_hash, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)`)
      .run(u.username, u.full_name, u.role, hash, now(), now());
  }
}
ensureDefaultUsers();

function withTx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function actorFrom(req, session) {
  if (session) return `${session.fullName || session.username} [${session.role}]`;
  const id = (req.headers['x-actor-id'] || '').toString().trim().slice(0, 100);
  const name = (req.headers['x-actor-name'] || '').toString().trim().slice(0, 200);
  if (name && id) return `${name} [${id}]`;
  if (name) return name;
  if (id) return `[${id}]`;
  return 'system';
}

function now() {
  return new Date().toISOString();
}

function s(v, max = 1000) {
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, max);
}

function logEvent(actor, projectId, gate, action, note) {
  db.prepare('INSERT INTO events (project_id, gate, action, actor, note, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(projectId || null, gate, action, actor || 'system', s(note, 2000), now());
}

function nextProjectCode() {
  const year = new Date().getUTCFullYear();
  return withTx(() => {
    const existing = db.prepare("SELECT MAX(CAST(SUBSTR(code, 10) AS INTEGER)) AS m FROM projects WHERE code LIKE ?").get(`PRJ-${year}-%`).m || 0;
    const counter = db.prepare('SELECT last_number FROM project_counters WHERE year = ?').get(year);
    const start = Math.max(existing, counter ? counter.last_number : 0);
    db.prepare('INSERT OR REPLACE INTO project_counters (year, last_number) VALUES (?, ?)').run(year, start + 1);
    return `PRJ-${year}-${String(start + 1).padStart(3, '0')}`;
  });
}

module.exports = {
  db, withTx, actorFrom, logEvent, nextProjectCode, now, s, DATA_DIR,
};
