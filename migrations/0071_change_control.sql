-- SPEC-REGULA-CHANGE-CONTROL-001 (Issue #54) — Design Change RA Impact Assessor.
--
-- Adds the 'change_control_assessment' workflow_type and 5 change-control
-- audit_action values, plus 4 tables that capture a per-jurisdiction verdict
-- on whether a design change requires new submission, change notification,
-- internal record only, or is not applicable. Citations are DB-enforced
-- (excerpt NOT NULL — REQ-006 dual defense: application-level validateCitations
-- + this NOT NULL constraint so an LLM-hallucinated verdict without a
-- grounded regulatory excerpt can never persist).
--
-- All 4 tables inherit the app.current_org_id RLS pattern from 0067/0068/0069.
--
-- Single-file convention: this project uses ONE numbered SQL file per
-- migration (see tests/unit/enterprise-migrations.test.ts).

-- ---------------------------------------------------------------------------
-- 1. workflow_type enum extension (1 value) — REQ-CHANGE-CONTROL-001
-- ---------------------------------------------------------------------------
ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'change_control_assessment';

-- ---------------------------------------------------------------------------
-- 2. audit_action enum extension (6 values) — REQ-CHANGE-CONTROL-012
--    Every regulated state transition is recorded (21 CFR Part 11).
--    change.export_blocked (H-4) records provisional-export denial so the
--    audit trail distinguishes REQ-006 citation rejection from REQ-009/011
--    expert-review gating — the two were previously conflated under
--    change.verdict_citation_rejected.
-- ---------------------------------------------------------------------------
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'change.assessment_created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'change.verdict_produced';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'change.verdict_citation_rejected';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'change.assessment_reviewed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'change.report_exported';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'change.export_blocked';

-- ---------------------------------------------------------------------------
-- 3. change_assessments — top-level assessment record
--    REQ-010: model_version / prompt_version / template_version enable rollback.
--    REQ-009/REQ-011: status 'provisional' blocks export (gated server-side).
-- ---------------------------------------------------------------------------
CREATE TABLE change_assessments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workflow_run_id   UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  -- REQ-003: 6 change types
  change_type       TEXT NOT NULL CHECK (change_type IN (
                      'design','material','manufacturing_process',
                      'software','labeling','intended_use')),
  description       TEXT NOT NULL,
  impact_scope      TEXT NOT NULL,
  -- REQ-009/REQ-011: provisional → reviewed → final lifecycle
  status            TEXT NOT NULL DEFAULT 'provisional'
                      CHECK (status IN ('provisional','reviewed','final')),
  -- REQ-010: version metadata for rollback
  model_version     TEXT NOT NULL,
  prompt_version    TEXT NOT NULL,
  template_version  TEXT NOT NULL,
  created_by        UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_change_assessments_project ON change_assessments (project_id);
CREATE INDEX idx_change_assessments_org ON change_assessments (org_id);
CREATE INDEX idx_change_assessments_run ON change_assessments (workflow_run_id);

ALTER TABLE change_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_change_assessments"
  ON change_assessments
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- ---------------------------------------------------------------------------
-- 4. change_verdicts — per-jurisdiction verdict
--    REQ-004: 4 verdicts × REQ-005: 5 jurisdictions
-- ---------------------------------------------------------------------------
CREATE TABLE change_verdicts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_id   UUID NOT NULL REFERENCES change_assessments(id) ON DELETE CASCADE,
  -- REQ-005: FDA, EU_MDR, MFDS, NMPA, PMDA
  jurisdiction    TEXT NOT NULL CHECK (jurisdiction IN ('FDA','EU_MDR','MFDS','NMPA','PMDA')),
  -- REQ-004: 4-state verdict
  verdict         TEXT NOT NULL CHECK (verdict IN (
                    'new_submission_required','change_notification',
                    'internal_record_only','not_applicable')),
  rationale       TEXT NOT NULL,
  confidence      TEXT NOT NULL DEFAULT 'unverified'
                    CHECK (confidence IN ('verified','unverified')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_change_verdicts_assessment ON change_verdicts (assessment_id);
CREATE INDEX idx_change_verdicts_org ON change_verdicts (org_id);

ALTER TABLE change_verdicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_change_verdicts"
  ON change_verdicts
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- ---------------------------------------------------------------------------
-- 5. change_verdict_citations — regulatory excerpts backing each verdict
--    REQ-006 DUAL DEFENSE: excerpt NOT NULL at the DB level. Combined with the
--    application-level validateVerdictCitations (reuse of CLASSIFY validateCitations
--    grounding pattern), this makes it impossible for a citation-less verdict
--    to persist. A hallucinated verdict without a grounded excerpt is rejected
--    BEFORE the INSERT, and even if a caller bypasses the validator, the DB
--    rejects the NULL excerpt.
-- ---------------------------------------------------------------------------
CREATE TABLE change_verdict_citations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  verdict_id        UUID NOT NULL REFERENCES change_verdicts(id) ON DELETE CASCADE,
  source_section_id UUID,
  -- REQ-006: excerpt is NOT NULL — the regulatory text excerpt grounding the verdict.
  -- Cannot be empty string either; the CHECK forces a non-empty grounded excerpt.
  excerpt           TEXT NOT NULL CHECK (length(btrim(excerpt)) > 0),
  source_label      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_change_verdict_citations_verdict ON change_verdict_citations (verdict_id);
CREATE INDEX idx_change_verdict_citations_org ON change_verdict_citations (org_id);

ALTER TABLE change_verdict_citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_change_verdict_citations"
  ON change_verdict_citations
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- ---------------------------------------------------------------------------
-- 6. change_risk_links — ISO 14971 (#46) risk re-evaluation linkage
--    REQ-008: each assessment links to risk_items that need re-evaluation.
--    risk_items is defined in 0058_risk_tables.sql (SPEC-REGULA-RISK-001, #46).
-- ---------------------------------------------------------------------------
CREATE TABLE change_risk_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_id   UUID NOT NULL REFERENCES change_assessments(id) ON DELETE CASCADE,
  risk_item_id    UUID NOT NULL REFERENCES risk_items(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id, risk_item_id)
);

CREATE INDEX idx_change_risk_links_assessment ON change_risk_links (assessment_id);
CREATE INDEX idx_change_risk_links_org ON change_risk_links (org_id);
CREATE INDEX idx_change_risk_links_risk_item ON change_risk_links (risk_item_id);

ALTER TABLE change_risk_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_change_risk_links"
  ON change_risk_links
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
