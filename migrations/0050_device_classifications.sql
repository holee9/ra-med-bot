-- SPEC-REGULA-CLASSIFY-001 — device classification results table.
-- REQ-CLASSIFY-001: persist multi-jurisdiction classification output.
CREATE TABLE device_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  device_description TEXT NOT NULL,
  device_type TEXT NOT NULL,           -- 'active'|'non_active'|'software_only'|'ivd'|'implantable'
  contact_type TEXT NOT NULL,          -- 'no_contact'|'external'|'internal'|'implant'
  has_software BOOLEAN NOT NULL DEFAULT FALSE,
  has_ai_ml BOOLEAN NOT NULL DEFAULT FALSE,
  is_sterile BOOLEAN NOT NULL DEFAULT FALSE,
  fda_class TEXT,                      -- 'I'|'II'|'III'|'exempt'
  fda_pathway TEXT,                    -- '510k'|'PMA'|'DeNovo'|'exempt'
  fda_product_code TEXT,
  fda_regulation_number TEXT,
  eu_class TEXT,                       -- 'I'|'IIa'|'IIb'|'III'
  eu_pathway TEXT,                     -- 'self_cert'|'notified_body'|'conformity_assessment'
  eu_rule TEXT,                        -- e.g. 'Rule 9'
  mfds_class TEXT,                     -- '1'|'2'|'3'|'4'
  nmpa_class TEXT,                     -- 'I'|'II'|'III'
  pmda_class TEXT,                     -- 'I'|'II'|'III'
  classification_rationale JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_device_classifications_org ON device_classifications(org_id);
