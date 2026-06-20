-- SPEC-REGULA-EXPORT-HUB-001 Phase 1: Export audit actions
-- REQ-EXP-006: Export operations must be audited
-- Migration: 0043_export_audit_actions.sql

-- Add export-related audit actions to the enum
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'export.markdown';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'export.docx';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'export.pdf';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'export.email';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'export.confluence';
