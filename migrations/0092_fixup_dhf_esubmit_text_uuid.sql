-- Migration: Fix-up — design_history_files + submission_packages text-vs-uuid FK mismatch
-- SPEC: SPEC-REGULA-MIGRATION-FIXUP-0092 (Issue #280 follow-up; L-010/L-011)
-- Scope:
--   1. design_history_files.org_id: text -> uuid (FK to organizations.id which is uuid)
--   2. design_history_files.created_by: text -> uuid (FK to users.id which is uuid)
--   3. submission_packages.org_id: text -> uuid (FK to organizations.id which is uuid)
--   4. submission_packages.created_by: text -> uuid (FK to users.id which is uuid)
--
-- Background:
--   Original migrations 0055 (DHF) and 0056 (eSubmit) both declared their
--   org-scoping FK columns as `text` while the referent PKs (`organizations.id`,
--   `users.id`) are `uuid`. PostgreSQL refuses a `text` -> `uuid` FK (type
--   mismatch), so both CREATE TABLE statements rolled back at runtime, leaving
--   all 6 tables ABSENT from the production-shaped DB. The textual
--   enterprise-migrations.test.ts could not catch this because it never
--   applied the DDL to a real Postgres. This is the SAME bug class as #279
--   (migrations 0086/0087 fixed by 0089) and #281 (migrations 0082/0054
--   fixed by 0090). L-010 / L-011 codify the pattern.
--
-- Approach:
--   CREATE TABLE IF NOT EXISTS with the CORRECTED schema only. We do NOT
--   edit merged migrations 0055/0056. If the tables somehow already exist
--   (partial apply on a dev DB), the IF NOT EXISTS guard leaves them as-is —
--   the operator is responsible for dropping the bad tables first. The
--   canonical schema reproduced below mirrors 0055/0056 verbatim except for
--   the FK column type fixes, so existing application code and indexes/RLS
--   policies continue to work unchanged. RLS policies are NOT included in
--   0055/0056 (applied in later migrations 0083/0084), so this migration
--   only reproduces the base DDL.
--
-- Idempotent: all CREATE INDEX statements use IF NOT EXISTS. Enum values from
-- 0055 already exist in the DB (ALTER TYPE audit_action ADD VALUE IF NOT EXISTS).

-- -------------------------------------
-- §1 design_history_files (DHF) — org_id + created_by FIXED to uuid
-- -------------------------------------
-- Reproduces 0055_design_history_files.sql §2 verbatim with type fixes.
-- id stays TEXT (gen_random_uuid()::text) per schema.ts.

CREATE TABLE IF NOT EXISTS design_history_files (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_model TEXT,
  intended_use TEXT NOT NULL,
  jurisdiction TEXT NOT NULL DEFAULT 'FDA' CHECK (jurisdiction IN ('FDA','EU','MFDS','NMPA','PMDA')),
  regulatory_framework TEXT NOT NULL DEFAULT 'QSR_QMSR' CHECK (regulatory_framework IN ('QSR_QMSR','ISO_13485','EU_MDR')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','design_freeze','archived')),
  completeness_score INTEGER NOT NULL DEFAULT 0 CHECK (completeness_score >= 0 AND completeness_score <= 100),
  design_freeze_date DATE,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dhf_org ON design_history_files(org_id);

-- -------------------------------------
-- §2 design_inputs — unchanged (dhf_id TEXT matches design_history_files.id TEXT)
-- -------------------------------------
-- Reproduces 0055_design_history_files.sql §3 verbatim.

CREATE TABLE IF NOT EXISTS design_inputs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dhf_id TEXT NOT NULL REFERENCES design_history_files(id) ON DELETE CASCADE,
  input_type TEXT NOT NULL CHECK (input_type IN ('user_need','regulatory','standards','risk')),
  requirement_id TEXT,
  description TEXT NOT NULL,
  source TEXT,
  priority TEXT NOT NULL DEFAULT 'must' CHECK (priority IN ('must','should','nice_to_have')),
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','not_applicable')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_design_inputs_dhf ON design_inputs(dhf_id);

-- -------------------------------------
-- §3 design_verifications — unchanged (dhf_id TEXT, design_input_id TEXT)
-- -------------------------------------
-- Reproduces 0055_design_history_files.sql §4 verbatim.

CREATE TABLE IF NOT EXISTS design_verifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dhf_id TEXT NOT NULL REFERENCES design_history_files(id) ON DELETE CASCADE,
  design_input_id TEXT REFERENCES design_inputs(id),
  verification_type TEXT NOT NULL CHECK (verification_type IN ('analysis','test','inspection','demonstration')),
  protocol_title TEXT NOT NULL,
  result TEXT CHECK (result IN ('pass','fail','pending','not_started')),
  test_date DATE,
  performed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_design_verifications_dhf ON design_verifications(dhf_id);

-- -------------------------------------
-- §4 design_reviews — unchanged (dhf_id TEXT)
-- -------------------------------------
-- Reproduces 0055_design_history_files.sql §5 verbatim.

CREATE TABLE IF NOT EXISTS design_reviews (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dhf_id TEXT NOT NULL REFERENCES design_history_files(id) ON DELETE CASCADE,
  review_stage TEXT NOT NULL CHECK (review_stage IN ('concept','preliminary','critical','final','design_freeze')),
  review_date DATE NOT NULL,
  attendees TEXT[] NOT NULL DEFAULT '{}',
  decisions TEXT,
  open_actions TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_design_reviews_dhf ON design_reviews(dhf_id);

-- -------------------------------------
-- §5 submission_packages (eSubmit) — org_id + created_by FIXED to uuid
-- -------------------------------------
-- Reproduces 0056_submission_packages.sql verbatim with type fixes.
-- id stays TEXT (gen_random_uuid()::text) per schema.ts.

CREATE TABLE IF NOT EXISTS submission_packages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  submission_type TEXT NOT NULL CHECK (submission_type IN ('510k','de_novo','pma','cer','pccp','mfds_import','nmpa_ecdt')),
  jurisdiction TEXT NOT NULL CHECK (jurisdiction IN ('FDA','EU','MFDS','NMPA','PMDA')),
  device_name TEXT NOT NULL,
  submission_number TEXT,
  version TEXT NOT NULL DEFAULT '1.0',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','validating','validated','submitted','rta','accepted','rejected')),
  package_manifest JSONB NOT NULL DEFAULT '{}',
  validation_results JSONB NOT NULL DEFAULT '[]',
  created_by uuid NOT NULL REFERENCES users(id),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submission_packages_org ON submission_packages(org_id);

-- -------------------------------------
-- §6 submission_interactions — unchanged (package_id TEXT matches submission_packages.id TEXT)
-- -------------------------------------
-- Reproduces 0056_submission_packages.sql verbatim.

CREATE TABLE IF NOT EXISTS submission_interactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  package_id TEXT NOT NULL REFERENCES submission_packages(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('rta','ai_request','deficiency','approval','rejection')),
  reference_number TEXT,
  description TEXT NOT NULL,
  due_date DATE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submission_interactions_pkg ON submission_interactions(package_id);

-- -------------------------------------
-- §7 DHF audit_action enum values (idempotent)
-- -------------------------------------
-- Reproduces 0055_design_history_files.sql §1 verbatim.

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'dhf_created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'dhf_updated';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'dhf_design_freeze';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'dhf_review_approved';
