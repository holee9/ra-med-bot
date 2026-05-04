-- SPEC-REGULA-WORKFLOWS-001 M1 — Phase 9 Advanced Regulatory Workflows
-- REQ-WF-049: workflow_runs table for long-running workflow state persistence.
-- REQ-WF-051: block_type enum extension for workflow_result block.

-- workflow_type pgEnum
CREATE TYPE workflow_type AS ENUM (
  'submission_drafter',
  'audit_response',
  'indication_impact'
);

-- workflow_status pgEnum
CREATE TYPE workflow_status AS ENUM (
  'queued',
  'running',
  'paused',
  'pending_review',
  'approved',
  'rejected',
  'failed'
);

-- workflow_runs table (16th table, REQ-WF-049)
CREATE TABLE workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  project_id UUID REFERENCES projects(id),
  workflow_type workflow_type NOT NULL,
  status workflow_status NOT NULL DEFAULT 'queued',
  input_json JSONB NOT NULL,
  result_json JSONB,
  step_progress JSONB,
  confidence_aggregate NUMERIC(3,2),
  review_required BOOLEAN NOT NULL DEFAULT true,
  reviewer_user_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cloudflare_workflow_instance_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- REQ-WF-051: Add 'workflow_result' to block_type enum
ALTER TYPE block_type ADD VALUE IF NOT EXISTS 'workflow_result';
