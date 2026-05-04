-- SPEC-REGULA-DOCINGEST-001 (REQ-DOC-8A-7)
-- Phase 8A: Add 6 document audit action values to existing audit_action enum
-- IF NOT EXISTS guard ensures idempotency

BEGIN;

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'document.upload';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'document.access';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'document.redact';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'document.chunk';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'document.search';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'redaction_map.access';

COMMIT;
