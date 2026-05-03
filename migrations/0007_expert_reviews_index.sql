-- @MX:NOTE [AUTO] Phase 5 Enterprise Hardening — expert_reviews composite index.
-- Risk R9 mitigation: expert review queue queries filter by status and assigned_to.
-- Without this index, queue scans are sequential for growing tables.
--
-- Index is created IF NOT EXISTS for idempotency.

CREATE INDEX IF NOT EXISTS idx_expert_reviews_status_assigned
  ON expert_reviews (status, assigned_to);

-- Rollback (Phase 6 down script placeholder):
-- DROP INDEX IF EXISTS idx_expert_reviews_status_assigned;
