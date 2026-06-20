-- REQ-INTEGRATION-001: Knowledge source provenance extension
-- Adds provenance fields to sources and source_sections tables for
-- reproducible citations and source traceability. Supports local file
-- and Git-based sources (GitHub/Gitea). Depends on 0058_risk_tables.sql.

-- Add provenance columns to sources table
ALTER TABLE sources
  ADD COLUMN source_host TEXT,
  ADD COLUMN source_owner TEXT,
  ADD COLUMN source_repo TEXT,
  ADD COLUMN source_branch TEXT,
  ADD COLUMN source_ref TEXT,
  ADD COLUMN source_path TEXT,
  ADD COLUMN content_hash TEXT,
  ADD COLUMN ingestion_run_id UUID,
  ADD COLUMN ingested_at TIMESTAMPTZ;

-- Add provenance columns to source_sections table
ALTER TABLE source_sections
  ADD COLUMN chunk_hash TEXT,
  ADD COLUMN section_path TEXT,
  ADD COLUMN ingestion_run_id UUID,
  ADD COLUMN ingested_at TIMESTAMPTZ;

-- Create indexes for provenance queries
CREATE INDEX idx_sources_host ON sources(source_host);
CREATE INDEX idx_sources_ingestion ON sources(ingestion_run_id);
CREATE INDEX idx_source_sections_ingestion ON source_sections(ingestion_run_id);

-- Add comment for documentation
COMMENT ON COLUMN sources.source_host IS 'Source repository host (e.g., github.com, gitea.example.com, local)';
COMMENT ON COLUMN sources.source_owner IS 'Repository owner or organization';
COMMENT ON COLUMN sources.source_repo IS 'Repository name';
COMMENT ON COLUMN sources.source_branch IS 'Branch name (if applicable)';
COMMENT ON COLUMN sources.source_ref IS 'Commit SHA, tag, or reference identifier';
COMMENT ON COLUMN sources.source_path IS 'File path within repository';
COMMENT ON COLUMN sources.content_hash IS 'SHA256 hash of source content';
COMMENT ON COLUMN sources.ingestion_run_id IS 'Links to ingestion job for traceability';
COMMENT ON COLUMN sources.ingested_at IS 'Timestamp when source was ingested';

COMMENT ON COLUMN source_sections.chunk_hash IS 'SHA256 hash of section text content';
COMMENT ON COLUMN source_sections.section_path IS 'Full section path (file path + anchor)';
COMMENT ON COLUMN source_sections.ingestion_run_id IS 'Links to ingestion job';
COMMENT ON COLUMN source_sections.ingested_at IS 'Timestamp when section was ingested';
