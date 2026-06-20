-- SPEC-REGULA-AUDITOR-VIEW-001: external auditor read-only persona.
-- Migration: 0062_auditor_view_enums.sql

-- Add external auditor role to the persisted users.role enum.
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'auditor';

-- Add auditor evidence/audit events to the persisted audit_action enum.
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'audit.access';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'audit.denied';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'audit.package.generated';
