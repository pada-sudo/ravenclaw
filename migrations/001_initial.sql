-- Migration 001: base schema
-- Applied by lib/db.js runMigrations() using PRAGMA user_version.

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
