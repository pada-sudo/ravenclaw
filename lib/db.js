'use strict';

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'ddp.sqlite'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

function getUserVersion() {
  return db.prepare('PRAGMA user_version').get().user_version;
}

function setUserVersion(v) {
  db.prepare(`PRAGMA user_version = ${v}`).run();
}

function runMigrations() {
  const target = 2;
  let current = getUserVersion();
  if (current >= target) return;

  db.exec('BEGIN EXCLUSIVE');
  try {
    current = getUserVersion();
    if (current < 1) {
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
          updated_at TEXT NOT NULL,
          deleted_at TEXT DEFAULT ''
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
          updated_at TEXT NOT NULL,
          required INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS buffer_checks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          item TEXT NOT NULL,
          verified INTEGER NOT NULL DEFAULT 0,
          evidence TEXT DEFAULT '',
          verified_by TEXT DEFAULT '',
          verified_at TEXT DEFAULT '',
          notes TEXT DEFAULT '',
          required INTEGER NOT NULL DEFAULT 0
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
          actor TEXT NOT NULL DEFAULT 'system',
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
        CREATE TABLE IF NOT EXISTS project_counters (
          year INTEGER PRIMARY KEY,
          last_number INTEGER NOT NULL DEFAULT 0
        );
      `);
      setUserVersion(1);
    }
    if (current < 2) {
      const cols = db.prepare('PRAGMA table_info(projects)').all().map(c => c.name);
      if (!cols.includes('prev_gate')) {
        db.exec("ALTER TABLE projects ADD COLUMN prev_gate TEXT DEFAULT ''");
      }
      if (!cols.includes('deleted_at')) {
        db.exec("ALTER TABLE projects ADD COLUMN deleted_at TEXT DEFAULT ''");
      }
      const dcols = db.prepare('PRAGMA table_info(deliverables)').all().map(c => c.name);
      if (!dcols.includes('required')) {
        db.exec("ALTER TABLE deliverables ADD COLUMN required INTEGER NOT NULL DEFAULT 0");
      }
      const bcols = db.prepare('PRAGMA table_info(buffer_checks)').all().map(c => c.name);
      if (!bcols.includes('required')) {
        db.exec("ALTER TABLE buffer_checks ADD COLUMN required INTEGER NOT NULL DEFAULT 0");
      }
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_deliverables_project_id ON deliverables(project_id);
        CREATE INDEX IF NOT EXISTS idx_buffer_checks_project_id ON buffer_checks(project_id);
        CREATE INDEX IF NOT EXISTS idx_weekly_reports_project_id ON weekly_reports(project_id);
        CREATE INDEX IF NOT EXISTS idx_risks_project_id ON risks(project_id);
        CREATE INDEX IF NOT EXISTS idx_change_requests_project_id ON change_requests(project_id);
        CREATE INDEX IF NOT EXISTS idx_events_project_id_created_at ON events(project_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_gate_notes_project_id ON gate_notes(project_id);
        CREATE INDEX IF NOT EXISTS idx_projects_status_gate ON projects(status, gate);
      `);
      setUserVersion(2);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
runMigrations();

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

function actorFrom(req) {
  const id = (req.headers['x-actor-id'] || '').toString().trim().slice(0, 100);
  const name = (req.headers['x-actor-name'] || '').toString().trim().slice(0, 200);
  if (name && id) return `${name} [${id}]`;
  if (name) return name;
  if (id) return `[${id}]`;
  return 'operator web';
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
  db, withTx, actorFrom, logEvent, nextProjectCode, now, s,
};
