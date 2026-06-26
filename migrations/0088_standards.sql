-- Migration: Standards Catalog — Applicability, Revision Tracking, Compliance (Issue #62)
-- SPEC: SPEC-REGULA-STANDARDS-001 (REQ-STANDARDS-001~022, AC-01~06)
-- Scope:
--   1. New enum: standards_body ('ISO','IEC','CEN','ASTM','other'),
--      standards_recognition_status ('recognized','not_recognized','withdrawn','unknown'),
--      standards_compliance_status ('compliant','gap','unknown','not_applicable'),
--      standards_alert_tier ('info','warn','critical')
--   2. 4 new tables:
--      standards_org_catalog (number, title, version, body, status, recognition_status,
--        source, source_url) — org-scoped catalog metadata (NO full text — copyright).
--      standards_org_applicability (org_id, device_profile_key, standard_id, is_mandatory,
--        applicability_reason, pathway, rule_source) — mapping rule provenance.
--      standards_updates (org_id, standard_id, revision_label, oj_publication_date,
--        date_of_withdrawal, transition_end_date, impact_summary, detected_at,
--        source, alert_tier) — revision history + impact metadata.
--      product_standards_compliance (org_id, project_id, product_id, standard_id,
--        compliance_status, last_assessed_at, notes) — product×standard state.
--   3. audit_action +4 ('standards.mapping.generated','standards.recognition.checked',
--      'standards.revision.detected','standards.alert.emitted')
--   4. RLS org isolation (SPEC-RLS-001 inert pattern; #239 JS-level guard is
--      authoritative). USING+WITH CHECK on org_id (or org-resolved join for
--      product_standards_compliance).
--
-- Regulatory anchors:
--   ISO 13485 / 21 CFR 820.30 design control — applicable-standards identification
--     is a design-input record. Mapping results are decision-support, RA Lead reviews.
--   21 CFR Part 11 — mapping/recognition/revision/alert events are audit-material.
--   EU MDR Annex IX — harmonized standards presumption of conformity (citation
--     provenance is Charter [지양-2] hard requirement — no citation-less assertions).
--
-- Design decisions (tasks.md §2 / §7):
--   #1 Catalog stores metadata only (number/title/version/body/status). Full text
--      is NEVER stored (copyright). source='seed' | 'fda_api' | 'eu_oj'.
--   #2 standards_org_applicability captures rule provenance so mapping decisions are
--      explainable to auditors (which rule fired, which device profile key).
--   #3 RLS inert (#239) — JS-level org guard (lib/standards/access.ts) is the
--      authoritative gate. RLS policy below is defense-in-depth.
--   #4 AC-01 (FDA 6000-row import) and AC-02 (EU OJ live crawler) are PARTIAL —
--      this migration ships the schema + 30~50 core seed standards; full crawl
--      deferred to follow-up issues #62-A/#62-B/#62-C.

-- -------------------------------------
-- §1 New enums
-- -------------------------------------

-- REQ-STANDARDS-008: standards body categorizes the publisher (ISO/IEC/CEN/ASTM).
-- 'other' captures MFDS/NMPA/PMDA national body references not in the core four.
CREATE TYPE standards_body AS ENUM ('ISO', 'IEC', 'CEN', 'ASTM', 'other');

-- REQ-STANDARDS-015/016: FDA recognition status for real-time check API.
-- 'unknown' is the safe default for seed rows where recognition has not been verified.
-- 'withdrawn' triggers the warn+alternative flow (AC-06).
CREATE TYPE standards_recognition_status AS ENUM (
  'recognized',
  'not_recognized',
  'withdrawn',
  'unknown'
);

-- REQ-STANDARDS-013: product×standard compliance state for gap analysis.
-- 'unknown' is the starting state; 'not_applicable' for justified exclusions.
CREATE TYPE standards_compliance_status AS ENUM (
  'compliant',
  'gap',
  'unknown',
  'not_applicable'
);

-- REQ-STANDARDS-017/018: alert tier for revision/transition notifications.
-- D-3 month before DoW = critical; D-6 = warn; D-12 = info.
CREATE TYPE standards_alert_tier AS ENUM ('info', 'warn', 'critical');

-- -------------------------------------
-- §2 New table: standards_org_catalog
-- -------------------------------------

-- REQ-STANDARDS-008 / AC-01 (PARTIAL): org-scoped catalog metadata.
-- Number/title/version/body are public reference data; we store per-org to allow
-- org-specific recognition overrides (e.g. one org may track MFDS-specific entries).
-- Full text is NEVER stored (copyright) — source_url links to the publisher.
CREATE TABLE standards_org_catalog (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  standard_number    text NOT NULL,
  title              text NOT NULL,
  version            text NOT NULL,
  body               standards_body NOT NULL,
  status             text NOT NULL DEFAULT 'current',
  recognition_status standards_recognition_status NOT NULL DEFAULT 'unknown',
  eu_harmonized      boolean NOT NULL DEFAULT false,
  source             text NOT NULL DEFAULT 'seed',
  source_url         text,
  scope_keywords     text[] NOT NULL DEFAULT '{}'::text[],
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, standard_number, version)
);

CREATE INDEX idx_standards_catalog_org_body ON standards_org_catalog(org_id, body);
CREATE INDEX idx_standards_catalog_org_number ON standards_org_catalog(org_id, standard_number);

-- -------------------------------------
-- §3 New table: standards_org_applicability
-- -------------------------------------

-- REQ-STANDARDS-001/004/005/006: device_profile_key → standard_id mapping rules.
-- rule_source='builtin' for engine defaults; 'custom' for org overrides.
-- pathway narrows applicability to a regulatory pathway (fda_510k, eu_mdr_class_iii, etc.).
CREATE TABLE standards_org_applicability (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_profile_key   text NOT NULL,
  standard_id          uuid NOT NULL REFERENCES standards_org_catalog(id) ON DELETE CASCADE,
  is_mandatory         boolean NOT NULL DEFAULT true,
  applicability_reason text NOT NULL,
  pathway              text NOT NULL DEFAULT 'all',
  rule_source          text NOT NULL DEFAULT 'builtin',
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, device_profile_key, standard_id, pathway)
);

CREATE INDEX idx_standards_applicability_org_profile
  ON standards_org_applicability(org_id, device_profile_key);

-- -------------------------------------
-- §4 New table: standards_updates
-- -------------------------------------

-- REQ-STANDARDS-009/010/011: revision history + transition timeline.
-- oj_publication_date / date_of_withdrawal drive the D-12/D-6/D-3 alerts (AC-05).
-- detected_at is when the system noticed the revision (cron timestamp).
-- alert_tier is the current tier for notification routing (info/warn/critical).
CREATE TABLE standards_updates (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  standard_id          uuid NOT NULL REFERENCES standards_org_catalog(id) ON DELETE CASCADE,
  revision_label       text NOT NULL,
  oj_publication_date  date,
  date_of_withdrawal   date,
  transition_end_date  date,
  impact_summary       text,
  detected_at          timestamptz NOT NULL DEFAULT now(),
  source               text NOT NULL DEFAULT 'manual',
  alert_tier           standards_alert_tier NOT NULL DEFAULT 'info',
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_standards_updates_org_standard ON standards_updates(org_id, standard_id);
CREATE INDEX idx_standards_updates_org_alert ON standards_updates(org_id, alert_tier);

-- -------------------------------------
-- §5 New table: product_standards_compliance
-- -------------------------------------

-- REQ-STANDARDS-013: product×standard compliance state for gap analysis.
-- product_id references products(id) weakly (no FK) to avoid cross-SPEC migration
-- coupling; app-level guard validates org scope. last_assessed_at drives staleness.
CREATE TABLE product_standards_compliance (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id         uuid REFERENCES projects(id) ON DELETE CASCADE,
  product_id         uuid NOT NULL,
  standard_id        uuid NOT NULL REFERENCES standards_org_catalog(id) ON DELETE CASCADE,
  compliance_status  standards_compliance_status NOT NULL DEFAULT 'unknown',
  last_assessed_at   timestamptz,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, product_id, standard_id)
);

CREATE INDEX idx_product_standards_compliance_org_product
  ON product_standards_compliance(org_id, product_id);
CREATE INDEX idx_product_standards_compliance_org_status
  ON product_standards_compliance(org_id, compliance_status);

-- -------------------------------------
-- §6 RLS (defense-in-depth, inert — #239 JS-level guard is authoritative)
-- -------------------------------------

ALTER TABLE standards_org_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE standards_org_catalog FORCE ROW LEVEL SECURITY;
CREATE POLICY standards_catalog_org_isolated ON standards_org_catalog
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE standards_org_applicability ENABLE ROW LEVEL SECURITY;
ALTER TABLE standards_org_applicability FORCE ROW LEVEL SECURITY;
CREATE POLICY standards_applicability_org_isolated ON standards_org_applicability
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE standards_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE standards_updates FORCE ROW LEVEL SECURITY;
CREATE POLICY standards_updates_org_isolated ON standards_updates
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE product_standards_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_standards_compliance FORCE ROW LEVEL SECURITY;
CREATE POLICY product_standards_compliance_org_isolated ON product_standards_compliance
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- -------------------------------------
-- §7 audit_action +4 values
-- -------------------------------------

-- REQ-STANDARDS-001/019: mapping engine produced an applicable-standards list.
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'standards.mapping.generated';
-- REQ-STANDARDS-015/016: FDA recognition real-time check (success or degraded fallback).
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'standards.recognition.checked';
-- REQ-STANDARDS-009: revision detector noticed a new revision (cron or manual).
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'standards.revision.detected';
-- REQ-STANDARDS-017/018: alert emitted for transition milestone (D-12/D-6/D-3).
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'standards.alert.emitted';
