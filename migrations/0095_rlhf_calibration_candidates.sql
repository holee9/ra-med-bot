-- Migration: RLHF confidence-calibration candidates (Issue #264 sub-PR 2/3)
-- SPEC: SPEC-REGULA-RLHF-001 (REQ-RLHF-005 aggregate, REQ-RLHF-006 trend,
--        REQ-RLHF-014 post-rerank invariant, REQ-RLHF-015 no auto-promotion)
--
-- Scope:
--   1. New enum: calibration_candidate_status (4 values)
--   2. New table: calibration_candidates — proposed confidence-calibration
--      adjustments detected from observed feedback vs emitted confidence.
--   3. audit_action +1 (rlhf.calibration_proposed)
--
-- Product charter anchors (NON-NEGOTIABLE):
--   [지양-2] No fake trust  — calibration correction values are NEVER
--            auto-applied to retrieval. status starts at 'pending' and only
--            transitions via RA-Lead governance review.
--   [지양-4] No AI regulatory judgment — any calibration change flows through
--            #71 MODEL-GOVERNANCE change-control. The nullable
--            governance_change_request_id column links an approved candidate
--            to its change_request row once the RA Lead creates one.
--
-- Calibration semantics:
--   A row captures ONE observation: "in confidence bucket B (e.g. [0.7,0.8)),
--   across N feedback samples, the observed up-vote ratio was R". When R is
--   materially below the bucket midpoint (overconfident) or above
--   (underconfident), a candidate is proposed for human review. The
--   detection thresholds + min sample size live in
--   lib/rlhf/calibration-detector.ts (pure functions, no DB).
--
-- Reuse: organizations (FK), users (FK), change_request (nullable FK link to
-- #71 governance domain so an approved candidate can be tied to the
-- change-control record that authorized its application).

-- -------------------------------------
-- §1 New enum: calibration_candidate_status
-- -------------------------------------

-- REQ-RLHF-015: lifecycle of a calibration candidate.
--   pending                   — freshly detected, awaiting RA-Lead review
--   reviewed                  — RA-Lead reviewed; linked to a governance
--                               change_request (governance_change_request_id)
--   dismissed                 — RA-Lead reviewed and rejected (noise / no action)
--   applied_via_governance    — the linked change_request was approved AND
--                               rolled out through #71 change-control. This
--                               status is set ONLY by the governance approve
--                               path, never by the calibration detector.
CREATE TYPE calibration_candidate_status AS ENUM (
  'pending',
  'reviewed',
  'dismissed',
  'applied_via_governance'
);

-- -------------------------------------
-- §2 New table: calibration_candidates
-- -------------------------------------

-- @MX:WARN [AUTO] confidence_bucket is text, NOT numeric — it encodes a
--   half-open interval label (e.g. '0.7-0.8') so the candidate row is
--   human-readable in audit + dashboards without a join.
-- @MX:REASON the detector buckets confidence into named bands; storing the
--   band label (not the raw score) matches the detection granularity and
--   keeps the candidate row stable across minor score drift.
CREATE TABLE calibration_candidates (
  id                                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Human-readable half-open confidence band, e.g. '0.7-0.8'. See
  -- lib/rlhf/calibration-detector.ts CONFIDENCE_BUCKETS for the canonical list.
  confidence_bucket                 text NOT NULL,
  -- Optional secondary dimension: 'all' | 'regulation' | 'guidance' | etc.
  -- Lets the detector surface calibration drift per source-type subset.
  source_type                       text NOT NULL DEFAULT 'all',
  -- Observed ratio of up-votes in this bucket (NULL until first sample).
  observed_up_ratio                 numeric(4,3),
  -- Number of feedback samples aggregated into this candidate.
  sample_size                       integer NOT NULL DEFAULT 0,
  -- Detection verdict: 'overconfident' | 'underconfident' | 'well_calibrated'.
  -- Only overconfident/underconfident produce a pending candidate row.
  verdict                           text NOT NULL,
  -- Lifecycle (REQ-RLHF-015). Defaults to 'pending' — the detector MUST NOT
  -- set any other value. Transitions to reviewed/applied_via_governance happen
  -- only through RA-Lead governance review.
  status                            calibration_candidate_status NOT NULL DEFAULT 'pending',
  proposed_by                       uuid REFERENCES users(id) ON DELETE SET NULL,
  proposed_at                       timestamptz NOT NULL DEFAULT now(),
  reviewed_by                       uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at                       timestamptz,
  -- Nullable link to #71 MODEL-GOVERNANCE change_request. Set when the RA Lead
  -- creates a change_request to act on this candidate. NULL until then.
  governance_change_request_id      uuid REFERENCES change_request(id) ON DELETE SET NULL,
  -- Free-form RA-Lead notes (review decision rationale). PII-free.
  review_notes                      text,
  created_at                        timestamptz NOT NULL DEFAULT now(),
  updated_at                        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_calibration_candidates_org_status
  ON calibration_candidates(org_id, status);
CREATE INDEX idx_calibration_candidates_org_bucket
  ON calibration_candidates(org_id, confidence_bucket, source_type);
CREATE INDEX idx_calibration_candidates_proposed_at
  ON calibration_candidates(proposed_at);

-- RLS: org isolation. RLS is inert project-wide (#239 debt — service-role db
-- client bypasses row security). The query-layer eq(org_id, session.orgId)
-- guard in lib/rlhf/calibration-proposal.ts + the API route is the ACTUAL
-- tenant boundary. The policy below is defense-in-depth for when #239 enables
-- per-request SET LOCAL role.
ALTER TABLE calibration_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY calibration_candidates_org_isolation ON calibration_candidates
  USING (
    EXISTS (
      SELECT 1
      FROM org_members om
      WHERE om.org_id = calibration_candidates.org_id
    )
  );

-- -------------------------------------
-- §3 Extend audit_action enum (+1)
-- -------------------------------------

-- REQ-RLHF-005/015 / 21 CFR Part 11: every calibration proposal is an
-- audit-material record. The action name `rlhf.calibration_proposed` mirrors
-- the `reranking_proposed` naming convention — the candidate is a PENDING
-- proposal, NEVER an applied change.
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'rlhf.calibration_proposed';
