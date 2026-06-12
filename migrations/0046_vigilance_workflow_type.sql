-- SPEC-REGULA-VIGILANCE-001 — Add 'vigilance' to workflow_type enum.

ALTER TYPE "workflow_type" ADD VALUE IF NOT EXISTS 'vigilance';
