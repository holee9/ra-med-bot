-- SPEC-REGULA-RISK-001: ISO 14971 Risk Management — risk analysis tables
-- Creates risk_level_enum, control_tier_enum, risk_items, risk_controls,
-- and risk_gspr_mappings. Depends on 0057_risk_workflow_type.sql.

CREATE TYPE risk_level AS ENUM ('acc', 'alarp', 'unacc');

CREATE TYPE control_tier AS ENUM ('inherent', 'protective', 'information');

CREATE TABLE risk_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  hazard TEXT NOT NULL,
  sequence_of_events TEXT NOT NULL,
  hazardous_situation TEXT NOT NULL,
  harm TEXT NOT NULL,
  citation JSONB NOT NULL DEFAULT '[]',
  severity INTEGER NOT NULL,
  probability INTEGER NOT NULL,
  risk_level risk_level NOT NULL,
  low_confidence BOOLEAN NOT NULL DEFAULT FALSE,
  edited_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_items_run ON risk_items(workflow_run_id);

CREATE TABLE risk_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_item_id UUID NOT NULL REFERENCES risk_items(id) ON DELETE CASCADE,
  tier control_tier NOT NULL,
  description TEXT NOT NULL,
  rationale TEXT,
  is_adopted BOOLEAN NOT NULL DEFAULT FALSE,
  residual_severity INTEGER,
  residual_probability INTEGER,
  residual_risk_level risk_level,
  alarp_justification TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_controls_item ON risk_controls(risk_item_id);

CREATE TABLE risk_gspr_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  risk_item_id UUID REFERENCES risk_items(id) ON DELETE CASCADE,
  gspr_clause TEXT NOT NULL,
  requirement TEXT NOT NULL,
  compliance TEXT NOT NULL,
  evidence TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_gspr_run ON risk_gspr_mappings(workflow_run_id);
