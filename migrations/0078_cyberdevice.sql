-- Migration: Medical Device Cybersecurity & SBOM Evidence (Issue 67, REQ-CYBERDEVICE-001~014)
-- SPEC: SPEC-REGULA-CYBERDEVICE-001
-- Scope:
--   1. audit_action +9 (cyber.* lifecycle for 21 CFR Part 11 traceability)
--   2. 2 new enums: sbom_format (spdx|cyclonedx), cve_severity (none|low|medium|high|critical)
--   3. 4 new tables: threat_model, sbom, cve_impact, cyber_evidence_bundle
--      (all org_id + project_id scoped for tenant + project isolation).
--   4. RLS org-isolation on all 4 tables (mirror 0067~0077 pattern, USING only).
--
-- Regulatory anchors:
--   FDA Premarket Cybersecurity Guidance (2023) — threat model, SBOM, vuln mgmt, secure update
--   EU MDR GSPR Annex I §17.2 / §17.4 — IT environment security & minimum security requirements
--   IEC 81001-5-1 — health software security lifecycle
--   ISO 14971 — residual cybersecurity risk linked to risk management items
--   21 CFR Part 11 — electronic records of cybersecurity evidence access & changes
--
-- All 4 tables inherit the app.current_org_id RLS pattern from 0067-0077.
-- Note: WITH CHECK clauses are a project-wide follow-up (Issue #239); USING-only
-- is consistent with all previously merged SPEC migrations (0067-0077).

-- -------------------------------------
-- §1 Enum extensions
-- -------------------------------------

-- cyber.* audit actions (Issue 67, REQ-CYBERDEVICE-007/013/014). 9 lifecycle
-- audit actions for 21 CFR Part 11 traceability of cybersecurity evidence.
-- Mirror the schema enum and AuditAction type (lock-step).
--   cyber.threat_modeled       — threat model generated from architecture input (REQ-001)
--   cyber.sbom_imported        — SBOM ingested (REQ-003)
--   cyber.sbom_validated       — SBOM format validation result recorded (REQ-003)
--   cyber.sbom_diffed          — two SBOM versions diffed (REQ-004)
--   cyber.cve_analyzed         — CVE/KEV impact analysis performed (REQ-005/006)
--   cyber.update_plan_created  — secure update / patch / end-of-support plan generated (REQ-007)
--   cyber.evidence_bundled     — cybersecurity evidence bundle assembled (REQ-009/012/014)
--   cyber.risk_linked          — residual cyber risk linked to ISO 14971 risk item (REQ-010)
--   cyber.access_denied        — entitlement-less access blocked (REQ-013)
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'cyber.threat_modeled';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'cyber.sbom_imported';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'cyber.sbom_validated';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'cyber.sbom_diffed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'cyber.cve_analyzed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'cyber.update_plan_created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'cyber.evidence_bundled';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'cyber.risk_linked';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'cyber.access_denied';

-- SBOM format enum (SPDX / CycloneDX). REQ-CYBERDEVICE-003.
CREATE TYPE sbom_format AS ENUM ('spdx', 'cyclonedx');

-- CVE severity enum (CVSS v3.1 base-score bands). REQ-CYBERDEVICE-005.
CREATE TYPE cve_severity AS ENUM ('none', 'low', 'medium', 'high', 'critical');

-- -------------------------------------
-- §2 Tables
-- -------------------------------------

-- threat_model: product architecture-driven threat model (REQ-CYBERDEVICE-001).
-- architecture_input  — JSONB: connectivity, data flows, assets, trust boundaries.
-- threats             — JSONB: generated threat list (STRIDE-style categories).
-- gspr_mapping        — JSONB: GSPR 17.2/17.4 + IEC 81001-5-1 clause mapping.
CREATE TABLE threat_model (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  architecture_input jsonb NOT NULL,
  threats jsonb NOT NULL DEFAULT '{}'::jsonb,
  gspr_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_threat_model_org_project ON threat_model(org_id, project_id);

ALTER TABLE threat_model ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_threat_model"
  ON threat_model FOR ALL
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- sbom: imported software bill of materials (REQ-CYBERDEVICE-003/004).
-- format        — spdx | cyclonedx.
-- version       — caller-supplied version label for diff tracking.
-- components    — JSONB: normalized component array (name, version, supplier, purl/cpe).
-- validated     — true once structural validation passes.
-- content_hash  — sha256 of the canonical component payload, for dedup/versioning.
CREATE TABLE sbom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  format sbom_format NOT NULL,
  version text NOT NULL,
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  validated boolean NOT NULL DEFAULT false,
  content_hash text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sbom_org_project ON sbom(org_id, project_id);
CREATE INDEX idx_sbom_org_project_version ON sbom(org_id, project_id, version);

ALTER TABLE sbom ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_sbom"
  ON sbom FOR ALL
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- cve_impact: known vulnerability impact on a product component (REQ-CYBERDEVICE-005/006/010).
-- cve_id              — CVE identifier (e.g. CVE-2025-1234).
-- kev_flag            — true if listed in CISA Known Exploited Vulnerabilities catalog.
-- affected_component_ref — opaque ref into sbom.components JSONB (purl/cpe/name+version).
-- severity            — CVSS v3.1 band.
-- mitigation          — free-form mitigation / compensating control text.
-- risk_item_id        — nullable FK to risk_items (ISO 14971 residual risk linkage, REQ-010).
-- sbom_id             — FK to the SBOM the component belongs to.
CREATE TABLE cve_impact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  cve_id text NOT NULL,
  kev_flag boolean NOT NULL DEFAULT false,
  affected_component_ref text NOT NULL,
  severity cve_severity NOT NULL DEFAULT 'none',
  mitigation text,
  risk_item_id uuid REFERENCES risk_items(id) ON DELETE SET NULL,
  sbom_id uuid REFERENCES sbom(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cve_impact_org_project ON cve_impact(org_id, project_id);
CREATE INDEX idx_cve_impact_cve ON cve_impact(org_id, cve_id);
CREATE INDEX idx_cve_impact_risk_item ON cve_impact(risk_item_id);

ALTER TABLE cve_impact ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_cve_impact"
  ON cve_impact FOR ALL
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- cyber_evidence_bundle: assembled cybersecurity evidence packet (REQ-CYBERDEVICE-009/012/014).
-- Links threat model + SBOM + pentest artifact + update plan to downstream SaMD/DHF/Submission.
-- pentest_artifact_path — opaque storage path (S3/R2 key) for external pen-test evidence.
-- update_plan           — JSONB: secure update / patch / end-of-support plan.
-- linked_samd_id        — nullable FK to SaMD record (Issue #63).
-- linked_dhf_id         — nullable FK to DHF record (Issue #64).
-- linked_submission_id  — nullable FK to submission record (Issue #65).
CREATE TABLE cyber_evidence_bundle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  threat_model_id uuid REFERENCES threat_model(id) ON DELETE SET NULL,
  sbom_id uuid REFERENCES sbom(id) ON DELETE SET NULL,
  pentest_artifact_path text,
  update_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  linked_samd_id uuid,
  linked_dhf_id uuid,
  linked_submission_id uuid,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cyber_evidence_bundle_org_project ON cyber_evidence_bundle(org_id, project_id);
CREATE INDEX idx_cyber_evidence_bundle_samd ON cyber_evidence_bundle(linked_samd_id);
CREATE INDEX idx_cyber_evidence_bundle_dhf ON cyber_evidence_bundle(linked_dhf_id);
CREATE INDEX idx_cyber_evidence_bundle_submission ON cyber_evidence_bundle(linked_submission_id);

ALTER TABLE cyber_evidence_bundle ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_cyber_evidence_bundle"
  ON cyber_evidence_bundle FOR ALL
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
