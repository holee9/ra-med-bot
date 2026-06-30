-- 0100_audit_action_lockstep.sql
-- audit_action enum lock-step 보정 (Issue #307 진단 중 식별).
-- schema.ts auditActionEnum / AuditAction type에 있으나 DB enum에 누락된 3개 추가.
-- (submission lifecycle — 이전 PR에서 schema 추가 후 migration 누락)
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'submission_package_created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'submission_package_submitted';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'submission_validation_completed';
