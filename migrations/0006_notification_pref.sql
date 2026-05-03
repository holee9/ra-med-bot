-- @MX:NOTE [AUTO] Phase 5 Enterprise Hardening — users.notification_pref column.
-- @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-027)
--
-- Adds a jsonb notification_pref column to the users table.
-- This column is a placeholder in Phase 5; it is NOT read by Phase 5 code.
-- Phase 6 will populate and read this column.
--
-- Default is empty object '{}' — safe to add to existing rows.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_pref jsonb NOT NULL DEFAULT '{}';

-- Rollback (Phase 6 down script placeholder):
-- ALTER TABLE users DROP COLUMN IF EXISTS notification_pref;
