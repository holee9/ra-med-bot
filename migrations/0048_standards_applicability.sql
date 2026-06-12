-- SPEC-REGULA-STANDARDS-001: Standards applicability mapping
CREATE TABLE standards_applicability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_type_key TEXT NOT NULL,          -- 'electrical_medical_device'|'active_implantable'|'software_only'|...
  standard_id UUID NOT NULL REFERENCES standards_catalog(id) ON DELETE CASCADE,
  applicability_reason TEXT NOT NULL,
  regulatory_pathway TEXT NOT NULL,       -- 'fda_510k'|'fda_pma'|'eu_mdr_class_i'|'eu_mdr_class_ii'|'eu_mdr_class_iii'|'all'
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(device_type_key, standard_id, regulatory_pathway)
);

-- Standards audit_actions enum update
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'standards_searched';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'standards_gap_analyzed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'standards_compliance_updated';
