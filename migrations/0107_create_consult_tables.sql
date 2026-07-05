-- SPEC-V3-CONSULT-001 — RA Power Chat (v3 Phase C-5)
-- Migration 0107: consult_sessions + consult_turns tables
--
-- Creates:
--   1. consult_sessions table (REQ-CONS-001)
--   2. consult_turns table (REQ-CONS-004, Exchange model — H-1)
--   3. audit_action enum +3 values (REQ-CONS-008, REQ-CONS-009, REQ-CONS-013)
--   4. RLS policies for org-isolation (REQ-CONS-012)
--
-- NOTE: RLS is currently inert (#239 debt). Actual isolation is enforced at
--       query-layer (withTenantScope / app-level eq(orgId)). These policies
--       are future-proofing for when RLS is FORCE-enabled.
--
-- v2 호환성 (R-01): consult_sessions/turns are ISOLATED from existing
-- conversations/messages. The legacy 1-shot /api/ra/consult SSE route is
-- untouched (T-27 regression test).

BEGIN;

-- 1. consult_sessions table (REQ-CONS-001)
CREATE TABLE consult_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'ko',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX consult_sessions_org_id_idx ON consult_sessions(org_id);
CREATE INDEX consult_sessions_user_id_idx ON consult_sessions(user_id);
CREATE INDEX consult_sessions_created_at_idx ON consult_sessions(created_at);

-- 2. consult_turns table (REQ-CONS-004, Exchange model — H-1)
-- Exchange model: one turn = one Q+A pair. No `role` column.
CREATE TABLE consult_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES consult_sessions(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  citations JSONB NOT NULL DEFAULT '[]',
  sources JSONB NOT NULL DEFAULT '[]',
  confidence REAL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, turn_number)
);

CREATE INDEX consult_turns_session_turn_idx ON consult_turns(session_id, turn_number);

-- 3. audit_action enum +3 (REQ-CONS-008 turn.create, REQ-CONS-009 session.delete,
--    REQ-CONS-013 session.create — 21 CFR Part 11 §11.10(e))
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'consult.session.create';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'consult.turn.create';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'consult.session.delete';

-- 4. RLS policies for org-isolation (REQ-CONS-012)
ALTER TABLE consult_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consult_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY consult_sessions_org_isolation ON consult_sessions
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY consult_turns_org_isolation ON consult_turns
  USING (
    EXISTS (
      SELECT 1 FROM consult_sessions s
      WHERE s.id = consult_turns.session_id
        AND s.org_id = current_setting('app.current_org_id', true)::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM consult_sessions s
      WHERE s.id = consult_turns.session_id
        AND s.org_id = current_setting('app.current_org_id', true)::uuid
    )
  );

COMMIT;
