-- Migration: LLM/Model Governance (Issue 71, REQ-MODELGOV-001~014)
-- SPEC: SPEC-REGULA-MODEL-GOVERNANCE-001
-- Scope:
--   1. audit_action +8 (modelgov.* lifecycle for 21 CFR Part 11 traceability)
--   2. 3 new enums: modelgov_kind, eval_status, modelgov_approval_status
--   3. 4 new tables: prompt_registry, model_pin, change_request,
--      approved_combination (all org_id-scoped for tenant isolation).
--   4. RLS org-isolation on all 4 tables (mirror 0067~0076 pattern).
--   5. Partial UNIQUE INDEX on approved_combination(organization_id) WHERE active
--      enforces single-active per org (REQ-MODELGOV-013).
--
-- Regulatory anchors:
--   21 CFR Part 11 — electronic records of model/prompt changes + approvals
--   GAMP 5 / ISO 13485 §4.1.6 — software component change control + re-validation
--   ISO 14971 — quality risk assessment for model changes
--
-- All 4 tables inherit the app.current_org_id RLS pattern from 0067-0076.

-- -------------------------------------
-- §1 Enum extensions
-- -------------------------------------

-- modelgov.* audit actions (Issue 71, REQ-MODELGOV-007/012/014). 8 lifecycle
-- audit actions for 21 CFR Part 11 traceability. Mirror the schema enum and
-- AuditAction type.
--   modelgov.prompt_registered   — immutable prompt/template version registered (REQ-001)
--   modelgov.change_requested    — change request submitted + eval triggered (REQ-004)
--   modelgov.eval_passed         — promptfoo eval threshold met (REQ-010/011)
--   modelgov.eval_failed         — promptfoo eval threshold missed (REQ-011)
--   modelgov.approved            — combination approved by expert (REQ-012)
--   modelgov.rejected            — combination rejected (REQ-014)
--   modelgov.rolled_back         — active combination reverted (REQ-006)
--   modelgov.runtime_blocked     — unapproved combination blocked at runtime (REQ-008)
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'modelgov.prompt_registered';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'modelgov.change_requested';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'modelgov.eval_passed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'modelgov.eval_failed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'modelgov.approved';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'modelgov.rejected';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'modelgov.rolled_back';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'modelgov.runtime_blocked';

-- -------------------------------------
-- §2 New enums
-- -------------------------------------

CREATE TYPE modelgov_kind AS ENUM ('prompt', 'template');

CREATE TYPE eval_status AS ENUM ('pending', 'passed', 'failed');

CREATE TYPE modelgov_approval_status AS ENUM ('pending_review', 'approved', 'rejected');

-- -------------------------------------
-- §3 Tables
-- -------------------------------------

-- prompt_registry: immutable prompt/template version store (REQ-MODELGOV-001).
-- Insert-only by convention (lib/model-governance/registry.ts enforces); content_hash
-- deduplicates identical content. Never UPDATE — only insert new versions.
CREATE TABLE prompt_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind modelgov_kind NOT NULL,
  content_hash text NOT NULL,
  content text NOT NULL,
  version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE 'set null'
);

CREATE INDEX idx_prompt_registry_org_kind_hash ON prompt_registry(org_id, kind, content_hash);
CREATE INDEX idx_prompt_registry_org_kind_version ON prompt_registry(org_id, kind, version);

-- model_pin: pinned model provider/id/version + retrieval_config (REQ-MODELGOV-002/003).
CREATE TABLE model_pin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model_id text NOT NULL,
  model_version text NOT NULL,
  retrieval_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE 'set null'
);

CREATE INDEX idx_model_pin_org ON model_pin(org_id);

-- change_request: eval -> approval workflow (REQ-MODELGOV-004/005/010/011).
CREATE TABLE change_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  prompt_id uuid REFERENCES prompt_registry(id) ON DELETE 'restrict',
  model_pin_id uuid REFERENCES model_pin(id) ON DELETE 'restrict',
  eval_run_id text,
  eval_status eval_status NOT NULL DEFAULT 'pending',
  eval_result_ref text,
  approval_status modelgov_approval_status NOT NULL DEFAULT 'pending_review',
  approver_id uuid REFERENCES users(id) ON DELETE 'set null',
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE 'set null'
);

CREATE INDEX idx_change_request_org ON change_request(org_id);
CREATE INDEX idx_change_request_org_status ON change_request(org_id, approval_status);

-- approved_combination: the active approved prompt+model pair (REQ-MODELGOV-013).
-- Single-active per org enforced by partial UNIQUE INDEX below.
CREATE TABLE approved_combination (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  prompt_id uuid NOT NULL REFERENCES prompt_registry(id) ON DELETE 'restrict',
  model_pin_id uuid NOT NULL REFERENCES model_pin(id) ON DELETE 'restrict',
  active boolean NOT NULL DEFAULT false,
  approved_at timestamptz NOT NULL DEFAULT now(),
  superseded_by uuid REFERENCES approved_combination(id) ON DELETE 'set null',
  change_request_id uuid REFERENCES change_request(id) ON DELETE 'set null'
);

CREATE INDEX idx_approved_combination_org_active ON approved_combination(org_id, active);

-- REQ-MODELGOV-013: exactly one active combination per org. Mirrors the PCCP
-- single-active partial UNIQUE INDEX pattern (lib/pccp/version-manager.ts).
CREATE UNIQUE INDEX approved_combination_one_active_per_org
  ON approved_combination(org_id)
  WHERE active = true;

-- -------------------------------------
-- §4 Row-Level Security (org-isolation)
-- -------------------------------------
-- Inherits the app.current_org_id session variable pattern. Each policy casts
-- org_id against app.current_org_id::uuid so cross-tenant reads/writes return
-- empty / fail closed.

ALTER TABLE prompt_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_pin ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_combination ENABLE ROW LEVEL SECURITY;

CREATE POLICY prompt_registry_org_isolation ON prompt_registry
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY model_pin_org_isolation ON model_pin
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY change_request_org_isolation ON change_request
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY approved_combination_org_isolation ON approved_combination
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
