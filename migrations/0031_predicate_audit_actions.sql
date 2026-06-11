-- Migration: 0031_predicate_audit_actions
-- SPEC-REGULA-PREDICATE-001 M1 — audit_action enum extension.
-- REQ-PRE-017: 2 predicate audit action values for 21 CFR Part 11 traceability.
--
-- LOCK-STEP: these values must mirror the AuditAction union in lib/audit.ts and
-- the auditActionEnum array in lib/db/schema.ts. Adding them here lets runtime
-- INSERTs into audit_logs succeed; without it the regulated workflow fails closed.
--
-- Each ALTER TYPE ... ADD VALUE is a separate statement: PostgreSQL does not
-- support adding multiple enum values in a single ALTER TYPE statement.
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'predicate_search';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'predicate_comparison_generated';
