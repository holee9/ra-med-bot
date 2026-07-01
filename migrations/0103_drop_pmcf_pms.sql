-- 0103_drop_pmcf_pms.sql
-- SPEC-REGULA-PHI-REMOVAL-001 (Issue #319): Regula does NOT handle patient
-- information. Drop the PMCF/PMS clinical-data domain — pms_inputs (complaint
-- / vigilance / SUSAR data), pms_documents (generated PMSR/PMCF documents),
-- and the 3 workflow_type values 'pms_report', 'pmcf_plan', 'pmcf_evaluation',
-- the ci_link_target_type 'pms' value, and the 8 pms.*/pmcf.* audit_action
-- values.
--
-- Rationale: PMCF tracks adverse events in clinical study subjects
-- (lib/workflows/pmcf-evaluation/executor.ts — "Recorded X adverse events out
-- of Y subjects, rate"). PMS reports carry complaint_data, vigilance_data,
-- SUSAR/trend, and PMCF findings. Both constitute patient safety data which
-- Regula's policy excludes.
--
-- CER boundary preserved: lib/workflows/cer/ is NOT touched. The CER's
-- 'pmcf_plan' step (MEDDEV 2.7/1 Rev4 step 9) documents the post-market
-- follow-up plan as a regulatory submission artifact — it is CER document
-- content, not subject-level patient data, and is retained. esubmit's
-- REQUIRED_SECTIONS_CER pmcf_plan (EU MDR submission requirement) is also
-- retained.
--
-- Pre-flight (MUST be 0 — confirmed 2026-07-01):
--   SELECT COUNT(*) FROM pms_inputs;                                              -- 0
--   SELECT COUNT(*) FROM pms_documents;                                           -- 0
--   SELECT COUNT(*) FROM ci_links WHERE target_type='pms';                        -- 0
--   SELECT COUNT(*) FROM workflow_runs WHERE workflow_type IN                     -- 0
--     ('pms_report','pmcf_plan','pmcf_evaluation');
--   SELECT COUNT(*) FROM audit_logs WHERE action::text LIKE 'pms.%'               -- 0
--     OR action::text LIKE 'pmcf.%';
--
-- Enum-rebuild strategy: Postgres has no DROP VALUE. The type is rebuilt from
-- its live pg_enum values MINUS the removed values, via a DO block with
-- dynamic SQL. This is self-correcting: it never drops a value it shouldn't,
-- and never needs a hardcoded list (the live audit_action enum has ~200
-- historical values not mirrored in lib/db/schema.ts). Mirrors the 0102
-- pattern (ci_event_type rebuild).

-- ===========================================================================
-- 1. pms_documents + pms_inputs tables — drop with CASCADE so RLS policies
--    and indexes go with them. pms_documents first (no inbound FKs from
--    other tables).
-- ===========================================================================

DROP TABLE IF EXISTS pms_documents CASCADE;
DROP TABLE IF EXISTS pms_inputs CASCADE;

-- ===========================================================================
-- 2. Enum rebuilds — ci_link_target_type, workflow_type, audit_action.
--    For each: widen the column to text, drop the type, recreate it from the
--    surviving live values (excluding the removed ones), coerce any legacy
--    rows defensively, then reattach the typed column.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 2a. ci_link_target_type — remove 'pms'. Single dependent column:
--     ci_links.target_type. Pre-flight confirmed 0 rows use 'pms'.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  new_vals text;
BEGIN
  SELECT string_agg(quote_literal(enumlabel), ', ' ORDER BY enumsortorder)
    INTO new_vals
    FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ci_link_target_type')
      AND enumlabel <> 'pms';

  ALTER TABLE ci_links ALTER COLUMN target_type TYPE text USING target_type::text;
  EXECUTE format('DROP TYPE ci_link_target_type');
  EXECUTE format('CREATE TYPE ci_link_target_type AS ENUM (%s)', new_vals);
END $$;

-- Defensive: any legacy 'pms' rows -> 'cer' (pre-flight count = 0).
UPDATE ci_links SET target_type = 'cer' WHERE target_type = 'pms';
ALTER TABLE ci_links
  ALTER COLUMN target_type TYPE ci_link_target_type USING target_type::ci_link_target_type;

-- ---------------------------------------------------------------------------
-- 2b. workflow_type — remove 'pms_report', 'pmcf_plan', 'pmcf_evaluation'.
--     Dependent columns after step 1: workflow_runs.workflow_type only
--     (pms_documents dropped). Pre-flight confirmed 0 rows use these values.
--
--     The partial index idx_workflow_runs_user_predicate has a predicate
--     `WHERE workflow_type = 'predicate_comparison'::workflow_type` that
--     casts to the enum type. The cast blocks the column-type widen+drop,
--     so the index is dropped before the rebuild and recreated after.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_workflow_runs_user_predicate;

DO $$
DECLARE
  new_vals text;
BEGIN
  SELECT string_agg(quote_literal(enumlabel), ', ' ORDER BY enumsortorder)
    INTO new_vals
    FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'workflow_type')
      AND enumlabel NOT IN ('pms_report', 'pmcf_plan', 'pmcf_evaluation');

  ALTER TABLE workflow_runs ALTER COLUMN workflow_type TYPE text USING workflow_type::text;
  EXECUTE format('DROP TYPE workflow_type');
  EXECUTE format('CREATE TYPE workflow_type AS ENUM (%s)', new_vals);
END $$;

-- Defensive: coerce any legacy PMS/PMCF rows to NULL (pre-flight count = 0).
UPDATE workflow_runs
  SET workflow_type = NULL
  WHERE workflow_type IN ('pms_report', 'pmcf_plan', 'pmcf_evaluation');
ALTER TABLE workflow_runs
  ALTER COLUMN workflow_type TYPE workflow_type USING workflow_type::workflow_type;

-- Recreate the partial index with the (now-enum-again) cast restored.
CREATE INDEX IF NOT EXISTS idx_workflow_runs_user_predicate
  ON workflow_runs (user_id, workflow_type, created_at DESC)
  WHERE workflow_type = 'predicate_comparison'::workflow_type;

-- ---------------------------------------------------------------------------
-- 2c. audit_action — remove the 8 pms.*/pmcf.* values. Dependent column:
--     audit_logs.action. The append-only trigger guards row UPDATE/DELETE
--     but does not block column-type rebuild (DDL, not row mutation).
--     Pre-flight confirmed 0 rows match pms.% / pmcf.%.
--     Live enum has ~200 historical values; the DO block preserves all of
--     them except the 8 being removed.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  new_vals text;
BEGIN
  SELECT string_agg(quote_literal(enumlabel), ', ' ORDER BY enumsortorder)
    INTO new_vals
    FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action')
      AND enumlabel NOT LIKE 'pms.%'
      AND enumlabel NOT LIKE 'pmcf.%';

  ALTER TABLE audit_logs ALTER COLUMN action TYPE text USING action::text;
  EXECUTE format('DROP TYPE audit_action');
  EXECUTE format('CREATE TYPE audit_action AS ENUM (%s)', new_vals);
END $$;

-- Defensive: any legacy pms.*/pmcf.* rows should not exist (count = 0).
-- Delete rather than block the rebuild — the domain is retired wholesale.
DELETE FROM audit_logs WHERE action::text LIKE 'pms.%' OR action::text LIKE 'pmcf.%';
ALTER TABLE audit_logs
  ALTER COLUMN action TYPE audit_action USING action::audit_action;
