-- Migration: 0011_organizations_data_region
-- Adds data_region column to organizations table for EU data residency routing.
-- SPEC-REGULA-CLOUDFLARE-001 (REQ-CF-081)

DO $$ BEGIN
  CREATE TYPE data_region_enum AS ENUM ('us', 'eu', 'apac');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS data_region data_region_enum NOT NULL DEFAULT 'us';

COMMENT ON COLUMN organizations.data_region IS
  'Data residency region for this organization. ''eu'' routes EU MDR corpus queries '
  'to Cloudflare Vectorize EU region. Requires VECTORIZE_EU_GA=true to activate. '
  'Pending Item #2. (REQ-CF-081)';
