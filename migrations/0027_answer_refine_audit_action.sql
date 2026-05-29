-- Wave 5 Answer Refine: add answer.refine enum value to audit_action
-- REQ-ANSWER-REFINE-003 (immutable revision audit trail)
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'answer.refine';
