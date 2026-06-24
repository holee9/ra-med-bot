-- SPEC-REGULA-LABELING-001 (Issue #66) — Labeling & IFU Structured Authoring.
--
-- Adds the 'labeling' workflow_type and 6 labeling audit_action values, plus
-- 5 tables that capture structured labeling documents (intended_use, indication,
-- contraindication, warning, precaution sections), per-claim citation linkage
-- (REQ-LABEL-003/004 — claim without citation forces expert_review), and
-- translation semantic-diff tracking (REQ-LABEL-007).
--
-- Citations reuse the change_verdict_citations NOT NULL excerpt pattern
-- (REQ-006 dual defense: application-level validateClaimCitations + DB CHECK
-- so a claim-citation without a grounded regulatory excerpt can never persist).
--
-- All 5 tables inherit the app.current_org_id RLS pattern from 0067-0071.
--
-- Single-file convention: this project uses ONE numbered SQL file per
-- migration (see tests/unit/enterprise-migrations.test.ts).

-- ---------------------------------------------------------------------------
-- 1. workflow_type enum extension (1 value) — REQ-LABEL-001
-- ---------------------------------------------------------------------------
ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'labeling';

-- ---------------------------------------------------------------------------
-- 2. audit_action enum extension (6 values) — REQ-LABEL-010
--    Every regulated state transition is recorded (21 CFR Part 11).
--    label.export_blocked records export denial when unsupported claims exist
--    (REQ-LABEL-006) so the audit trail distinguishes gate enforcement from
--    label.claim_citation_rejected (expert-review forcing).
-- ---------------------------------------------------------------------------
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'label.document_created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'label.claim_validated';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'label.claim_citation_rejected';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'label.translation_diff_detected';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'label.approved';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'label.export_blocked';

-- ---------------------------------------------------------------------------
-- 3. labeling_documents — top-level labeling record
--    REQ-001: structured labeling/IFU per project per jurisdiction.
--    status lifecycle: draft → in_review → approved (REQ-006/012 gate).
-- ---------------------------------------------------------------------------
CREATE TABLE labeling_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workflow_run_id   UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  -- Product / device name this labeling applies to
  product_name      TEXT NOT NULL,
  -- REQ-002/011: jurisdiction scope drives the required-elements checklist
  jurisdiction      TEXT NOT NULL CHECK (jurisdiction IN ('FDA','EU_MDR','MFDS','NMPA','PMDA')),
  -- Document lifecycle
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','in_review','approved','rejected')),
  -- REQ-006/012: approval gate — only ra-lead may flip to 'approved'
  approved_by       UUID REFERENCES users(id),
  approved_at       TIMESTAMPTZ,
  created_by        UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_labeling_documents_project ON labeling_documents (project_id);
CREATE INDEX idx_labeling_documents_org ON labeling_documents (org_id);
CREATE INDEX idx_labeling_documents_run ON labeling_documents (workflow_run_id);

ALTER TABLE labeling_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_labeling_documents"
  ON labeling_documents
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- ---------------------------------------------------------------------------
-- 4. labeling_sections — structured sections per document
--    REQ-001: 5 section types (intended_use, indication, contraindication,
--    warning, precaution). content is locale-specific (source language).
-- ---------------------------------------------------------------------------
CREATE TABLE labeling_sections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id       UUID NOT NULL REFERENCES labeling_documents(id) ON DELETE CASCADE,
  section_type      TEXT NOT NULL CHECK (section_type IN (
                      'intended_use','indication','contraindication',
                      'warning','precaution')),
  content           TEXT NOT NULL DEFAULT '',
  locale            TEXT NOT NULL DEFAULT 'en',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, section_type, locale)
);

CREATE INDEX idx_labeling_sections_document ON labeling_sections (document_id);
CREATE INDEX idx_labeling_sections_org ON labeling_sections (org_id);

ALTER TABLE labeling_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_labeling_sections"
  ON labeling_sections
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- ---------------------------------------------------------------------------
-- 5. labeling_claims — atomic claim records linked to a section
--    REQ-003/004: each claim MUST link to ≥1 citation, else
--    expert_review_required=true (enforced at the application layer by
--    validateClaimCitations; persisted here for audit transparency).
--    REQ-005: comparative/superiority auto-detected → claim_type set.
-- ---------------------------------------------------------------------------
CREATE TABLE labeling_claims (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  section_id                UUID NOT NULL REFERENCES labeling_sections(id) ON DELETE CASCADE,
  claim_text                TEXT NOT NULL,
  -- REQ-005: comparative/superiority/unsupported classification
  claim_type                TEXT NOT NULL DEFAULT 'supported'
                              CHECK (claim_type IN (
                                'supported','comparative','superiority','unsupported')),
  -- REQ-003/004: forced expert-review when no grounded citation
  expert_review_required    BOOLEAN NOT NULL DEFAULT FALSE,
  -- REQ-005: matched comparative/superiority keywords (JSON array)
  matched_keywords          JSONB,
  created_by                UUID NOT NULL REFERENCES users(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_labeling_claims_section ON labeling_claims (section_id);
CREATE INDEX idx_labeling_claims_org ON labeling_claims (org_id);
CREATE INDEX idx_labeling_claims_expert_review ON labeling_claims (expert_review_required);

ALTER TABLE labeling_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_labeling_claims"
  ON labeling_claims
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- ---------------------------------------------------------------------------
-- 6. labeling_claim_citations — regulatory excerpts backing each claim
--    REQ-003 DUAL DEFENSE: excerpt NOT NULL at the DB level (mirrors
--    change_verdict_citations). A claim-citation without a grounded excerpt
--    is rejected BEFORE INSERT, and even if a caller bypasses the validator,
--    the DB rejects the NULL/empty excerpt.
-- ---------------------------------------------------------------------------
CREATE TABLE labeling_claim_citations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  claim_id          UUID NOT NULL REFERENCES labeling_claims(id) ON DELETE CASCADE,
  source_section_id UUID,
  -- REQ-003: excerpt NOT NULL — the regulatory/clinical text excerpt grounding the claim.
  excerpt           TEXT NOT NULL CHECK (length(btrim(excerpt)) > 0),
  source_label      TEXT,
  -- Citation anchor identifiers (e.g. '21 CFR 801.109', 'ISO 14971:2019 §3.2')
  citation_id       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_labeling_claim_citations_claim ON labeling_claim_citations (claim_id);
CREATE INDEX idx_labeling_claim_citations_org ON labeling_claim_citations (org_id);

ALTER TABLE labeling_claim_citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_labeling_claim_citations"
  ON labeling_claim_citations
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- ---------------------------------------------------------------------------
-- 7. labeling_translations — translated sections with semantic-diff tracking
--    REQ-007: source vs target semantic diff; major_diff forces RA re-approval.
-- ---------------------------------------------------------------------------
CREATE TABLE labeling_translations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  section_id              UUID NOT NULL REFERENCES labeling_sections(id) ON DELETE CASCADE,
  source_locale           TEXT NOT NULL,
  target_locale           TEXT NOT NULL,
  source_text_snapshot    TEXT NOT NULL,
  target_text             TEXT NOT NULL,
  -- REQ-007: MVP heuristic diff result
  semantic_diff_status    TEXT NOT NULL DEFAULT 'match'
                            CHECK (semantic_diff_status IN (
                              'match','minor_diff','major_diff','review_required')),
  diff_details            JSONB,
  -- REQ-007: RA approval gate when major_diff
  approval_status         TEXT NOT NULL DEFAULT 'pending'
                            CHECK (approval_status IN ('pending','approved','rejected')),
  approved_by             UUID REFERENCES users(id),
  approved_at             TIMESTAMPTZ,
  created_by              UUID NOT NULL REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_labeling_translations_section ON labeling_translations (section_id);
CREATE INDEX idx_labeling_translations_org ON labeling_translations (org_id);

ALTER TABLE labeling_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_labeling_translations"
  ON labeling_translations
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
