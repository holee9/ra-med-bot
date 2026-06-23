-- SPEC-REGULA-KNOWLEDGE-GAP-001: Knowledge gap detection, classification, replay.
-- Issue #35 — 미답변 자동 이슈화 및 지식베이스 보강 루프.
-- Migration: 0066_knowledge_gap.sql
--
-- Adds 3 new pgEnums (gap_reason, gap_status, gap_classification), a boolean
-- flag on messages (knowledge_gap_required, separate from expert_review_required),
-- the unanswered_queue table with RLS org isolation, and 4 audit_action enum
-- values for the knowledge-gap lifecycle (REQ-KNOWLEDGE-GAP-016).

-- ---------------------------------------------------------------------------
-- 1. pgEnums (REQ-KNOWLEDGE-GAP-001, REQ-KNOWLEDGE-GAP-008)
-- ---------------------------------------------------------------------------
CREATE TYPE gap_reason AS ENUM (
  'low_confidence',
  'low_citation',
  'no_results',
  'policy_blocked'
);

CREATE TYPE gap_status AS ENUM (
  'open',
  'classified',
  'resolved'
);

CREATE TYPE gap_classification AS ENUM (
  'ra_project_gap',
  'md_process_gap',
  'external_regulation_needed',
  'bug'
);

-- ---------------------------------------------------------------------------
-- 2. messages.knowledge_gap_required (REQ-KNOWLEDGE-GAP-003)
--    Separate flag from expert_review_required — distinguishes expert review
--    gating (safety) from knowledge gap tracking (KB augmentation).
-- ---------------------------------------------------------------------------
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS knowledge_gap_required BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- 3. unanswered_queue table (REQ-KNOWLEDGE-GAP-004)
--    Stores PII-redacted questions the RAG pipeline could not answer with
--    sufficient confidence/citation. Feeds the closed-loop KB augmentation.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS unanswered_queue (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id          UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  redacted_question   TEXT NOT NULL,
  redaction_hash      TEXT NOT NULL,
  gap_reason          gap_reason NOT NULL,
  cluster_id          TEXT,
  github_issue_number INTEGER,
  classification      gap_classification,
  status              gap_status NOT NULL DEFAULT 'open',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_unanswered_queue_org      ON unanswered_queue (org_id);
CREATE INDEX IF NOT EXISTS idx_unanswered_queue_status   ON unanswered_queue (status);
CREATE INDEX IF NOT EXISTS idx_unanswered_queue_cluster  ON unanswered_queue (cluster_id);

-- ---------------------------------------------------------------------------
-- 4. RLS: org isolation (inherits 0015_docingest_rls.sql pattern)
--    unanswered_queue rows are scoped by org_id via the app.current_org_id
--    session setting set by the Route Handler middleware.
-- ---------------------------------------------------------------------------
ALTER TABLE unanswered_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_unanswered_queue"
  ON unanswered_queue
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- ---------------------------------------------------------------------------
-- 5. audit_action enum +4 values (REQ-KNOWLEDGE-GAP-016)
-- ---------------------------------------------------------------------------
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'knowledge_gap_created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'knowledge_gap_classified';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'knowledge_gap_digest_sent';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'knowledge_gap_resolved';
