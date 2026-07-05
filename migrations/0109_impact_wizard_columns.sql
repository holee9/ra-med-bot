-- SPEC-V3-IMPACT-001 — Impact Wizard M8: wizard columns for regulatory_impact_assessments
-- Migration 0109: Add 7 nullable columns for wizard inputs + previous_hash to audit_logs
--
-- Adds:
--   1. wizardType, changeCategory, changeDetail (text) - wizard inputs
--   2. markets (jsonb) - selected markets array
--   3. retestMatrixResults (jsonb) - matrix lookup results
--   4. llmCategory (jsonb) - LLM classification output
--   5. ragSimilarCases (jsonb) - RAG similar cases results
--   6. previousHash (bytea) to audit_logs - for hash chain verification
--
-- All columns are nullable to preserve backward compatibility with existing records.

BEGIN;

-- 1. Add wizard input columns to regulatory_impact_assessments
ALTER TABLE regulatory_impact_assessments
  ADD COLUMN IF NOT EXISTS wizard_type TEXT,
  ADD COLUMN IF NOT EXISTS change_category TEXT,
  ADD COLUMN IF NOT EXISTS change_detail TEXT;

-- 2. Add structured data columns (JSONB)
ALTER TABLE regulatory_impact_assessments
  ADD COLUMN IF NOT EXISTS markets JSONB,
  ADD COLUMN IF NOT EXISTS retest_matrix_results JSONB,
  ADD COLUMN IF NOT EXISTS llm_category JSONB,
  ADD COLUMN IF NOT EXISTS rag_similar_cases JSONB;

-- 3. Add previous_hash to audit_logs for chain verification (text for hex-encoded SHA-256)
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS previous_hash TEXT;

-- 4. Add comment for documentation
COMMENT ON COLUMN regulatory_impact_assessments.wizard_type IS 'Wizard type (e.g., "impact-wizard")';
COMMENT ON COLUMN regulatory_impact_assessments.change_category IS 'Change category from wizard (e.g., "bom", "sw", "label")';
COMMENT ON COLUMN regulatory_impact_assessments.change_detail IS 'Free-text change description from wizard';
COMMENT ON COLUMN regulatory_impact_assessments.markets IS 'Selected markets array (e.g., ["us", "eu", "kr"])';
COMMENT ON COLUMN regulatory_impact_assessments.retest_matrix_results IS 'Retest matrix lookup results per market';
COMMENT ON COLUMN regulatory_impact_assessments.llm_category IS 'LLM classification output (category, confidence, reason)';
COMMENT ON COLUMN regulatory_impact_assessments.rag_similar_cases IS 'RAG similar cases search results';
COMMENT ON COLUMN audit_logs.previous_hash IS 'Hex-encoded hash of previous audit entry for chain verification (21 CFR Part 11, SHA-256 = 64 hex chars)';

COMMIT;
