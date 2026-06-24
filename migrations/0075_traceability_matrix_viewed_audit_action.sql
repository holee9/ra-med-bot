-- Migration: Add traceability.matrix_viewed audit action (Issue #240, REQ-TRACEABILITY-010)
-- SPEC: SPEC-REGULA-TRACEABILITY-001
-- 21 CFR Part 11 compliance — distinct read audit for the traceability matrix view
-- (separate from dashboard.view) so FDA inspectors can unambiguously identify
-- when a user viewed the per-project evidence matrix.
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'traceability.matrix_viewed';
--> statement-breakpoint
