-- Migration: Add cer_persisted audit action (Issue #255, REQ-CER-036 provenance split)
-- SPEC: SPEC-REGULA-CER-001 follow-up
-- 21 CFR Part 11 compliance — splits the CER deliverable-persist audit row from
-- the run-initiation row so `cer_created` unambiguously means "run initiated"
-- and `cer_persisted` means "deliverable stored, atomic with workflow_runs insert".
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'cer_persisted';
