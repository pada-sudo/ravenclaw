-- Migration 002: indexes, soft delete, required flags, and counters
-- Note: prev_gate, deleted_at, and required flags are already present in
-- migration 001 in the current codebase. This file now only ensures indexes.

CREATE INDEX IF NOT EXISTS idx_deliverables_project_id ON deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_buffer_checks_project_id ON buffer_checks(project_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_project_id ON weekly_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_risks_project_id ON risks(project_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_project_id ON change_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_events_project_id_created_at ON events(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gate_notes_project_id ON gate_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_status_gate ON projects(status, gate);
