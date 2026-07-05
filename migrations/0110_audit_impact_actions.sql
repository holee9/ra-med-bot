-- SPEC-V3-IMPACT-001 M10: Add impact audit actions to enum.
-- Migration 0110: Add 'impact.check', 'impact.ticket.create', 'impact.critical_detected', 'impact.view'

-- NOTE: PostgreSQL requires ALTER TYPE ... ADD VALUE to run outside a transaction.
-- This migration follows the pattern from 0104_inbox_tickets_and_approved_answers.sql.

-- Add impact.check
DO $$
BEGIN
  ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'impact.check';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add impact.ticket.create
DO $$
BEGIN
  ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'impact.ticket.create';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add impact.critical_detected
DO $$
BEGIN
  ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'impact.critical_detected';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add impact.view
DO $$
BEGIN
  ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'impact.view';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
