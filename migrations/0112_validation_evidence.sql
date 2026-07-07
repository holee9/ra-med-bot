-- SPEC-REGULA-VALIDATION-001 M0: validation evidence schema.
-- Migration 0112: 3 new tables (validation_evidence, change_control, validation_signoff).
--
-- Implements REQ-VAL-003..006 (evidence shape), REQ-VAL-007..009 (change control),
-- REQ-VAL-010..014 (sign-off + report linkage). research.md §6 is the SQL SSoT.
--
-- Design decisions (plan.md §2 M0 Risks):
--   * CHECK constraints (not native Postgres enum) — keeps rollback trivial.
--   * Append-only intent: no UPDATE path; rows are superseded by new INSERTs.
--   * audit_log_ref is a loose UUID reference (not FK) — audit_logs append-only
--     trigger would otherwise block sign-off row deletion on rollback.
--   * Single-tenant (Regula-Lite charter): no tenant_id column.
--
-- 21 CFR Part 11 §11.10(i) — validation evidence must be auditable and linked
-- to release sign-off. ISO 13485 §4.1.6 — change control records.

BEGIN;

-- 1. validation_evidence — IQ/OQ/PQ evidence records (REQ-VAL-003/004/005/006)
CREATE TABLE IF NOT EXISTS validation_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id TEXT NOT NULL,
  qualification_type TEXT NOT NULL CHECK (qualification_type IN ('iq', 'oq', 'pq')),
  commit_sha TEXT NOT NULL,
  ci_run_id BIGINT,
  test_command TEXT NOT NULL,
  artifact_path TEXT,
  result TEXT NOT NULL CHECK (result IN ('pass', 'fail', 'skip')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE validation_evidence IS
  'SPEC-REGULA-VALIDATION-001 — IQ/OQ/PQ evidence records (21 CFR Part 11 §11.10(i)). Append-only.';
COMMENT ON COLUMN validation_evidence.qualification_type IS
  'Installation / Operational / Performance Qualification (GAMP 5).';
COMMENT ON COLUMN validation_evidence.ci_run_id IS
  'GitHub Actions run databaseId. NULL when evidence collected outside CI.';
COMMENT ON COLUMN validation_evidence.result IS
  'pass = check succeeded; fail = check failed (release blocker); skip = artifact expired or unavailable.';

-- 2. change_control — 7-axis release impact assessment (REQ-VAL-007/008/009)
CREATE TABLE IF NOT EXISTS change_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id TEXT NOT NULL,
  change_axis TEXT NOT NULL CHECK (change_axis IN
    ('source_policy', 'prompt', 'model', 'schema', 'retrieval', 'export', 'review_workflow')),
  impact_level TEXT NOT NULL CHECK (impact_level IN ('low', 'medium', 'high')),
  rerun_required BOOLEAN NOT NULL,
  residual_risk TEXT NOT NULL,
  exception_note TEXT,
  evidence_ref UUID,
  assessor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE change_control IS
  'SPEC-REGULA-VALIDATION-001 — release-level 7-axis change impact assessment (ISO 13485 §4.1.6).';
COMMENT ON COLUMN change_control.change_axis IS
  'source_policy | prompt | model | schema | retrieval | export | review_workflow (REQ-VAL-007).';
COMMENT ON COLUMN change_control.impact_level IS
  'high-impact + missing rerun evidence blocks sign-off (REQ-VAL-008).';
COMMENT ON COLUMN change_control.residual_risk IS
  'Mandatory free-text justification. Non-empty even when risk is negligible (REQ-VAL-009).';
COMMENT ON COLUMN change_control.evidence_ref IS
  'Optional FK-style reference to validation_evidence.id (loose UUID; not enforced to avoid append-only friction).';

-- 3. validation_signoff — final release sign-off (REQ-VAL-010/012/013)
CREATE TABLE IF NOT EXISTS validation_signoff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id TEXT NOT NULL UNIQUE,
  checklist_state JSONB NOT NULL,
  approver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  report_artifact_path TEXT NOT NULL,
  audit_log_ref UUID
);

COMMENT ON TABLE validation_signoff IS
  'SPEC-REGULA-VALIDATION-001 — final release sign-off. One row per release_id (UNIQUE).';
COMMENT ON COLUMN validation_signoff.checklist_state IS
  'JSONB snapshot of sign-off checklist (each item: {id, title, met: boolean}). REQ-VAL-013.';
COMMENT ON COLUMN validation_signoff.audit_log_ref IS
  'UUID of the audit_logs row written by writeAudit(action: validation.signoff). Loose ref (not FK).';

-- 4. Indexes — release_id is the primary access pattern (plan.md §2 M0 task 4)
CREATE INDEX IF NOT EXISTS idx_validation_evidence_release
  ON validation_evidence (release_id);

CREATE INDEX IF NOT EXISTS idx_change_control_release
  ON change_control (release_id);

CREATE INDEX IF NOT EXISTS idx_validation_evidence_release_qual
  ON validation_evidence (release_id, qualification_type);

CREATE INDEX IF NOT EXISTS idx_change_control_release_axis
  ON change_control (release_id, change_axis);

COMMIT;
