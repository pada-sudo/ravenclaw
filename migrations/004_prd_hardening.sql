-- Migration 004: PRD hardening
-- FR-16 deliverable versioning, FR-35/36 BAST sign-off and closure record.

ALTER TABLE deliverables ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE projects ADD COLUMN bast_no TEXT DEFAULT '';
ALTER TABLE projects ADD COLUMN bast_date TEXT DEFAULT '';
ALTER TABLE projects ADD COLUMN acceptance_evidence TEXT DEFAULT '';
ALTER TABLE projects ADD COLUMN closure_evaluation TEXT DEFAULT '';
