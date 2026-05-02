-- Migration: 0002_chat_indexes
-- Purpose: Add pgvector cosine operator class and FTS GIN index for hybrid search.
-- REQ-CHAT-020 (vector similarity) + REQ-CHAT-021 (FTS BM25 hybrid search).

-- Enable pgvector extension if not already present.
CREATE EXTENSION IF NOT EXISTS vector;

-- Cosine-distance IVFFlat index on source_sections.embedding (1536-dim OpenAI embeddings).
-- lists=100 is appropriate for ~10k–100k rows; re-index if corpus grows above 1M rows.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_source_sections_embedding_cosine
  ON source_sections
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Full-text search GIN index for BM25 hybrid search (tsvector over section text).
ALTER TABLE source_sections
  ADD COLUMN IF NOT EXISTS ts_text tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(text, ''))) STORED;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_source_sections_ts_text
  ON source_sections
  USING GIN (ts_text);

-- Composite index for corpus scoping — (source_id, corpus) used in hybrid search filters.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_source_sections_source_id
  ON source_sections (source_id);

-- Index on sources.corpus for filter pushdown.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sources_corpus
  ON sources (corpus)
  WHERE corpus IS NOT NULL;

-- GIN index on messages.meta_json for JSONB path queries (conversation lookups).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_meta_json
  ON messages
  USING GIN (meta_json);
