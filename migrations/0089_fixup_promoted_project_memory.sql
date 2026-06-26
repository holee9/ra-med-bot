-- Migration: Fix-up promoted_answers + project_memory (Issues #50 / #51)
-- SPEC: SPEC-REGULA-KNOWLEDGE-PROMO-001 / SPEC-REGULA-PROJECT-MEMORY-001
-- Scope:
--   1. CREATE TABLE IF NOT EXISTS promoted_answers — FIXES 0086 bug:
--      `promoted_by text` was incompatible with `users.id uuid` FK target,
--      causing "Key columns ... are of incompatible types: text and uuid" and
--      rolling back the entire 0086 CREATE TABLE. Now `promoted_by uuid`.
--   2. CREATE TABLE IF NOT EXISTS project_memory — FIXES 0087 bug:
--      inline `CONSTRAINT ... UNIQUE NULLS NOT DISTINCT (cols) WHERE status='active'`
--      is invalid PostgreSQL syntax (WHERE is not permitted on an inline
--      table CONSTRAINT; partial uniqueness requires CREATE UNIQUE INDEX).
--      Now expressed as CREATE UNIQUE INDEX ... NULLS NOT DISTINCT WHERE.
--
-- Rationale (do NOT edit 0086/0087 — merged history):
--   Both source migrations remain in the repo as historical record. Their
--   CREATE TABLE statements fail at runtime in real PostgreSQL, so this
--   fix-up migration is the authoritative creation path for production DBs.
--   The IF NOT EXISTS guards make this idempotent: if a future operator
--   manually created the tables, 0089 becomes a no-op.
--
-- @MX:WARN [AUTO] FIX-UP migration — 0086/0087 are BROKEN at runtime.
--   @MX:REASON 0086 promoted_by text-vs-uuid FK type mismatch; 0087 inline
--     WHERE on CONSTRAINT is invalid PG syntax. Both CREATE TABLEs rolled
--     back, leaving promoted_answers + project_memory ABSENT from the DB.
--   @MX:REASON The textual enterprise-migrations.test.ts could not catch
--     either bug (it greps SQL text, never connects to PG). A real-DB
--     integration test (tests/integration/migrations-real-db.test.ts) is
--     added alongside this migration to prevent regression (L-007 extension).
--
-- Regulatory anchors:
--   21 CFR Part 11 — promoted_answers and project_memory hold RA decision
--     records referenced by audit_logs; their absence broke consult flows
--     (HTTP 500). This migration restores production availability.

-- -------------------------------------
-- §1 promoted_answers (FIX: promoted_by uuid)
-- -------------------------------------
-- Mirrors 0086 §2 exactly EXCEPT promoted_by type: text -> uuid.
-- Re-deriving enum/INDEX/RLS here so this migration is self-contained.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promoted_answer_status') THEN
    CREATE TYPE promoted_answer_status AS ENUM ('active', 'unpromoted');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS promoted_answers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  title             text NOT NULL,
  tags              text[] NOT NULL DEFAULT '{}'::text[],
  promoted_by       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  promoted_at       timestamptz NOT NULL DEFAULT now(),
  status            promoted_answer_status NOT NULL DEFAULT 'active',
  embedding         vector(1536),
  UNIQUE(source_message_id)
);

CREATE INDEX IF NOT EXISTS idx_promoted_answers_org_active
  ON promoted_answers(org_id, status);
CREATE INDEX IF NOT EXISTS idx_promoted_answers_tags
  ON promoted_answers USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_promoted_answers_embedding
  ON promoted_answers USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

ALTER TABLE promoted_answers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'promoted_answers' AND policyname = 'promoted_answers_org_isolation'
  ) THEN
    CREATE POLICY promoted_answers_org_isolation ON promoted_answers
      USING (
        EXISTS (
          SELECT 1
          FROM messages m
          JOIN conversations c ON c.id = m.conversation_id
          JOIN projects p ON p.id = c.project_id
          JOIN org_members om ON om.org_id = p.organization_id
          WHERE m.id = promoted_answers.source_message_id
            AND om.org_id = promoted_answers.org_id
        )
      );
  END IF;
END $$;

-- -------------------------------------
-- §2 project_memory (FIX: partial UNIQUE INDEX not inline CONSTRAINT)
-- -------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_memory_type') THEN
    CREATE TYPE project_memory_type AS ENUM (
      'device_classification',
      'target_markets',
      'submission_strategy',
      'predicate_device',
      'risk_class',
      'custom'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_memory_status') THEN
    CREATE TYPE project_memory_status AS ENUM ('active', 'pending', 'invalidated');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS project_memory (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  memory_type           project_memory_type NOT NULL,
  key                   text NOT NULL,
  value                 text NOT NULL,
  source_conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  created_by            uuid NOT NULL REFERENCES users(id),
  status                project_memory_status NOT NULL DEFAULT 'active',
  valid_from            timestamptz NOT NULL DEFAULT now(),
  valid_until           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- REQ-012 atomicity DB-level guard: at most one active row per (project, key).
-- FIX: partial uniqueness expressed as CREATE UNIQUE INDEX (not inline
-- CONSTRAINT ... WHERE, which PostgreSQL rejects).
CREATE UNIQUE INDEX IF NOT EXISTS project_memory_one_active_per_key
  ON project_memory (project_id, key) NULLS NOT DISTINCT
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_project_memory_lookup
  ON project_memory(project_id, key, valid_until);
CREATE INDEX IF NOT EXISTS idx_project_memory_project_status
  ON project_memory(project_id, status);

ALTER TABLE project_memory ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'project_memory' AND policyname = 'project_memory_org_isolation'
  ) THEN
    CREATE POLICY project_memory_org_isolation ON project_memory
      USING (
        EXISTS (
          SELECT 1
          FROM projects p
          JOIN org_members om ON om.org_id = p.organization_id
          WHERE p.id = project_memory.project_id
        )
      );
  END IF;
END $$;
