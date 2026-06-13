-- SPEC-REGULA-ESUBMIT-001: Electronic submission package builder
-- Tracks submission packages (510k, De Novo, PMA, CER, PCCP, MFDS, NMPA) with
-- validation results and regulatory interaction history.

CREATE TABLE submission_packages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  submission_type TEXT NOT NULL CHECK (submission_type IN ('510k','de_novo','pma','cer','pccp','mfds_import','nmpa_ecdt')),
  jurisdiction TEXT NOT NULL CHECK (jurisdiction IN ('FDA','EU','MFDS','NMPA','PMDA')),
  device_name TEXT NOT NULL,
  submission_number TEXT,
  version TEXT NOT NULL DEFAULT '1.0',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','validating','validated','submitted','rta','accepted','rejected')),
  package_manifest JSONB NOT NULL DEFAULT '{}',
  validation_results JSONB NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL REFERENCES users(id),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE submission_interactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  package_id TEXT NOT NULL REFERENCES submission_packages(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('rta','ai_request','deficiency','approval','rejection')),
  reference_number TEXT,
  description TEXT NOT NULL,
  due_date DATE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_submission_packages_org ON submission_packages(org_id);
CREATE INDEX idx_submission_interactions_pkg ON submission_interactions(package_id);
