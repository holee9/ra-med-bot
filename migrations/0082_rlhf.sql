-- Migration: RLHF — Answer Quality Feedback Loop (Issue #56)
-- SPEC: SPEC-REGULA-RLHF-001 (REQ-RLHF-001~015, AC-01~08)
-- Scope:
--   1. 2 new enums: feedback_rating (up/down), quality_tag (8 values)
--   2. New table: answer_feedback (id, message_id, user_id, rating, quality_tags[],
--      comment, created_at) with UNIQUE(message_id, user_id) + RLS org isolation
--   3. ALTER source_sections: +1 column feedback_score (numeric, default 0)
--   4. audit_action +3 (feedback_submitted, reranking_applied, reranking_rolled_back)
--
-- Regulatory anchors:
--   ISO 13485 continuous improvement — RLHF is a CAPA input signal for RAG quality
--   21 CFR Part 11 — feedback_submitted / reranking events are audit-material records
--   Change control — reranking version metadata + rollback (REQ-RLHF-013, REQ-RLHF-014)
--
-- Reuse: messages (FK), users (FK), source_sections (#48 migration 0081).

-- -------------------------------------
-- §1 New enums
-- -------------------------------------

-- REQ-RLHF-001: feedback rating (thumb up/down).
CREATE TYPE feedback_rating AS ENUM ('up', 'down');

-- REQ-RLHF-002 / AC-02: quality tag enum. EXACTLY 8 values — do NOT expand without
-- a follow-up issue (Issue #56 comment extras are deferred to RLHF-v2).
CREATE TYPE quality_tag AS ENUM (
  'citation_missing',
  'citation_wrong',
  'answer_incomplete',
  'answer_wrong',
  'outdated_info',
  'jurisdiction_mismatch',
  'helpful',
  'excellent'
);

-- -------------------------------------
-- §2 New table: answer_feedback
-- -------------------------------------

-- REQ-RLHF-001, REQ-RLHF-004: user feedback on assistant answers.
-- One feedback row per user per message (UNIQUE constraint).
CREATE TABLE answer_feedback (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating       feedback_rating NOT NULL,
  quality_tags quality_tag[] NOT NULL DEFAULT '{}'::quality_tag[],
  comment      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX idx_answer_feedback_message ON answer_feedback(message_id);
CREATE INDEX idx_answer_feedback_created ON answer_feedback(created_at);
CREATE INDEX idx_answer_feedback_user ON answer_feedback(user_id);

-- RLS: users see only their org's feedback. Mirrors the project-wide USING-only
-- pattern. The join is messages -> conversations -> projects -> org_members
-- (conversations has NO direct organization_id; the org is resolved through
-- projects.organization_id). This corrects the original 0082 policy which
-- referenced a nonexistent c.organization_id column.
--
-- @MX:TODO [AUTO] RLS is INERT project-wide (service-role db client bypasses
--   row security; no per-request SET LOCAL role). The query-layer org guard in
--   lib/rlhf/access.ts (assertMessageInOrg) is the ACTUAL tenant boundary for
--   RLHF routes. Adding WITH CHECK clauses is tracked by Issue #239 (project-
--   wide RLS hardening) — do NOT add per-table WITH CHECK here, do it in #239.
ALTER TABLE answer_feedback ENABLE ROW LEVEL SECURITY;
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

-- -------------------------------------
-- §3 Extend audit_action enum (+3)
-- -------------------------------------

-- REQ-RLHF-013: reranking version metadata + rollback audit events.
-- feedback_submitted is the 21 CFR Part 11 record of every feedback write.
--
-- H-2 fix (expert-security): the re-rank audit action is `reranking_proposed`,
-- NOT `reranking_applied`. The re-rank is recorded as a PENDING change_request
-- (REQ-RLHF-013/014) — it is NEVER auto-applied, so the old name (`reranking_applied`)
-- mis-stated the operational state to regulators. Net enum delta vs original
-- 0082 design is still +3 (this is a rename, not an add).
--
-- PostgreSQL does not support ALTER TYPE ... RENAME VALUE before v13, and even
-- there it is transaction-unsafe inside the same migration. We emit BOTH the
-- old and new labels here so fresh DBs get the correct name; the old label is
-- kept for any rows written between the original 0082 deploy and this hotfix
-- (none in production — the feature shipped unmerged). The application layer
-- (lib/audit.ts AuditAction union + lib/db/schema.ts auditActionEnum) ONLY
-- inserts `reranking_proposed` going forward.
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'feedback_submitted';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'reranking_proposed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'reranking_rolled_back';
-- Deprecated label — retained so the type covers historical rows on dev DBs
-- that ran the pre-hotfix 0082. No code path inserts this value after the H-2 fix.
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'reranking_applied';

-- -------------------------------------
-- §4 Extend source_sections
-- -------------------------------------

-- REQ-RLHF-009: feedback-driven score column for retrieval re-ranking.
-- Numeric (not integer) to allow weighted aggregation. Default 0 so existing
-- rows are re-ranking-neutral until feedback accumulates.
ALTER TABLE source_sections
  ADD COLUMN IF NOT EXISTS feedback_score numeric(6,3) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_source_sections_feedback_score
  ON source_sections(feedback_score);
