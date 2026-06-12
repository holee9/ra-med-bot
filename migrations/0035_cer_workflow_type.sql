-- Migration: Add 'cer' to workflow_type enum (REQ-CER-012)
-- SPEC: SPEC-REGULA-CER-001

ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'cer';
