-- SPEC-REGULA-IMPACT-001: 3 new audit_action enum values (REQ-IMPACT-003).
-- Brings total from 51 to 54 on this branch.
-- NOTE: Each ADD VALUE must be in its own transaction (Postgres restriction).
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'impact.assessment_created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'impact.critical_detected';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'impact.action_item_created';
