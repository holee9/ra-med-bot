-- SPEC-V3-AUDIT-CHAIN-001 M0: audit_log SHA-256 hash chain infrastructure.
-- Migration 0111: chain_seq column + index + audit_chain.violation_detected action.
--
-- Resolves plan-auditor v0.2.0 Critical/High:
--   C1 (app-side UUID) — enabled by chain_seq deterministic ordering.
--   C2 (verify recurrence) — chain_seq is the monotonic tie-break (M3 fix).
--   C3 (concurrency) — chain_seq + advisory_xact_lock (M1) serialize appends.
--
-- 21 CFR Part 11 §11.10(e) tamper-evidence: previous_hash (already present via
-- migration 0109, TEXT hex SHA-256) + chain_seq together enable forward chain
-- verification. Existing rows keep chain_seq=0 (NULL-previous genesis segment,
-- Strategy B backfill — append-only trigger forbids UPDATE).

-- 1. chain_seq column: monotonic chain sequence for tie-break + prev-row lookup.
--    NOT NULL with default 0 so existing rows form the genesis segment without UPDATE.
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS chain_seq BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN audit_logs.chain_seq IS
  'Monotonic chain sequence (SPEC-V3-AUDIT-CHAIN-001). writeAudit sets = prev.chain_seq + 1. '
  'Tie-breaks equal created_at for deterministic chain ordering (21 CFR Part 11).';

-- 2. Index for fast prev-row lookup in writeAudit (fetchPreviousChainLink):
--    SELECT ... ORDER BY chain_seq DESC, created_at DESC, id DESC LIMIT 1.
CREATE INDEX IF NOT EXISTS idx_audit_logs_chain_seq ON audit_logs (chain_seq);

-- 3. audit_chain.violation_detected action: emitted by the verify cron (M3) when
--    a chain break is detected. PostgreSQL requires ALTER TYPE ... ADD VALUE to
--    run outside a transaction block (pattern from 0110_audit_impact_actions.sql).
DO $$
BEGIN
  ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'audit_chain.violation_detected';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
