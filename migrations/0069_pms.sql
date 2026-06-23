-- SPEC-REGULA-PMS-001 (Issue #53) — EU MDR Article 83-86 PMS/PMCF workflows.
--
-- Extends the workflow_type enum with 3 post-market surveillance kinds and
-- adds the audit_action values that record every regulated state transition
-- (21 CFR Part 11). Two new tables (pms_inputs, pms_documents) carry
-- complaint/vigilance data and generated PMSR/PMCF documents, both isolated
-- per org via RLS on app.current_org_id (same GUC pattern as 0067/0068).
--
-- Single-file convention: this project uses ONE numbered SQL file per
-- migration (see tests/unit/enterprise-migrations.test.ts).

-- ---------------------------------------------------------------------------
-- 1. workflow_type enum extensions (3 values)
-- ---------------------------------------------------------------------------

ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'pms_report';
ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'pmcf_plan';
ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'pmcf_evaluation';

-- ---------------------------------------------------------------------------
-- 2. audit_action enum extensions (7 PMS-specific values)
-- ---------------------------------------------------------------------------

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'pms.report_created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'pms.compliance_checked';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'pms.report_exported';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'pms.input_uploaded';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'pmcf.plan_created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'pmcf.evaluation_drafted';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'pms.cer_linked';

-- ---------------------------------------------------------------------------
-- 3. pms_inputs — complaint / vigilance data (manual entry or file upload)
-- ---------------------------------------------------------------------------

CREATE TABLE pms_inputs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source          TEXT NOT NULL,
  severity        TEXT,
  susar_flag      BOOLEAN NOT NULL DEFAULT FALSE,
  trend_category  TEXT,
  -- Raw payload is stored as JSONB so manual form entries and parsed upload
  -- files (CSV/XLSX) share one table. No PII free-text is indexed.
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

-- ---------------------------------------------------------------------------
-- 4. pms_documents — generated PMSR / PMCF plan / PMCF evaluation documents
-- ---------------------------------------------------------------------------

CREATE TABLE pms_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workflow_run_id   UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  workflow_type     workflow_type NOT NULL,
  -- cer_ref links a PMS/PMCF document to its source CER (same project).
  cer_ref           UUID,
  -- Structured document body (sections). JSONB keeps the MDCG 2022-21 /
  -- Annex XIV Part B shape without a wide column projection.
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
