-- SPEC-REGULA-DOCINGEST-001
-- Phase 8A: RLS policies for DocIngest tables + private.redaction_maps

BEGIN;

-- RLS: organization_documents
ALTER TABLE organization_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_documents"
  ON organization_documents
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);

-- RLS: document_chunks
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_chunks"
  ON document_chunks
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);

-- RLS: document_access_policies
ALTER TABLE document_access_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_access_policies"
  ON document_access_policies
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);

-- RLS: ingest_jobs
ALTER TABLE ingest_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_ingest_jobs"
  ON ingest_jobs
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);

-- Private schema for redaction maps (PII double-protection, 21 CFR Part 11)
CREATE SCHEMA IF NOT EXISTS private;

-- AES-256-GCM encrypted PII originals — append-only, never update/delete
CREATE TABLE IF NOT EXISTS private.redaction_maps (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id          uuid NOT NULL,
  original_text_iv     text NOT NULL,    -- AES-GCM IV (base64)
  encrypted_original   text NOT NULL,   -- AES-256-GCM encrypted original PII
  redacted_placeholder text NOT NULL,
  pii_type             text NOT NULL,   -- 'ssn' | 'phone' | 'email' | 'name' | ...
  confidence           float NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Block general role access to private schema — only pii_admin_role may access
REVOKE ALL ON SCHEMA private FROM PUBLIC;

COMMIT;
