-- SPEC-V3-INBOX-001 — RA Inbox (4-column Kanban + Triage State Machine)
-- Migration 0104: inbox_tickets + approved_answers tables
--
-- Creates:
--   1. inbox_tickets table (REQ-V3-INBOX-001)
--   2. approved_answers table (REQ-V3-INBOX-026)
--   3. audit_action enum +8 values (REQ-V3-INBOX-021)
--   4. RLS policies for org-isolation (REQ-V3-INBOX-025)
--
-- NOTE: answer_promoted/answer_unpromoted already exist in schema.ts:401-402
--       (added via 0086_knowledge_promo.sql, SPEC-REGULA-KNOWLEDGE-PROMO-001 #50)
--       These will be reused for approved_answers promotion (REQ-V3-INBOX-029).

BEGIN;

-- 1. inbox_tickets table (REQ-V3-INBOX-001)
CREATE TABLE inbox_tickets (
  id TEXT PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_user UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  product_id TEXT,
  tags TEXT[],
  triage_state TEXT NOT NULL CHECK (triage_state IN ('auto', 'needs-review', 'escalated', 'waiting', 'closed', 'rejected')),
  auto_answer TEXT,
  auto_confidence NUMERIC(5,2),
  ra_assignee UUID REFERENCES users(id) ON DELETE SET NULL,
  escalate_to TEXT,
  final_answer TEXT,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  sla_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Indexes (REQ-V3-INBOX-003)
CREATE INDEX inbox_tickets_triage_state_sla_deadline_idx ON inbox_tickets(triage_state, sla_deadline);
CREATE INDEX inbox_tickets_from_user_idx ON inbox_tickets(from_user);
CREATE INDEX inbox_tickets_org_id_idx ON inbox_tickets(org_id);

-- 2. approved_answers table (REQ-V3-INBOX-026)
CREATE TABLE approved_answers (
  id TEXT PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  citations JSONB DEFAULT '[]',
  hits INT DEFAULT 0,
  state TEXT NOT NULL CHECK (state IN ('draft', 'published', 'deprecated')),
  from_ticket TEXT NOT NULL REFERENCES inbox_tickets(id) ON DELETE CASCADE,
  published_by UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes (REQ-V3-INBOX-027)
CREATE INDEX approved_answers_state_idx ON approved_answers(state);
CREATE INDEX approved_answers_fts_idx ON approved_answers USING GIN (to_tsvector('simple', question || ' ' || answer));

-- 3. audit_action enum +8 values (REQ-V3-INBOX-021)
-- answer_promoted/answer_unpromoted already exist (0086_knowledge_promo.sql)
-- Adding 8 new inbox-specific actions:
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'inbox.created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'inbox.triaged';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'inbox.assigned';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'inbox.escalated';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'inbox.answered';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'inbox.approved';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'inbox.closed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'inbox.rejected';

-- 4. RLS policies for org-isolation (REQ-V3-INBOX-025)
-- NOTE: RLS is currently inert (#239 debt). Actual isolation is enforced at query-layer.
-- These policies are future-proofing for when RLS is enabled.

-- Enable RLS on both tables
ALTER TABLE inbox_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_answers ENABLE ROW LEVEL SECURITY;

-- Policy: only rows matching current_org_id GUC are accessible
CREATE POLICY inbox_tickets_org_isolation ON inbox_tickets
  FOR ALL
  TO regula_app
  USING (org_id = current_setting('app.current_org_id', TRUE)::UUID);

CREATE POLICY approved_answers_org_isolation ON approved_answers
  FOR ALL
  TO regula_app
  USING (org_id = current_setting('app.current_org_id', TRUE)::UUID);

COMMIT;

-- Data retention notes (ISO 13485 §4.2.5):
--   inbox_tickets (closed): 7 years retention
--   approved_answers: 7 years retention
--   audit_log: 10 years (21 CFR Part 11 + MDR Art. 10(8))
-- No automatic DELETE rules implemented here — retention is operational policy.
