-- Migration: Clinical Investigation planner (Issue #69, REQ-CLININV-001~012)
-- SPEC: SPEC-REGULA-CLINICAL-INVESTIGATION-001
-- Scope:
--   1. workflow_type +1 ('clinical_investigation')
--   2. audit_action +8 (ci.* lifecycle for 21 CFR Part 11 traceability)
--   3. 4 new enums: ci_pathway, ci_doc_type, ci_event_type, ci_link_target_type
--   4. 5 new tables: clinical_investigations, ci_protocols, ci_documents,
--      ci_events, ci_links (all org_id-scoped for tenant isolation).
--   5. RLS org-isolation on all 5 tables (mirror 0067~0073 pattern).
--
-- Regulatory anchors:
--   FDA 21 CFR 812 (IDE), 21 CFR 50 (informed consent), 21 CFR 56 (IRB)
--   EU MDR (2017/745) Article 62-82, Annex XV (Clinical Investigations)
--   ISO 14155 (GCP for clinical investigations), Declaration of Helsinki.
--
-- All 5 tables inherit the app.current_org_id RLS pattern from 0067-0073.

-- -------------------------------------
-- §1 Enum extensions
-- -------------------------------------

ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'clinical_investigation';

-- ci.* audit actions (Issue #69, REQ-CLININV-010). 8 lifecycle audit actions
-- for 21 CFR Part 11 traceability. Mirror the schema enum and AuditAction type.
--   ci.assessed                  -- gap-based necessity assessment produced (REQ-001)
--   ci.pathway_determined        -- FDA IDE / EU MDR pathway decision (REQ-002/003)
--   ci.protocol_updated          -- synopsis/endpoint/criteria saved (REQ-005)
--   ci.irb_package_drafted       -- IRB/EC submission package draft (REQ-004)
--   ci.event_recorded            -- milestone/deviation/AE tracked (REQ-008)
--   ci.results_linked            -- results linked to CER/PMS/DHF (REQ-009)
--   ci.closed                    -- investigation closed with expert signoff (REQ-012)
--   ci.close_blocked_signoff_missing -- close denied: no expert signoff (REQ-012)
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'ci.assessed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'ci.pathway_determined';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'ci.protocol_updated';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'ci.irb_package_drafted';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'ci.event_recorded';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'ci.results_linked';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'ci.closed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'ci.close_blocked_signoff_missing';

CREATE TYPE ci_pathway AS ENUM ('fda_ide', 'eu_mdr');
CREATE TYPE ci_doc_type AS ENUM ('irb_package', 'consent', 'brochure', 'monitoring_plan');
CREATE TYPE ci_event_type AS ENUM ('milestone', 'deviation', 'adverse_event');
CREATE TYPE ci_link_target_type AS ENUM ('cer', 'pms', 'dhf');

-- -------------------------------------
-- §2 clinical_investigations (root)
-- -------------------------------------

CREATE TABLE clinical_investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  pathway ci_pathway,
  necessity_status text NOT NULL DEFAULT 'pending',
  necessity_rationale text,
  approval_status text NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinical_investigations_org ON clinical_investigations(org_id);
CREATE INDEX idx_clinical_investigations_project ON clinical_investigations(project_id);
CREATE INDEX idx_clinical_investigations_status ON clinical_investigations(approval_status);

ALTER TABLE clinical_investigations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_clinical_investigations"
  ON clinical_investigations
  FOR ALL
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- -------------------------------------
-- §3 ci_protocols (REQ-005)
-- -------------------------------------

CREATE TABLE ci_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  investigation_id uuid NOT NULL REFERENCES clinical_investigations(id) ON DELETE CASCADE,
  synopsis text,
  endpoints jsonb NOT NULL DEFAULT '{}'::jsonb,
  inclusion_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  exclusion_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ci_protocols_investigation ON ci_protocols(investigation_id);
CREATE INDEX idx_ci_protocols_org ON ci_protocols(org_id);

ALTER TABLE ci_protocols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_ci_protocols"
  ON ci_protocols
  FOR ALL
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- -------------------------------------
-- §4 ci_documents (REQ-004/006/007)
-- -------------------------------------

CREATE TABLE ci_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  investigation_id uuid NOT NULL REFERENCES clinical_investigations(id) ON DELETE CASCADE,
  doc_type ci_doc_type NOT NULL,
  content text NOT NULL DEFAULT '',
  review_status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ci_documents_investigation ON ci_documents(investigation_id);
CREATE INDEX idx_ci_documents_org ON ci_documents(org_id);
CREATE INDEX idx_ci_documents_type ON ci_documents(doc_type);

ALTER TABLE ci_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_ci_documents"
  ON ci_documents
  FOR ALL
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- -------------------------------------
-- §5 ci_events (REQ-008, AC-08)
-- -------------------------------------

CREATE TABLE ci_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  investigation_id uuid NOT NULL REFERENCES clinical_investigations(id) ON DELETE CASCADE,
  type ci_event_type NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  vigilance_ref text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ci_events_investigation ON ci_events(investigation_id);
CREATE INDEX idx_ci_events_org ON ci_events(org_id);
CREATE INDEX idx_ci_events_type ON ci_events(type);
CREATE INDEX idx_ci_events_vigilance ON ci_events(vigilance_ref) WHERE vigilance_ref IS NOT NULL;

ALTER TABLE ci_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_ci_events"
  ON ci_events
  FOR ALL
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- -------------------------------------
-- §6 ci_links (REQ-009, AC-04)
-- -------------------------------------

CREATE TABLE ci_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  investigation_id uuid NOT NULL REFERENCES clinical_investigations(id) ON DELETE CASCADE,
  target_type ci_link_target_type NOT NULL,
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (investigation_id, target_type, target_id)
);
CREATE INDEX idx_ci_links_investigation ON ci_links(investigation_id);
CREATE INDEX idx_ci_links_org ON ci_links(org_id);
CREATE INDEX idx_ci_links_target ON ci_links(target_type, target_id);

ALTER TABLE ci_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_ci_links"
  ON ci_links
  FOR ALL
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
