-- Migration: RLHF quality_tag enum +4 (confidence-breakdown dimensions)
-- SPEC: SPEC-REGULA-RLHF-001 (REQ-RLHF-002 extension, Issue #264 sub-PR 1/3)
-- Scope: ALTER TYPE quality_tag ADD VALUE x4 (idempotent IF NOT EXISTS)
--   - citation_coverage_low
--   - source_recency_stale
--   - source_authority_weak
--   - source_agreement_conflict
--
-- Background:
--   Issue #264 follow-up — the 8-value enum (migration 0082 §1) is extended
--   with 4 confidence-breakdown dimensions aligned with the [Confidence Explain]
--   direction. The original 0082 is NOT edited (merged record); this migration
--   is additive only. The Drizzle pgEnum (lib/db/schema.ts qualityTagEnum) and
--   the client/server validators (feedback-control.tsx, /api/rlhf/feedback) are
--   expanded in lock-step.
--
-- Approach:
--   ALTER TYPE ... ADD VALUE IF NOT EXISTS. Idempotent — safe to re-run. Each
--   statement runs outside a transaction block (Postgres requirement for
--   ADD VALUE); psql autocommit handles this when applied via `cat | psql`.
--
-- Note: ALTER TYPE ADD VALUE cannot run inside a transaction. Apply via
--   `cat migrations/0093_rlhf_quality_tags_plus4.sql | psql ... -v ON_ERROR_STOP=1`
-- (NOT via a multi-statement transaction wrapper).

ALTER TYPE quality_tag ADD VALUE IF NOT EXISTS 'citation_coverage_low';
ALTER TYPE quality_tag ADD VALUE IF NOT EXISTS 'source_recency_stale';
ALTER TYPE quality_tag ADD VALUE IF NOT EXISTS 'source_authority_weak';
ALTER TYPE quality_tag ADD VALUE IF NOT EXISTS 'source_agreement_conflict';
