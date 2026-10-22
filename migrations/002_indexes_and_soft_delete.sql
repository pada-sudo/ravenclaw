-- Migration 002: indexes, soft delete, required flags, and counters

ALTER TABLE projects ADD COLUMN prev_gate TEXT DEFAULT '';
ALTER TABLE projects ADD COLUMN deleted_at TEXT DEFAULT '';
ALTER TABLE deliverables ADD COLUMN required INTEGER NOT NULL DEFAULT 0;
ALTER TABLE buffer_checks ADD COLUMN required INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_deliverables_project_id ON deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_buffer_checks_project_id ON buffer_checks(project_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_project_id ON weekly_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_risks_project_id ON risks(project_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_project_id ON change_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_events_project_id_created_at ON events(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gate_notes_project_id ON gate_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_status_gate ON projects(status, gate);
