-- Migration: Corpus License & Entitlement Management (Issue 72, REQ-CORPUSLIC-001~014)
-- SPEC: SPEC-REGULA-CORPUS-LICENSE-001
-- Scope:
--   1. audit_action +9 (corpus.* lifecycle for 21 CFR Part 11 traceability)
--   2. 3 new enums: license_type, confidentiality_level, entitlement_status
--   3. 2 new tables: source_license, entitlement (org_id scoped, FK to sources)
--   4. RLS org-isolation on both tables (mirror 0067~0079 USING-only pattern)
--
-- Regulatory anchors:
--   Copyright / Standard licenses (ISO/IEC/ASTM) — paid full-text storage gating
--   Database subscription terms (PubMed/Embase) — abstract-only vs full-text use
--   Trade secret protection — internal SOP confidentiality scoping
--   21 CFR Part 11 — electronic records of license/entitlement changes & denials
--
-- Both tables inherit the app.current_org_id RLS pattern from 0067-0079.
-- WITH CHECK clauses remain a project-wide follow-up (Issue #239); USING-only
-- is consistent with all previously merged SPEC migrations.

-- -------------------------------------
-- §1 Enum extensions
-- -------------------------------------

-- corpus.* audit actions (Issue 72, REQ-CORPUSLIC-010/012/014). 9 lifecycle
-- audit actions for 21 CFR Part 11 traceability of license/entitlement state.
-- Mirror the schema enum and AuditAction type (lock-step).
--   corpus.license_set          — license metadata created or updated (REQ-001/010)
--   corpus.ingestion_blocked    — ingestion gate blocked unlicensed source (REQ-002/003)
--   corpus.full_text_blocked    — paid full-text blocked without entitlement (REQ-004)
--   corpus.entitlement_granted  — entitlement granted for a source (REQ-001/008)
--   corpus.entitlement_revoked  — entitlement revoked, source search-excluded (REQ-008)
--   corpus.export_blocked       — export blocked for unentitled source (REQ-011)
--   corpus.access_denied        — cross-org or unauthorized access blocked (REQ-012)
--   corpus.expiry_warned        — admin warned of upcoming license expiry (REQ-014)
--   corpus.abstract_only_enforced — abstract-only policy enforced, full-text blocked (REQ-013)
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'corpus.license_set';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'corpus.ingestion_blocked';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'corpus.full_text_blocked';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'corpus.entitlement_granted';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'corpus.entitlement_revoked';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'corpus.export_blocked';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'corpus.access_denied';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'corpus.expiry_warned';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'corpus.abstract_only_enforced';

-- License type enum. REQ-CORPUSLIC-001. Mirrors permitted-use policy groups.
--   standard_paid  — ISO/IEC/ASTM paid standards (entitlement required for full text)
--   journal        — PubMed/Embase journals (abstract-only vs full-text split)
--   internal_sop   — company-internal SOPs / submission docs (confidentiality-scoped)
--   open          — public-domain regulatory texts (no entitlement requirement)
CREATE TYPE license_type AS ENUM ('standard_paid', 'journal', 'internal_sop', 'open');

-- Confidentiality level enum. REQ-CORPUSLIC-006. Trade secret protection.
CREATE TYPE confidentiality_level AS ENUM ('public', 'internal', 'trade_secret');

-- Entitlement status enum. REQ-CORPUSLIC-001/008. Active vs revoked lifecycle.
CREATE TYPE entitlement_status AS ENUM ('active', 'revoked', 'expired');

-- -------------------------------------
-- §2 Tables
-- -------------------------------------

-- source_license: per-source license metadata (REQ-CORPUSLIC-001).
-- Links to #48 Source Governance (sources.id) and gates ingestion / search / export.
--   permitted_use      — JSONB boolean map: {ingest, embed, search, summarize, export}
--   full_text_allowed  — master switch; false ⇒ only abstract may be stored/served
--   abstract_only      — derivative flag enforcing REQ-005/013 abstract-only policy
--   expiry_date        — nullable; when past, source is search-excluded (REQ-008)
CREATE TABLE source_license (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  license_type license_type NOT NULL,
  entitlement_ref text,
  permitted_use jsonb NOT NULL DEFAULT '{"ingest":true,"embed":true,"search":true,"summarize":true,"export":true}'::jsonb,
  full_text_allowed boolean NOT NULL DEFAULT true,
  abstract_only boolean NOT NULL DEFAULT false,
  confidentiality_level confidentiality_level NOT NULL DEFAULT 'internal',
  expiry_date date,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_source_license_source_unique ON source_license(source_id);
CREATE INDEX idx_source_license_org ON source_license(org_id);
CREATE INDEX idx_source_license_expiry ON source_license(org_id, expiry_date);

ALTER TABLE source_license ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_source_license"
  ON source_license FOR ALL
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- entitlement: grant/revoke lifecycle for a source_license (REQ-CORPUSLIC-008).
--   status 'active'   — source is search-eligible
--   status 'revoked'  — manual revoke, source search-excluded
--   status 'expired'  — license expiry reached (kept for audit trail)
CREATE TABLE entitlement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_license_id uuid NOT NULL REFERENCES source_license(id) ON DELETE CASCADE,
  status entitlement_status NOT NULL DEFAULT 'active',
  granted_by uuid NOT NULL REFERENCES users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid REFERENCES users(id),
  revoked_at timestamptz
);

CREATE INDEX idx_entitlement_org ON entitlement(org_id);
CREATE INDEX idx_entitlement_license ON entitlement(source_license_id);
CREATE INDEX idx_entitlement_status ON entitlement(org_id, status);

ALTER TABLE entitlement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_entitlement"
  ON entitlement FOR ALL
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
