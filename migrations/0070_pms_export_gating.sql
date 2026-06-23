-- Migration: 0070_pms_export_gating.sql
-- SPEC-REGULA-PMS-001 (REQ-PMS-009, AC-07)
-- Adds audit_action enum values for server-side expert-review gating on PMS/PMCF
-- document close/export. Documents in draft/pending_review cannot be closed.

-- Add two new audit_action values for the close-route gating (REQ-PMS-009).
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'pms.report_export_denied';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'pms.report_closed';
