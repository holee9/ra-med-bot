-- Migration: 0032_predicate_export_audit_action
-- SPEC-REGULA-PREDICATE-001 — audit_action enum extension for export.
-- REQ-PRE-015: predicate comparison export (PDF/DOCX) audited for 21 CFR Part 11
-- traceability.
--
-- LOCK-STEP: this value must mirror the AuditAction union in lib/audit.ts and
-- the auditActionEnum array in lib/db/schema.ts. Adding it here lets runtime
-- INSERTs into audit_logs succeed; without it the export workflow fails closed.
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'predicate_comparison_exported';
