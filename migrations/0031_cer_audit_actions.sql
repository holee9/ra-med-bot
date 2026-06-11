-- Migration: Add CER audit actions to audit_action enum (REQ-CER-036~040)
-- SPEC: SPEC-REGULA-CER-001
-- 21 CFR Part 11 compliance — CER workflow events must be audit-logged.

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'cer_created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'cer_stage_completed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'cer_expert_approved';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'cer_exported';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'cer_literature_search';
