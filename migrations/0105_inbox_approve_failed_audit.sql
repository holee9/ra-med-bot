-- 0105_inbox_approve_failed_audit.sql
-- H-2 fix: Add inbox.approve_failed audit action for ESIG re-auth failures
-- and promotion domain errors (21 CFR Part 11 audit trail).
-- SPEC-V3-INBOX-001 (REQ-V3-INBOX-012, Issue #320)

-- Add 'inbox.approve_failed' to audit_action enum
ALTER TYPE "audit_action" ADD VALUE 'inbox.approve_failed';

-- Verify the new value
-- SELECT unnest(enum_range(NULL::audit_action));
-- Expected: 'inbox.approve_failed' appears in the list
