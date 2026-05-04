-- SPEC-REGULA-DOCINGEST-001 (REQ-DOC-036~045)
-- Phase 8A: Core DocIngest schema — pgEnums + 4 tables + HNSW index
-- NOTE: Migration numbers 0012/0013 were already used by workflow schema.
--       This migration uses 0014 as next available number.

BEGIN;

-- 1. pgEnum: 8-class document taxonomy (REQ-DOC-001)
CREATE TYPE doc_class_enum AS ENUM (
  'issued_certificate',
  'submission_success',
  'submission_inprogress',
  'clinical_report',
  'checklist_template',
  'surveillance_report',
  'internal_sop',
  'audit_response'
);

-- 2. pgEnum: document lifecycle states
CREATE TYPE doc_status_enum AS ENUM (
  'processing',
  'indexed',
  'quarantine',
  'archived'
);

-- 3. Core document registry (REQ-DOC-036)
-- Hard delete prohibited — use archived_at for soft delete
CREATE TABLE IF NOT EXISTS organization_documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  doc_class        doc_class_enum NOT NULL,
  title            text NOT NULL,
  status           doc_status_enum NOT NULL DEFAULT 'processing',
  r2_object_key    text NOT NULL,
  r2_redacted_key  text,
  sha256_hash      text NOT NULL,
  file_size_bytes  bigint,
  mime_type        text NOT NULL,
  metadata_json    jsonb NOT NULL DEFAULT '{}',
  uploaded_by      uuid REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  archived_at      timestamptz
);

-- Composite index: filter by org + class + status
CREATE INDEX IF NOT EXISTS idx_org_docs_org_class_status
  ON organization_documents (organization_id, doc_class, status);

-- Unique: one sha256 per org (deduplication)
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_docs_sha256
  ON organization_documents (organization_id, sha256_hash);

-- 4. Document chunks with pgvector embeddings (REQ-DOC-037)
CREATE TABLE IF NOT EXISTS document_chunks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid NOT NULL REFERENCES organization_documents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  chunk_index     int NOT NULL,
  content         text NOT NULL,
  embedding       vector(1536),
  token_count     int,
  metadata_json   jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- HNSW index for cosine similarity search (pgvector)
-- CONCURRENTLY cannot run inside a transaction; excluded from BEGIN/COMMIT.
-- Run this index creation separately after migration if needed.
-- For CI/test environments this index is created in 0015_docingest_rls.sql.
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
  ON document_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 5. Document access policies (REQ-DOC-038)
CREATE TABLE IF NOT EXISTS document_access_policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  doc_class       doc_class_enum,
  project_id      uuid,
  role            user_role NOT NULL,
  can_read        boolean NOT NULL DEFAULT false,
  can_write       boolean NOT NULL DEFAULT false,
  can_admin       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, doc_class, project_id, role)
);

-- 6. Ingest job tracking (REQ-DOC-039)
CREATE TABLE IF NOT EXISTS ingest_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  document_id     uuid REFERENCES organization_documents(id),
  inngest_run_id  text,
  source          text NOT NULL,
  status          text NOT NULL DEFAULT 'pending',
  error_message   text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMIT;
