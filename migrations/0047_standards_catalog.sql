-- SPEC-REGULA-STANDARDS-001: Standards catalog
CREATE TABLE standards_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_number TEXT NOT NULL UNIQUE,  -- e.g. "ISO 14971:2019"
  title TEXT NOT NULL,
  body TEXT NOT NULL,                    -- 'ISO'|'IEC'|'EN'|'ASTM'|'CEN'
  version TEXT NOT NULL,
  publication_year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'current', -- 'current'|'withdrawn'|'under_revision'
  supersedes TEXT,                        -- previous standard number
  scope_keywords TEXT[] NOT NULL DEFAULT '{}',
  fda_recognized BOOLEAN NOT NULL DEFAULT FALSE,
  eu_harmonized BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_standards_catalog_body ON standards_catalog(body);
CREATE INDEX idx_standards_catalog_fda ON standards_catalog(fda_recognized);
CREATE INDEX idx_standards_catalog_eu ON standards_catalog(eu_harmonized);
