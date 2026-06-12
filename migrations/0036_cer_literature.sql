-- Migration: Create cer_literature table (REQ-CER-013)
-- SPEC: SPEC-REGULA-CER-001
-- Stores PubMed literature search results per CER workflow run,
-- including SIGN 50 / GRADE evidence appraisal and inclusion/exclusion decisions.

CREATE TABLE IF NOT EXISTS cer_literature (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cer_run_id   uuid        NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  pmid         text        NOT NULL,
  title        text        NOT NULL,
  abstract     text,
  vancouver_citation text,
  sign50_level text,
  grade_quality text,
  included     boolean     NOT NULL DEFAULT false,
  exclusion_reason text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cer_literature_run_idx ON cer_literature(cer_run_id);
CREATE INDEX IF NOT EXISTS cer_literature_pmid_idx ON cer_literature(pmid);
