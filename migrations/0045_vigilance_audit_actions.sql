-- SPEC-REGULA-VIGILANCE-001 — Vigilance audit action enum values.
-- Appends 4 new values to the existing audit_action pgEnum.

ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'vigilance_event_created';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'vigilance_reportability_assessed';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'vigilance_report_drafted';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'vigilance_report_exported';
