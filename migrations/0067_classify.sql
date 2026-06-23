-- SPEC-REGULA-CLASSIFY-001 (Issue #59) — MVP backend classification wizard.
--
-- The existing migrations 0050_device_classifications.sql and
-- 0051_classification_audit_actions.sql (merged in PR #144) created the
-- device_classifications table with flat per-jurisdiction TEXT columns, added
-- the 'device_classified' audit action, and added the 'classification'
-- workflow_type value.
--
-- This migration completes the MVP surface that PR #144 left unfinished:
--   1. workflow_type: add 'classify' (SPEC tasks.md names this value; mirrors
--      how 'risk' was added). 'classification' from 0051 is left in place for
--      back-compat — both values are valid workflow kinds.
--   2. audit_action: add 'classification_exported' for the report-export path.
--   3. device_classifications: augment (NOT recreate) with workflow_run_id FK,
--      result JSONB (5-jurisdiction structured output + citations + next
--      steps), input JSONB (wizard answers), and status. The existing flat
--      columns are retained — the engine writes the structured output into
--      result while also mirroring the headline class/path into the flat
--      columns for convenience queries.
--   4. RLS: enable org isolation on device_classifications, inheriting the
--      0015_docingest_rls.sql / 0066_knowledge_gap.sql current_setting pattern.
--
-- Single-file convention: this project uses ONE numbered SQL file per
-- migration (see tests/unit/enterprise-migrations.test.ts).

-- ---------------------------------------------------------------------------
-- 1. workflow_type + audit_action enum extensions
-- ---------------------------------------------------------------------------
ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'classify';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'classification_exported';

-- ---------------------------------------------------------------------------
-- 2. device_classifications augmentation
--    All additions are NULLable / have defaults so the 0050 rows remain valid.
-- ---------------------------------------------------------------------------
ALTER TABLE device_classifications
  ADD COLUMN IF NOT EXISTS workflow_run_id UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS input JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS result JSONB,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';

CREATE INDEX IF NOT EXISTS idx_device_classifications_run
  ON device_classifications (workflow_run_id);

-- ---------------------------------------------------------------------------
-- 3. RLS: org isolation (inherits 0066_knowledge_gap.sql pattern)
--    app.current_org_id is set by the Route Handler middleware.
-- ---------------------------------------------------------------------------
ALTER TABLE device_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_device_classifications"
  ON device_classifications
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
