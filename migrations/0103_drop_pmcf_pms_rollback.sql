-- 0103_drop_pmcf_pms_rollback.sql
-- Rollback for 0103_drop_pmcf_pms.sql.
-- SPEC-REGULA-PHI-REMOVAL-001 (Issue #319).
--
-- Restores the PMCF/PMS clinical-data domain. Only run if the removal decision
-- is reversed — by policy Regula does NOT handle patient/clinical-subject data
-- (PMCF adverse-event rates, PMS complaint/vigilance/SUSAR), so rollback is
-- discouraged unless the policy itself changes.
--
-- NOTE: rows previously deleted from pms_inputs / pms_documents / audit_logs
-- (pms.*/pmcf.* actions) are NOT recoverable — they were empty at drop time
-- (pre-flight 2026-07-01 confirmed 0 rows). This rollback restores structure
-- only, not data.

-- ===========================================================================
-- 1. Restore tables (pms_inputs then pms_documents; reverse of drop order).
--    Mirrors migrations/0069_pms.sql structure + RLS policies.
-- ===========================================================================

CREATE TABLE pms_inputs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source          TEXT NOT NULL,
  severity        TEXT,
  susar_flag      BOOLEAN NOT NULL DEFAULT FALSE,
  trend_category  TEXT,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pms_inputs_project ON pms_inputs (project_id);
CREATE INDEX idx_pms_inputs_org ON pms_inputs (org_id);
CREATE INDEX idx_pms_inputs_susar ON pms_inputs (org_id, susar_flag) WHERE susar_flag = TRUE;

ALTER TABLE pms_inputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_pms_inputs"
  ON pms_inputs
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE TABLE pms_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workflow_run_id   UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  workflow_type     workflow_type NOT NULL,
  cer_ref           UUID,
  body              JSONB NOT NULL DEFAULT '{}'::jsonb,
  compliance_status TEXT NOT NULL DEFAULT 'pending',
  review_status     TEXT NOT NULL DEFAULT 'draft',
  created_by        UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pms_documents_project ON pms_documents (project_id);
CREATE INDEX idx_pms_documents_org ON pms_documents (org_id);
CREATE INDEX idx_pms_documents_workflow ON pms_documents (workflow_run_id);

ALTER TABLE pms_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_pms_documents"
  ON pms_documents
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- ===========================================================================
-- 2. Restore enum values. ADD VALUE IF NOT EXISTS is idempotent and safe;
--    new values append to the end (Postgres enum ordering is not significant
--    for correctness here). Values must be added outside a transaction block
--    in older Postgres, but ADD VALUE IF NOT EXISTS is transaction-safe since
--    Postgres 12.
-- ===========================================================================

ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'pms_report';
ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'pmcf_plan';
ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'pmcf_evaluation';

ALTER TYPE ci_link_target_type ADD VALUE IF NOT EXISTS 'pms';

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'pms.report_created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'pms.compliance_checked';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'pms.report_exported';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'pms.report_export_denied';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'pms.report_closed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'pms.input_uploaded';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'pmcf.plan_created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'pmcf.evaluation_drafted';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'pms.cer_linked';
