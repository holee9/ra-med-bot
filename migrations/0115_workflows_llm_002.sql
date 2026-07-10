-- 0115_workflows_llm_002.sql
-- SPEC-REGULA-WORKFLOWS-LLM-002 (M0-4) — workflow_runs draft versioning +
-- citation coverage + 4 audit actions for real gx10 executor pipeline.
--
-- Root cause for this file's existence: the M0 migration was initially placed
-- in lib/db/migrations/ (drizzle output dir) which CI does NOT apply — CI uses
-- `cat migrations/[0-9]*.sql | psql` (repo-root migrations/). The columns/enum
-- were therefore absent in CI's from-scratch DB, breaking cer-persist-roundtrip
-- (column "draft_version" does not exist). This file is the canonical migration
-- in the applied set. Idempotent (IF NOT EXISTS) — safe on DBs where drizzle-kit
-- push already added the columns locally.
--
-- ALTER TYPE ADD VALUE cannot run inside a transaction block; this file is
-- applied via `cat | psql` (autocommit per statement), so each ADD VALUE runs
-- in its own implicit transaction (see migrations-real-db.yml apply step).

-- ── audit_action enum: 4 new values (REQ-WFLLM-007/008) ──────────────────
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'workflow.llm_call';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'workflow.draft_version';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'workflow.expert_flagged';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'workflow.export_blocked';

-- ── workflow_runs: draft_version + citation_coverage (§4.2) ──────────────
ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS draft_version integer NOT NULL DEFAULT 0;

ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS citation_coverage numeric(5,4);
