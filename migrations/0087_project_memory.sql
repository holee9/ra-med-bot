-- Migration: Project Memory — Persistent Context & Decision Accumulation (Issue #51)
-- SPEC: SPEC-REGULA-PROJECT-MEMORY-001 (REQ-PROJECT-MEMORY-001~014, AC-01~08)
-- Scope:
--   1. 2 new enums: project_memory_type (6 values), project_memory_status (3 values)
--   2. New table: project_memory (id, project_id, memory_type, key, value,
--      source_conversation_id, created_by, status, valid_from, valid_until,
--      created_at) with UNIQUE (project_id, key) WHERE status='active' +
--      RLS org isolation via projects -> org_members join (mirrors 0082/0086)
--   3. Index (project_id, key, valid_until) — valid-memory lookup optimization
--   4. audit_action +3 ('memory_created', 'memory_updated', 'memory_invalidated')
--
-- Regulatory anchors:
--   ISO 13485 / 21 CFR 820.30 design control — device classification, risk class,
--     predicate device decisions must remain consistent across the project lifetime.
--   21 CFR Part 11 — memory create/update/invalidate is audit-material; every
--     mutation is recorded in the same tx (atomicity, C-3 defect class).
--   Provenance — source_conversation_id traces each extracted memory to its
--     origin conversation (REQ-013, complements Issue #47 traceability).
--
-- Design decisions (tasks.md §7):
--   #1 status model: 'active' (injected) / 'pending' (AI suggestion, RA-lead
--      review pending) / 'invalidated' (historical). Charter [지양-4] / REQ-005:
--      AI NEVER auto-activates — pending -> active requires explicit approve API.
--   #2 Same-key update = invalidate old + create new in ONE tx (REQ-012).
--      UNIQUE partial index (WHERE status='active') is the DB-level guard.
--   #3 valid_until semantics: NULL = permanent. Injection excludes rows where
--      valid_until IS NOT NULL AND valid_until <= now() (REQ-010).
--   #4 RLS inert (#239) — JS-level org guard (lib/project-memory/access.ts) is
--      the authoritative gate. RLS policy below is defense-in-depth.

-- -------------------------------------
-- §1 New enums
-- -------------------------------------

-- REQ-PROJECT-MEMORY-002: memory type categorizes the RA decision dimension.
CREATE TYPE project_memory_type AS ENUM (
  'device_classification',
  'target_markets',
  'submission_strategy',
  'predicate_device',
  'risk_class',
  'custom'
);

-- §7 design decision #2 / REQ-005: status controls lifecycle.
-- 'active' = eligible for system-prompt injection (REQ-003/010).
-- 'pending' = AI-extracted suggestion awaiting RA-lead approval (Charter [지양-4]).
-- 'invalidated' = superseded or manually voided; retained for history (REQ-012).
CREATE TYPE project_memory_status AS ENUM (
  'active',
  'pending',
  'invalidated'
);

-- -------------------------------------
-- §2 New table: project_memory
-- -------------------------------------

-- REQ-001 / AC-01: project-scoped RA decision memory.
CREATE TABLE project_memory (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  memory_type           project_memory_type NOT NULL,
  key                   text NOT NULL,
  value                 text NOT NULL,
  -- REQ-013: provenance. NULL only for RA-lead manual entries (Charter [지양-2]).
  source_conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  created_by            uuid NOT NULL REFERENCES users(id),
  -- §7 #2 / REQ-005: lifecycle gate. Default 'active' for explicit API creates;
  -- extractor-derived rows ALWAYS insert as 'pending'.
  status                project_memory_status NOT NULL DEFAULT 'active',
  valid_from            timestamptz NOT NULL DEFAULT now(),
  -- NULL = permanent (REQ-010). Set on invalidate (REQ-009) or manual expiry.
  valid_until           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- REQ-012 atomicity DB-level guard: at most one active row per (project, key).
-- Same-key update = old row invalidated + new active row in ONE tx (manager.ts).
-- NOTE (SPEC-REGULA-MIGRATION-001 D9): Postgres does NOT support an inline
-- `UNIQUE ... WHERE` partial constraint, so the guard is a partial UNIQUE INDEX
-- (NULLS NOT DISTINCT preserves "one active per key"; the migrations-real-db
-- from-scratch harness expects an index here).
CREATE UNIQUE INDEX project_memory_one_active_per_key
  ON project_memory (project_id, key) NULLS NOT DISTINCT
  WHERE status = 'active';

-- §4.2: valid-memory lookup optimization (project_id, key, valid_until).
CREATE INDEX idx_project_memory_lookup ON project_memory(project_id, key, valid_until);
-- Status filtering for pending review queue and active injection.
CREATE INDEX idx_project_memory_project_status ON project_memory(project_id, status);

-- RLS: org isolation via projects -> org_members join (mirrors 0086 §RLS pattern).
-- project_memory has no direct org_id; the policy resolves ownership through
-- the parent project. @MX:TODO [AUTO] RLS is INERT project-wide (#239); the
--   JS-level org guard in lib/project-memory/access.ts is the ACTUAL tenant
--   boundary. FORCE RLS hardening tracked by Issue #239.
ALTER TABLE project_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_memory_org_isolation ON project_memory
  USING (
    EXISTS (
      SELECT 1
      FROM projects p
      JOIN org_members om ON om.org_id = p.organization_id
      WHERE p.id = project_memory.project_id
    )
  );

-- -------------------------------------
-- §3 Extend audit_action enum (+3)
-- -------------------------------------

-- REQ-007 / AC-05: memory creation is a 21 CFR Part 11 audit-material record.
-- Covers both explicit RA-lead create AND pending->active approval (the approval
-- IS the creation of an authoritative memory row, REQ-014).
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'memory_created';
-- REQ-008 / AC-05: same-key update invalidates old + creates new (REQ-012);
--   this event records the supersession for regulator-facing history.
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'memory_updated';
-- REQ-009 / AC-05: invalidation (soft-delete) sets valid_until + status;
--   hard delete is forbidden (history preservation, §6 Charter guard).
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'memory_invalidated';
