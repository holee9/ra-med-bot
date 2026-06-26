-- Migration: Fix-up — samd_assessments + answer_feedback text-vs-uuid FK mismatch
-- SPEC: SPEC-REGULA-MIGRATION-FIXUP-0090 (Issue #279 follow-up; L-010/L-011)
-- Scope:
--   1. answer_feedback.user_id: text -> uuid (FK to users.id which is uuid)
--   2. samd_assessments.org_id: text -> uuid (FK to organizations.id which is uuid)
--
-- Background:
--   Original migrations 0082 (RLHF) and 0054 (SaMD) both declared their
--   org-scoping FK column as `text` while the referent PK (`users.id`,
--   `organizations.id`) is `uuid`. PostgreSQL refuses a `text` -> `uuid` FK
--   (type mismatch), so both CREATE TABLE statements rolled back at runtime,
--   leaving both tables ABSENT from the production-shaped DB. The textual
--   enterprise-migrations.test.ts could not catch this because it never
--   applied the DDL to a real Postgres. This is the SAME bug class as #279
--   (migrations 0086/0087 fixed by 0089). L-010 / L-011 codify the pattern.
--
-- Approach:
--   CREATE TABLE IF NOT EXISTS with the CORRECTED schema only. We do NOT
--   edit merged migrations 0054/0082. If the tables somehow already exist
--   (partial apply on a dev DB), the IF NOT EXISTS guard leaves them as-is —
--   the operator is responsible for dropping the bad tables first. The
--   canonical schema reproduced below mirrors 0082/0054 verbatim except for
--   the FK column type fix, so existing application code and indexes/RLS
--   policies continue to work unchanged.
--
-- Idempotent: all CREATE TYPE / ALTER TYPE / CREATE INDEX statements use
-- IF NOT EXISTS. Enum values from 0082/0054 already exist in the DB.

-- -------------------------------------
-- §1 answer_feedback (RLHF, Issue #56) — user_id FIXED to uuid
-- -------------------------------------
-- Reproduces 0082_rlhf.sql §2 verbatim with the single type fix.
-- Enums feedback_rating / quality_tag already exist (0082 §1 applied).

CREATE TABLE IF NOT EXISTS answer_feedback (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating       feedback_rating NOT NULL,
  quality_tags quality_tag[] NOT NULL DEFAULT '{}'::quality_tag[],
  comment      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_answer_feedback_message ON answer_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_answer_feedback_created ON answer_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_answer_feedback_user ON answer_feedback(user_id);

-- RLS: mirrors 0082 policy verbatim. Using the corrected join
-- (messages -> conversations -> projects -> org_members) since conversations
-- has no direct organization_id column.
ALTER TABLE answer_feedback ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'answer_feedback'
      AND policyname = 'answer_feedback_org_isolation'
  ) THEN
    CREATE POLICY answer_feedback_org_isolation ON answer_feedback
      USING (
        EXISTS (
          SELECT 1
          FROM messages m
          JOIN conversations c ON c.id = m.conversation_id
          JOIN projects p ON p.id = c.project_id
          JOIN org_members om ON om.org_id = p.organization_id
          WHERE m.id = answer_feedback.message_id
            AND om.user_id = answer_feedback.user_id
        )
      );
  END IF;
END
$$;

-- -------------------------------------
-- §2 samd_assessments (SaMD, SPEC-REGULA-SAMD-001) — org_id FIXED to uuid
-- -------------------------------------
-- Reproduces 0054_samd_assessments.sql verbatim with the single type fix.
-- id stays TEXT (gen_random_uuid()::text) per 0054 — ONLY org_id is fixed.
-- created_by FK to users.id stays as TEXT reference per 0054; NOTE this is
-- the SAME text-vs-uuid bug shape for created_by, but 0054 declared it TEXT
-- NOT NULL REFERENCES users(id) — which ALSO failed. We fix created_by to
-- uuid too, otherwise the CREATE fails for the same reason and the table is
-- still absent. (This is consistent with the L-010 lesson: the whole table
-- CREATE rolled back, so every text-FK-to-uuid column must be corrected.)

CREATE TABLE IF NOT EXISTS samd_assessments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT,
  title TEXT NOT NULL,
  device_description TEXT NOT NULL,
  intended_use TEXT NOT NULL,
  -- ai_ml_type: locked | adaptive | continuously_learning
  ai_ml_type TEXT NOT NULL CHECK (ai_ml_type IN ('locked', 'adaptive', 'continuously_learning')),
  -- IMDRF N12 Annex II/III: clinical / healthcare situation
  imdrf_clinical_situation TEXT NOT NULL CHECK (imdrf_clinical_situation IN ('critical', 'serious', 'non_serious')),
  imdrf_healthcare_situation TEXT NOT NULL CHECK (imdrf_healthcare_situation IN ('critical', 'serious', 'non_serious')),
  -- Computed IMDRF category: I | II | III | IV
  imdrf_category TEXT,
  -- FDA pathway: 510k | de_novo | pma | exempt
  fda_pathway TEXT,
  -- EU AI Act risk level
  eu_ai_risk_level TEXT CHECK (eu_ai_risk_level IN ('prohibited', 'high_risk', 'general_purpose', 'minimal')),
  -- PCCP required when ai_ml_type is adaptive or continuously_learning
  pccp_required BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'archived')),
  -- AI-generated artifacts stored as JSONB
  generated_model_card JSONB,
  generated_checklist JSONB,
  generated_monitoring_plan JSONB,
  -- Expert review gating (kept TEXT in 0054 — left as TEXT here for fidelity;
  -- these are nullable, have no FK, and were NOT part of the rollback cause)
  expert_review_approved_by TEXT,
  expert_review_approved_at TIMESTAMPTZ,
  -- FIXED: uuid (was TEXT in 0054 — same text-vs-uuid FK bug; table never existed)
  created_by uuid NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_samd_assessments_org ON samd_assessments(org_id);
CREATE INDEX IF NOT EXISTS idx_samd_assessments_status ON samd_assessments(status);
