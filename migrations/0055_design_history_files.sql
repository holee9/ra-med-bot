-- SPEC-REGULA-DHF-001 — Design History File (DHF) tables.
-- Adds: design_history_files, design_inputs, design_verifications, design_reviews.
-- Also adds: 4 DHF audit_action values to the existing pgEnum.

-- 1. Add DHF audit actions to the existing enum
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'dhf_created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'dhf_updated';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'dhf_design_freeze';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'dhf_review_approved';

-- 2. design_history_files — top-level DHF record per device.
CREATE TABLE design_history_files (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_model TEXT,
  intended_use TEXT NOT NULL,
  jurisdiction TEXT NOT NULL DEFAULT 'FDA' CHECK (jurisdiction IN ('FDA','EU','MFDS','NMPA','PMDA')),
  regulatory_framework TEXT NOT NULL DEFAULT 'QSR_QMSR' CHECK (regulatory_framework IN ('QSR_QMSR','ISO_13485','EU_MDR')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','design_freeze','archived')),
  completeness_score INTEGER NOT NULL DEFAULT 0 CHECK (completeness_score >= 0 AND completeness_score <= 100),
  design_freeze_date DATE,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. design_inputs — requirements linked to a DHF.
CREATE TABLE design_inputs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dhf_id TEXT NOT NULL REFERENCES design_history_files(id) ON DELETE CASCADE,
  input_type TEXT NOT NULL CHECK (input_type IN ('user_need','regulatory','standards','risk')),
  requirement_id TEXT,
  description TEXT NOT NULL,
  source TEXT,
  priority TEXT NOT NULL DEFAULT 'must' CHECK (priority IN ('must','should','nice_to_have')),
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','not_applicable')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. design_verifications — V&V protocols linked to a DHF (optionally to an input).
CREATE TABLE design_verifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dhf_id TEXT NOT NULL REFERENCES design_history_files(id) ON DELETE CASCADE,
  design_input_id TEXT REFERENCES design_inputs(id),
  verification_type TEXT NOT NULL CHECK (verification_type IN ('analysis','test','inspection','demonstration')),
  protocol_title TEXT NOT NULL,
  result TEXT CHECK (result IN ('pass','fail','pending','not_started')),
  test_date DATE,
  performed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. design_reviews — formal review records per DHF.
CREATE TABLE design_reviews (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dhf_id TEXT NOT NULL REFERENCES design_history_files(id) ON DELETE CASCADE,
  review_stage TEXT NOT NULL CHECK (review_stage IN ('concept','preliminary','critical','final','design_freeze')),
  review_date DATE NOT NULL,
  attendees TEXT[] NOT NULL DEFAULT '{}',
  decisions TEXT,
  open_actions TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Indexes
CREATE INDEX idx_dhf_org ON design_history_files(org_id);
CREATE INDEX idx_design_inputs_dhf ON design_inputs(dhf_id);
CREATE INDEX idx_design_verifications_dhf ON design_verifications(dhf_id);
CREATE INDEX idx_design_reviews_dhf ON design_reviews(dhf_id);
