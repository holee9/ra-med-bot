-- Migration: RLHF implicit feedback (alternate answers) — Issue #264 sub-PR 3/3
-- SPEC: SPEC-REGULA-RLHF-001 (REQ-RLHF-001, REQ-RLHF-004, REQ-RLHF-005,
--        REQ-RLHF-009, REQ-RLHF-010, REQ-RLHF-015)
--
-- Scope:
--   1. New enum: answer_feedback_source ('explicit', 'implicit_regenerate')
--   2. answer_feedback ADD COLUMN feedback_source (default 'explicit') + variation_dimensions jsonb
--   3. Replace UNIQUE(message_id, user_id) with UNIQUE(message_id, user_id, feedback_source)
--      so explicit + implicit rows coexist on the same (message, user).
--   4. audit_action +1 (rlhf.implicit_feedback_recorded)
--
-- Background:
--   sub-PR 1/3 (0093) extended quality_tag. sub-PR 2/3 (0095) added
--   calibration_candidates. This sub-PR captures the IMPLICIT "this answer was
--   insufficient" signal when a user clicks "Regenerate answer" — the
--   regeneration IS the implicit downvote. The client then re-asks via the
--   EXISTING chat composer (no new regeneration pipeline; just feedback
--   capture). REQ-RLHF-004 records feedback with userId; this extends that
--   mechanism to distinguish explicit (thumbs up/down) from implicit
--   (regenerate-click) signals.
--
-- Charter anchors:
--   [지양-2] No fake trust — implicit signals flow into the SAME aggregation
--            (rating='down') but NEVER auto-trigger calibration or promotion.
--   [지양-4] No AI regulatory judgment — implicit is a SIGNAL, not an ACTION.
--
-- Compatibility:
--   Backwards compatible: existing rows default to feedback_source='explicit'.
--   The UNIQUE constraint change is the one structural mutation — DROP IF EXISTS
--   the old 2-column unique, ADD the new 3-column unique. Idempotent.

-- -------------------------------------
-- §1 New enum: answer_feedback_source
-- -------------------------------------

-- REQ-RLHF-001 extension: the origin channel of a feedback row.
--   explicit             — thumbs up/down submitted by the user (default)
--   implicit_regenerate  — user clicked "Regenerate answer"; the regeneration
--                          is treated as rating='down' implicit feedback
CREATE TYPE answer_feedback_source AS ENUM (
  'explicit',
  'implicit_regenerate'
);

-- -------------------------------------
-- §2 answer_feedback ADD COLUMNs
-- -------------------------------------

-- feedback_source: the origin channel (default 'explicit'). Existing rows are
-- backfilled as 'explicit' by virtue of the NOT NULL DEFAULT.
ALTER TABLE answer_feedback
  ADD COLUMN IF NOT EXISTS feedback_source answer_feedback_source
  NOT NULL DEFAULT 'explicit';

-- variation_dimensions: optional client-supplied metadata describing WHICH
-- retrieval/generation dimension differed on the regenerated attempt. NULLABLE
-- so existing rows and explicit feedback without variation context stay clean.
-- Keys observed (all optional): region, corpus, model.
ALTER TABLE answer_feedback
  ADD COLUMN IF NOT EXISTS variation_dimensions jsonb;

-- -------------------------------------
-- §3 UNIQUE constraint change
-- -------------------------------------

-- The original 0082 UNIQUE(message_id, user_id) collides when a user leaves
-- EXPLICIT feedback AND later regenerates (implicit). Drop the 2-column unique
-- and replace with a 3-column unique so one explicit + one implicit row per
-- (message, user) coexist. The Drizzle schema mirrors this.
--
-- Idempotent: DROP IF EXISTS + ADD IF NOT EXISTS. The constraint is named
-- explicitly so future migrations can target it without ambiguity.
ALTER TABLE answer_feedback
  DROP CONSTRAINT IF EXISTS answer_feedback_message_user_idx;

ALTER TABLE answer_feedback
  DROP CONSTRAINT IF EXISTS answer_feedback_message_user_source_idx;

-- @MX:WARN [AUTO] UNIQUE(message_id, user_id, feedback_source) — at most ONE
--   explicit + ONE implicit_regenerate row per (message, user). The route's
--   existing-row lookup MUST scope by feedback_source to avoid a wrong-row
--   update when both channels are present.
ALTER TABLE answer_feedback
  ADD CONSTRAINT answer_feedback_message_user_source_idx
  UNIQUE (message_id, user_id, feedback_source);

-- -------------------------------------
-- §4 Extend audit_action enum (+1)
-- -------------------------------------

-- 21 CFR Part 11: implicit feedback is recorded with a DISTINCT action so
-- regulators can separate implicit-regenerate signals from explicit
-- thumbs-up/down submissions in the audit trail. Mirrors `feedback_submitted`
-- naming convention.
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'rlhf.implicit_feedback_recorded';
