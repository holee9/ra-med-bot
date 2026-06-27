-- Migration: Owning-project issue routing (#157) + #156 AC4 integration-gap bridge
-- SPEC: SPEC-REGULA-KNOWLEDGE-GAP-001 AC2/AC3 (Issue #157)
-- Scope:
--   1. unanswered_queue +2 columns:
--      owning_issue_url     text  — cross-repo issue URL (null until createOwningIssue succeeds)
--      owning_issue_target  text  — OwningTarget ('ra-project'|'md-process'|'gitea-wiki'|'hybrid-ra-saas')
--   2. audit_action +2:
--      'owning_issue_created'          — owning issue opened in target repo
--      'owning_issue_creation_failed'  — retry exhausted; queue row stays 'queued'
--
-- Design decisions:
--   #1 owning_issue_target stored as text (not enum) — keeps target set extensible
--      without future migrations when a new owning repo type is added.
--   #2 No FK from owning_issue_url — GitHub URLs are opaque strings; cross-repo
--      integrity is enforced at application layer (owning-issue.ts), not DB layer.
--   #3 Columns are nullable — existing rows and rows where routing is disabled
--      (ROUTING_ENABLED absent) keep NULL values. No backfill needed.
--   #4 IF NOT EXISTS guards on all ALTERs — idempotent re-runs are safe.
--
-- Regulatory anchors:
--   21 CFR Part 11 — owning-issue cross-link is an audit-material record.
--   ISO 13485 traceability — provenance chain from gap → triage issue → owning issue.

-- §1. unanswered_queue columns
ALTER TABLE unanswered_queue
  ADD COLUMN IF NOT EXISTS owning_issue_url text;
ALTER TABLE unanswered_queue
  ADD COLUMN IF NOT EXISTS owning_issue_target text;

-- §2. audit_action enum extensions (PostgreSQL requires separate statements)
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'owning_issue_created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'owning_issue_creation_failed';
