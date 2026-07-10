-- SPEC-REGULA-WORKFLOWS-LLM-002 M0-4: shared workflow-engine infrastructure.
-- Applies to: workflow_runs (columns) + audit_action (enum values).
-- Verified on regula-test-db (pgvector pg16) via direct ALTER.
--
-- NOTE: This project uses `drizzle-kit push` (schema.ts → DB) as the primary
-- migration path. This file documents the manual ALTERs applied for M0-4 so
-- the change is reproducible on fresh DBs / other environments. drizzle-kit
-- push will detect these as already-applied (idempotent IF NOT EXISTS).

-- ── audit_action enum: 4 new values (REQ-WFLLM-007/008) ──────────────────
-- ALTER TYPE ADD VALUE cannot run inside a transaction block.
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'workflow.llm_call';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'workflow.draft_version';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'workflow.expert_flagged';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'workflow.export_blocked';

-- ── workflow_runs: draft_version + citation_coverage (§4.2) ──────────────
ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS draft_version integer NOT NULL DEFAULT 0;

ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS citation_coverage numeric(5,4);
