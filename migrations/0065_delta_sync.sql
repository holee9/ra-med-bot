-- SPEC-REGULA-DELTA-SYNC-001: Corpus delta-sync (Radar → pgvector/Vectorize)
-- Issue #45 — incremental document synchronization
-- Migration: 0065_delta_sync.sql
--
-- Adds supersession tracking columns to source_sections so changed chunks can
-- be marked outdated rather than hard-deleted (21 CFR Part 11 preservation).
-- Adds 3 audit_action enum values for corpus sync observability.

-- ---------------------------------------------------------------------------
-- 1. source_sections: updated_at + superseded_by (REQ-DELTA-002)
-- ---------------------------------------------------------------------------
ALTER TABLE source_sections
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS superseded_by UUID;

-- updated_at defaults to NOW() for existing rows; subsequent delta-sync writes
-- bump it. NOT NULL enforced after backfill.
UPDATE source_sections SET updated_at = COALESCE(ingested_at, created_at)
  WHERE updated_at IS NULL;

ALTER TABLE source_sections
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW();

-- superseded_by: self-referential FK to source_sections.id (the newer version)
ALTER TABLE source_sections
  ADD CONSTRAINT fk_source_sections_superseded_by
    FOREIGN KEY (superseded_by) REFERENCES source_sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_source_sections_superseded_by
  ON source_sections (superseded_by);

CREATE INDEX IF NOT EXISTS idx_source_sections_updated_at
  ON source_sections (updated_at);

-- ---------------------------------------------------------------------------
-- 2. corpus_sync_runs table — tracks each delta-sync execution (REQ-DELTA-007)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS corpus_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawler_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'unchanged' | 'synced' | 'failed' | 'skipped'
  chunks_added INTEGER NOT NULL DEFAULT 0,
  chunks_outdated INTEGER NOT NULL DEFAULT 0,
  chunks_unchanged INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corpus_sync_runs_crawler_started
  ON corpus_sync_runs (crawler_name, started_at);

CREATE INDEX IF NOT EXISTS idx_corpus_sync_runs_status
  ON corpus_sync_runs (status);

CREATE INDEX IF NOT EXISTS idx_corpus_sync_runs_source_hash
  ON corpus_sync_runs (source_url, content_hash);

-- ---------------------------------------------------------------------------
-- 3. audit_action enum +3 values (REQ-DELTA-014)
-- ---------------------------------------------------------------------------
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'corpus.sync_started';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'corpus.sync_completed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'corpus.sync_failed';
