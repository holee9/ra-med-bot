-- Migration: 0030_predicate_index
-- SPEC-REGULA-PREDICATE-001 M1 — index for predicate-comparison history queries.
-- REQ-PRE-023: fast per-user listing of predicate_comparison runs, newest first.
--
-- ORDERING (TR6): this migration USES workflow_type = 'predicate_comparison' in
-- the partial-index predicate, so it MUST run after 0029_predicate_workflow_type.sql
-- has committed (Postgres forbids using a freshly added enum value in the same txn).
--
-- CONCURRENTLY: built without an ACCESS EXCLUSIVE lock so production writes to
-- workflow_runs are not blocked. CREATE INDEX CONCURRENTLY cannot run inside a
-- transaction block, so this file intentionally has no BEGIN/COMMIT wrapper.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_runs_user_predicate
  ON workflow_runs (user_id, workflow_type, created_at DESC)
  WHERE workflow_type = 'predicate_comparison';
