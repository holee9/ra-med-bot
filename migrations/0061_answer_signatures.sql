-- SPEC-REGULA-ESIG-001: Electronic signature for answer approvals (21 CFR Part 11 §11.50/§11.70)
-- Migration: 0061_answer_signatures.sql

-- Add qa-lead role to user_role enum (RBAC: only ra-lead, qa-lead, admin can sign)
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'qa-lead';

-- Add signature audit actions to audit_action enum
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'signature.applied';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'signature.revoked';

-- answer_signatures: electronic signature records linked to messages (answers)
-- §11.70: each row cryptographically links the signature to the signed record via record_hash
CREATE TABLE IF NOT EXISTS "answer_signatures" (
  "id"           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "message_id"   uuid        NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "signer_id"    text        NOT NULL,
  "signer_name"  text        NOT NULL,
  "signer_title" text,
  "meaning"      text        NOT NULL,
  "record_hash"  text        NOT NULL,
  "signed_at"    timestamp   NOT NULL DEFAULT now(),
  "revoked_at"   timestamp,
  "revoked_by"   text
);

-- Partial unique index: enforce at most one ACTIVE (non-revoked) signature per answer.
-- Allows historical revoked signatures to co-exist for audit trail integrity.
CREATE UNIQUE INDEX IF NOT EXISTS "answer_signatures_active_idx"
  ON "answer_signatures" ("message_id")
  WHERE "revoked_at" IS NULL;
