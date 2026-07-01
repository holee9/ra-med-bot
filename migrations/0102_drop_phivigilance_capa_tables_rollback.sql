-- 0102_drop_phivigilance_capa_tables_rollback.sql
-- Rollback for 0102_drop_phivigilance_capa_tables.sql.
-- SPEC-REGULA-PHI-REMOVAL-001 (Issue #319).
--
-- NOTE: data is NOT recoverable (corpus was 0 at drop time). This script
-- restores the schema only, based on the original migrations:
--   0044_vigilance_tables.sql, 0073_capa.sql, 0076_clinical_investigation.sql.
-- Re-apply the original migrations if you need full fidelity (indexes, RLS,
-- CHECK constraints). This script reconstructs the bare table shapes.

-- ===========================================================================
-- 1. Restore ci_events vigilance coupling.
-- ===========================================================================

ALTER TABLE ci_events ALTER COLUMN type TYPE text USING type::text;
DROP TYPE IF EXISTS ci_event_type;
CREATE TYPE ci_event_type AS ENUM ('milestone', 'deviation', 'adverse_event');
UPDATE ci_events SET type = 'milestone' WHERE type NOT IN ('milestone', 'deviation', 'adverse_event');
ALTER TABLE ci_events
  ALTER COLUMN type TYPE ci_event_type USING type::ci_event_type;

ALTER TABLE ci_events ADD COLUMN vigilance_ref text;
CREATE INDEX IF NOT EXISTS idx_ci_events_vigilance
  ON ci_events(vigilance_ref) WHERE vigilance_ref IS NOT NULL;

-- ===========================================================================
-- 2. Restore vigilance tables (3) — see 0044_vigilance_tables.sql for full DDL.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS adverse_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id uuid REFERENCES workflow_runs(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  device_name text NOT NULL,
  device_model text,
  lot_number text,
  event_description text NOT NULL,
  patient_outcome text NOT NULL,
  awareness_date date NOT NULL,
  reporter_name text NOT NULL,
  reporter_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL
);

CREATE TABLE IF NOT EXISTS reportability_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adverse_event_id uuid NOT NULL REFERENCES adverse_events(id) ON DELETE CASCADE,
  fda_mdr_required boolean NOT NULL,
  fda_mdr_deadline_days integer,
  eu_mdv_required boolean NOT NULL,
  eu_mdv_deadline_days integer,
  fsca_required boolean NOT NULL,
  assessment_rationale text NOT NULL,
  assessed_by_ai boolean NOT NULL DEFAULT true,
  reviewed_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vigilance_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adverse_event_id uuid NOT NULL REFERENCES adverse_events(id) ON DELETE CASCADE,
  report_type text NOT NULL,
  report_format text NOT NULL,
  draft_content jsonb NOT NULL DEFAULT '{}',
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  submission_deadline date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===========================================================================
-- 3. Restore CAPA enums + tables (5) — see 0073_capa.sql for full DDL.
-- ===========================================================================

CREATE TYPE complaint_reportability_status AS ENUM ('pending', 'reportable', 'not_reportable');
CREATE TYPE capa_type AS ENUM ('corrective', 'preventive');
CREATE TYPE capa_status AS ENUM ('open', 'in_review', 'closed');
CREATE TYPE capa_effectiveness_status AS ENUM ('pending', 'scheduled', 'passed', 'failed');

CREATE TABLE IF NOT EXISTS complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workflow_run_id uuid REFERENCES workflow_runs(id) ON DELETE SET NULL,
  intake_data jsonb NOT NULL DEFAULT '{}',
  reportability_status text NOT NULL DEFAULT 'pending',
  vigilance_ref uuid,
  trend_signature text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capa_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  type text NOT NULL,
  description text NOT NULL,
  owner_id uuid NOT NULL REFERENCES users(id),
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'open',
  effectiveness_status text NOT NULL DEFAULT 'pending',
  closed_by uuid REFERENCES users(id),
  closed_at timestamptz,
  close_signature_hash text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capa_root_causes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  capa_id uuid NOT NULL REFERENCES capa_records(id) ON DELETE CASCADE,
  method text NOT NULL,
  analysis_data jsonb NOT NULL DEFAULT '{}',
  summary text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capa_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  capa_id uuid NOT NULL REFERENCES capa_records(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capa_effectiveness_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  capa_id uuid NOT NULL REFERENCES capa_records(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  checked_at timestamptz,
  result text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
