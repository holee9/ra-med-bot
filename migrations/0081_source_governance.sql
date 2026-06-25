-- Migration: Source Governance — Authority, Version, Effective/Sunset, Approval (Issue 48)
-- SPEC: SPEC-REGULA-SOURCE-GOVERNANCE-001 (REQ-SOURCE-GOV-001~016, AC-01~08)
-- Scope:
--   1. 2 new enums: source_authority_grade, source_approval_status
--   2. ALTER sources: +9 governance columns (authority, jurisdiction, version,
--      effective/sunset dates, supersession self-ref, owner_department, approval,
--      review cycle/last-reviewed)
--   3. audit_action +8 (source.* lifecycle for 21 CFR Part 11 traceability)
--   4. Indexes on authority_grade, approval_status, sunset_date, superseded_by
--
-- Regulatory anchors:
--   ISO 13485 / 21 CFR Part 820 Document Control — valid version, obsolescence,
--     approval status (REQ-SOURCE-GOV-001/002/003)
--   Jurisdiction-scoped citations — FDA/EU MDR/MFDS current regulations only
--     (REQ-SOURCE-GOV-002/005/007)
--   21 CFR Part 11 — approval/reject events are audit-material records
--     (REQ-SOURCE-GOV-015)
--
-- The sources table already has RLS (org-isolation, migrations 0067-0079 pattern).
-- The new columns inherit the existing row-level policy; no new RLS clause needed
-- because the policy is table-level (FOR ALL), not column-level.
-- WITH CHECK clauses remain a project-wide follow-up (Issue #239); USING-only
-- is consistent with all previously merged SPEC migrations.

-- -------------------------------------
-- §1 Enum extensions
-- -------------------------------------

-- Source authority grade. REQ-SOURCE-GOV-001. 6-tier hierarchy from highest
-- (regulator_official) to lowest (secondary_reference). Drives retrieval ranking
-- (REQ-004) and low-authority expert-review gating (REQ-008).
CREATE TYPE source_authority_grade AS ENUM (
  'regulator_official',
  'harmonized_standard',
  'internal_sop',
  'prior_submission',
  'public_database',
  'secondary_reference'
);

-- Source approval status. REQ-SOURCE-GOV-009. Controls search eligibility:
--   pending_review — newly ingested, awaiting RA-owner approval (default)
--   approved       — RA owner approved, search-eligible
--   rejected       — RA owner rejected, search-excluded (retained for audit)
CREATE TYPE source_approval_status AS ENUM (
  'pending_review',
  'approved',
  'rejected'
);

-- source.* audit actions (Issue 48, REQ-SOURCE-GOV-015). 8 lifecycle audit
-- actions for 21 CFR Part 11 traceability of source governance state.
-- Mirror the schema enum and AuditAction type (lock-step).
--   source.approved              — RA owner approved a pending_review source
--   source.rejected              — RA owner rejected a pending_review source
--   source.review_due            — periodic review cycle due (REQ-011/013)
--   source.superseded            — source marked superseded_by another (REQ-005)
--   source.stale_blocked         — stale citation blocked at draft/export (REQ-007)
--   source.low_authority_flagged — low-authority-only retrieval flagged expert review (REQ-008)
--   source.governance_updated    — governance fields updated (authority/jurisdiction/dates)
--   source.delta_sync_updated    — #45 delta-sync refreshed governance state (REQ-016)
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'source.approved';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'source.rejected';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'source.review_due';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'source.superseded';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'source.stale_blocked';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'source.low_authority_flagged';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'source.governance_updated';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'source.delta_sync_updated';

-- -------------------------------------
-- §2 sources table extensions
-- -------------------------------------

-- REQ-SOURCE-GOV-001/002/003 — governance columns added to the existing
-- sources table. All nullable except approval_status (defaults to pending_review
-- per REQ-009: new sources enter pending_review until RA owner approval).
ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS authority_grade source_authority_grade,
  ADD COLUMN IF NOT EXISTS jurisdiction text,
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS sunset_date date,
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_department text,
  ADD COLUMN IF NOT EXISTS approval_status source_approval_status NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS review_cycle_days integer,
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz;

-- REQ-SOURCE-GOV-004/005/009 — retrieval-gate indexes.
-- authority_grade: priority ranking filter (regulator_official first).
-- approval_status: exclude pending_review/rejected from default search.
-- sunset_date: stale-citation detection at draft/export.
-- superseded_by: supersession traversal (historical lookups).
CREATE INDEX IF NOT EXISTS idx_sources_authority_grade ON sources(authority_grade);
CREATE INDEX IF NOT EXISTS idx_sources_approval_status ON sources(approval_status);
CREATE INDEX IF NOT EXISTS idx_sources_sunset_date ON sources(sunset_date);
CREATE INDEX IF NOT EXISTS idx_sources_superseded_by ON sources(superseded_by);
CREATE INDEX IF NOT EXISTS idx_sources_effective_date ON sources(effective_date);
