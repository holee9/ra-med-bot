-- Migration: Knowledge Promotion — Semantic Search & Team Knowledge Library (Issue #50)
-- SPEC: SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-KNOWLEDGE-PROMO-001~015, AC-01~08)
-- Scope:
--   1. New enum: promoted_answer_status ('active', 'unpromoted')
--   2. New table: promoted_answers (id, org_id, source_message_id, title,
--      tags text[] GIN, promoted_by, promoted_at, status, embedding vector(1536))
--      UNIQUE(source_message_id) + RLS org isolation (mirrors 0082_rlhf.sql §3)
--   3. messages.content_tsv GENERATED tsvector column + GIN index (REQ-001 fulltext)
--   4. audit_action +2 ('answer_promoted', 'answer_unpromoted')
--
-- Regulatory anchors:
--   ISO 13485 consistency — promoted answers accumulate organisational precedent
--   21 CFR Part 11 — promotion / unpromotion is an audit-material record
--   Traceability — promoted_answers.source_message_id gives citation provenance
--
-- Design decisions (tasks.md §7):
--   #1 promoted_answers.embedding is a NEW column (messages.embedding does not exist).
--   #2 General-conversation semantic search is deferred; REQ-002 semantic coverage
--      is limited to promoted_answers in this SPEC (fulltext covers all messages).
--   pgvector ivfflat lists=10 — tuned for small initial dataset; revisit at scale.

-- -------------------------------------
-- §1 New enum
-- -------------------------------------

-- REQ-KNOWLEDGE-PROMO-006 / REQ-KNOWLEDGE-PROMO-014: lifecycle status.
-- 'active' is eligible for RAG retrieval; 'unpromoted' is excluded (REQ-014/AC-08).
CREATE TYPE promoted_answer_status AS ENUM ('active', 'unpromoted');

-- -------------------------------------
-- §2 New table: promoted_answers
-- -------------------------------------

-- REQ-006 / AC-02: promoted Q&A team knowledge library.
-- UNIQUE(source_message_id) prevents duplicate promotion of the same answer
-- (tasks.md §7 "해결된 모호성" — re-promotion re-activates the existing row).
CREATE TABLE promoted_answers (
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

-- REQ-015 / AC-06: tag filtering + org-scoped active listing.
CREATE INDEX idx_promoted_answers_org_active ON promoted_answers(org_id, status);
CREATE INDEX idx_promoted_answers_tags ON promoted_answers USING GIN(tags);

-- REQ-009 / AC-04: pgvector cosine similarity for promoted-answer retrieval.
-- ivfflat lists=10 — small dataset sweet spot; sequential scan dominates at low
-- row counts. Tune lists upwards when promoted_answers exceeds ~10k rows.
CREATE INDEX idx_promoted_answers_embedding
  ON promoted_answers USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- RLS: org isolation. Mirrors 0082_rlhf.sql §3 join pattern
-- (promoted_answers -> messages -> conversations -> projects -> org_members).
-- promoted_answers.org_id is the authoritative scope; the USING clause asserts
-- the row's org_id matches a project the caller is a member of.
-- @MX:TODO [AUTO] RLS is INERT project-wide (service-role db client bypasses
--   row security; no per-request SET LOCAL role). The query-layer org guard
--   (eq(promotedAnswers.orgId, orgId)) is the ACTUAL tenant boundary for
--   knowledge-promo routes. FORCE RLS hardening tracked by Issue #239.
ALTER TABLE promoted_answers ENABLE ROW LEVEL SECURITY;
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

-- -------------------------------------
-- §3 messages.content_tsv — fulltext search column (REQ-001)
-- -------------------------------------

-- REQ-KNOWLEDGE-PROMO-001: org-wide fulltext search over conversation messages.
-- GENERATED ALWAYS AS ... STORED so INSERT/UPDATE keep it in sync automatically.
-- GIN index for tsvector containment queries (@@ operator).
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content_prose)) STORED;

CREATE INDEX IF NOT EXISTS idx_messages_content_tsv ON messages USING GIN(content_tsv);

-- -------------------------------------
-- §4 Extend audit_action enum (+2)
-- -------------------------------------

-- REQ-013 / AC-07: promotion is a 21 CFR Part 11 audit-material record.
-- REQ-014 / AC-07: unpromotion (status='unpromoted') audit event.
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'answer_promoted';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'answer_unpromoted';
