-- @MX:NOTE [AUTO] Adds audit action for mutable conversation deletion.
-- @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-032)

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'conversation.delete';
