-- SPEC-REGULA-SAMD-001 — AI/ML SaMD Regulatory Pathway Builder
-- Adds samd_assessments table for IMDRF N12 classification and FDA/EU AI Act pathway determination.
-- Enum values added to audit_action: samd_assessment_created, samd_assessment_updated, samd_review_approved

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'samd_assessment_created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'samd_assessment_updated';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'samd_review_approved';

CREATE TABLE samd_assessments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT,
  title TEXT NOT NULL,
  device_description TEXT NOT NULL,
  intended_use TEXT NOT NULL,
  -- ai_ml_type: locked | adaptive | continuously_learning
  ai_ml_type TEXT NOT NULL CHECK (ai_ml_type IN ('locked', 'adaptive', 'continuously_learning')),
  -- IMDRF N12 Annex II/III: clinical / healthcare situation
  imdrf_clinical_situation TEXT NOT NULL CHECK (imdrf_clinical_situation IN ('critical', 'serious', 'non_serious')),
  imdrf_healthcare_situation TEXT NOT NULL CHECK (imdrf_healthcare_situation IN ('critical', 'serious', 'non_serious')),
  -- Computed IMDRF category: I | II | III | IV
  imdrf_category TEXT,
  -- FDA pathway: 510k | de_novo | pma | exempt
  fda_pathway TEXT,
  -- EU AI Act risk level
  eu_ai_risk_level TEXT CHECK (eu_ai_risk_level IN ('prohibited', 'high_risk', 'general_purpose', 'minimal')),
  -- PCCP required when ai_ml_type is adaptive or continuously_learning
  pccp_required BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'archived')),
  -- AI-generated artifacts stored as JSONB
  generated_model_card JSONB,
  generated_checklist JSONB,
  generated_monitoring_plan JSONB,
  -- Expert review gating
  expert_review_approved_by TEXT,
  expert_review_approved_at TIMESTAMPTZ,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_samd_assessments_org ON samd_assessments(org_id);
CREATE INDEX idx_samd_assessments_status ON samd_assessments(status);
