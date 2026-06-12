-- SPEC-REGULA-CLASSIFY-001 — classification audit action and workflow type.
-- REQ-CLASSIFY-015: audit device classification events.
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'device_classified';
ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'classification';
