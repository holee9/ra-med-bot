-- SPEC-V3-IMPACT-001 — Impact Wizard M8: Rollback wizard columns
-- Migration 0109 Rollback: Remove 7 wizard columns + previous_hash

BEGIN;

-- 1. Drop wizard columns from regulatory_impact_assessments
ALTER TABLE regulatory_impact_assessments
  DROP COLUMN IF EXISTS wizard_type,
  DROP COLUMN IF EXISTS change_category,
  DROP COLUMN IF EXISTS change_detail,
  DROP COLUMN IF EXISTS markets,
  DROP COLUMN IF EXISTS retest_matrix_results,
  DROP COLUMN IF EXISTS llm_category,
  DROP COLUMN IF EXISTS rag_similar_cases;

-- 2. Drop previous_hash from audit_logs
ALTER TABLE audit_logs
  DROP COLUMN IF EXISTS previous_hash;

COMMIT;
