-- Migration: Messages Embedding for REQ-002 Full Semantic Search (Issue #275)
-- SPEC: SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-002 — general conversation semantic search)
-- Scope:
--   1. Add messages.embedding vector(1536) column (nullable)
--   2. Create ivfflat index for cosine similarity search
--   3. Supports Inngest backfill job (async, cursor-based batch)
--
-- Regulatory anchors:
--   ISO 13485 consistency — semantic search improves retrieval quality for
--     regulatory decision-making
--   21 CFR Part 11 — embedding is a derived field; source message.content_prose
--     remains the audit-trail canonical source
--   Traceability — embedding enables better similarity search over conversation
--     history for audit and investigation
--
-- Design decisions:
--   #1 Reverses design decision #1 from 0086 — messages now have embedding column
--      for full REQ-002 semantic coverage (general-conversation semantic search).
--   #2 nullable to allow graceful degradation when OpenAI is unavailable.
--   #3 ivfflat lists=10 — tuned for small dataset; revisit at scale.
--   #4 No org-scoped index — messages have no direct org_id (scoped via join).

-- -------------------------------------
-- §1 Add messages.embedding column (idempotent)
-- -------------------------------------

-- REQ-002 / AC-01: vector(1536) for text-embedding-3-small semantic search.
-- DO $$ block for idempotency — ADD COLUMN does not support IF NOT EXISTS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'messages'
      AND column_name = 'embedding'
  ) THEN
    ALTER TABLE messages ADD COLUMN embedding vector(1536);
  END IF;
END $$;

-- -------------------------------------
-- §2 Create ivfflat index (idempotent)
-- -------------------------------------

-- REQ-002 / AC-01: cosine similarity index for semantic search.
-- ivfflat lists=10 — small dataset sweet spot; sequential scan dominates at low
-- row counts. Tune lists upwards when messages exceeds ~10k rows.
CREATE INDEX IF NOT EXISTS idx_messages_embedding
  ON messages USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- Note: org scope is enforced at query time via messages -> conversations ->
-- projects.organizationId join (see lib/knowledge-promo/semantic-search.ts).
-- Cross-org leakage is prevented by the SQL WHERE clause.
