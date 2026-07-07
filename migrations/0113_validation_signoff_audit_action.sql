-- SPEC-REGULA-VALIDATION-001 M5: validation sign-off audit action.
-- Migration 0113: Add 'validation.signoff' to audit_action enum.
--
-- REQ-VAL-012 — when a validation sign-off is recorded, the system writes one
-- audit_logs row (hash-chained per SPEC-V3-AUDIT-CHAIN-001 / PR #356) with this
-- action containing approver id, timestamp, and report artifact path.
--
-- Pattern follows 0100_audit_action_lockstep.sql and 0110_audit_impact_actions.sql.
-- PostgreSQL requires ALTER TYPE ... ADD VALUE to run outside a transaction.
--
-- Lock-step: schema.ts auditActionEnum + lib/audit.ts AuditAction type MUST be
-- updated in the same PR or runtime inserts will fail.

-- validation.signoff — final release validation sign-off (M5 sign-off route).
DO $$
BEGIN
  ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'validation.signoff';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
