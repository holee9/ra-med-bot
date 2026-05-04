-- Migration 0017: Corrective schema fixes for SPEC-REGULA-DOCINGEST-001
-- Aligns organization_documents with REQ-DOC-037 column naming and adds missing columns.
-- Also updates doc_status_enum, creates doc_source enum, and adds OAuth credential columns.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Rename columns in organization_documents to match REQ-DOC-037
-- ---------------------------------------------------------------------------
ALTER TABLE organization_documents
  RENAME COLUMN organization_id TO org_id;

ALTER TABLE organization_documents
  RENAME COLUMN r2_object_key TO original_file_r2_key;

ALTER TABLE organization_documents
  RENAME COLUMN sha256_hash TO file_hash_sha256;

ALTER TABLE organization_documents
  RENAME COLUMN mime_type TO file_mime_type;

ALTER TABLE organization_documents
  RENAME COLUMN r2_redacted_key TO redacted_file_r2_key;

-- ---------------------------------------------------------------------------
-- 2. Add missing columns to organization_documents
-- ---------------------------------------------------------------------------
ALTER TABLE organization_documents
  ADD COLUMN IF NOT EXISTS language          text        NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS source_meta_json  jsonb       NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS version           integer     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supersedes_doc_id uuid        NULL,
  ADD COLUMN IF NOT EXISTS project_id        uuid        NULL,
  ADD COLUMN IF NOT EXISTS indexed_at        timestamptz NULL,
  ADD COLUMN IF NOT EXISTS uploaded_at       timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS archived_at       timestamptz NULL;

-- Drop old metadata_json if it existed under that name (Phase 8A had it already)
-- The ADD COLUMN IF NOT EXISTS handles idempotency.

-- ---------------------------------------------------------------------------
-- 3. Drop ingest_jobs table — Inngest handles job tracking natively
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS ingest_jobs CASCADE;

-- ---------------------------------------------------------------------------
-- 4. Update doc_status_enum to correct 8-value set
--    PostgreSQL does not support removing enum values directly;
--    we rename the old type and create a new one, then migrate the column.
-- ---------------------------------------------------------------------------
ALTER TYPE doc_status_enum RENAME TO doc_status_enum_old;

CREATE TYPE doc_status_enum AS ENUM (
  'pending',
  'extracting',
  'redacting',
  'chunking',
  'indexed',
  'failed',
  'quarantine',
  'archived'
);

-- Migrate existing status values to new enum
ALTER TABLE organization_documents
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE organization_documents
  ALTER COLUMN status TYPE doc_status_enum
  USING CASE status::text
    WHEN 'processing' THEN 'pending'::doc_status_enum
    WHEN 'indexed'    THEN 'indexed'::doc_status_enum
    WHEN 'quarantine' THEN 'quarantine'::doc_status_enum
    WHEN 'archived'   THEN 'archived'::doc_status_enum
    ELSE 'pending'::doc_status_enum
  END;

ALTER TABLE organization_documents
  ALTER COLUMN status SET DEFAULT 'pending';

DROP TYPE doc_status_enum_old;

-- ---------------------------------------------------------------------------
-- 5. Create doc_source enum with 6 values
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE doc_source AS ENUM (
    'google_drive',
    'sharepoint',
    'dropbox',
    'email_workers',
    'manual_upload',
    'regulatory_portal'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Add source column to organization_documents
-- ---------------------------------------------------------------------------
ALTER TABLE organization_documents
  ADD COLUMN IF NOT EXISTS source doc_source NOT NULL DEFAULT 'manual_upload';

-- ---------------------------------------------------------------------------
-- 7. Add OAuth credential columns to organizations table
-- ---------------------------------------------------------------------------
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS gdrive_refresh_token_encrypted  text    NULL,
  ADD COLUMN IF NOT EXISTS sharepoint_tenant_id            text    NULL,
  ADD COLUMN IF NOT EXISTS sharepoint_client_cert_encrypted bytea  NULL,
  ADD COLUMN IF NOT EXISTS dropbox_refresh_token_encrypted text    NULL,
  ADD COLUMN IF NOT EXISTS email_ingest_allowlist          jsonb   NOT NULL DEFAULT '[]';

-- ---------------------------------------------------------------------------
-- 8. Update document_chunks organization_id column reference
--    (renamed from organization_id → org_id in parent table)
--    The FK is denormalized — update the index name to stay consistent.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_org_docs_org_class_status;
CREATE INDEX idx_org_docs_org_class_status
  ON organization_documents (org_id, doc_class, status);

-- Update unique constraint to reference renamed column
ALTER TABLE organization_documents
  DROP CONSTRAINT IF EXISTS uq_org_docs_sha256;

DROP INDEX IF EXISTS uq_org_docs_sha256;

ALTER TABLE organization_documents
  ADD CONSTRAINT uq_org_docs_sha256 UNIQUE (org_id, file_hash_sha256);

COMMIT;
