-- REQ-PCCP-021~023, 015, 024: PCCP audit action enum values.
-- @MX:SPEC SPEC-REGULA-PCCP-001

ALTER TYPE audit_action ADD VALUE 'pccp_created';
ALTER TYPE audit_action ADD VALUE 'pccp_component_completed';
ALTER TYPE audit_action ADD VALUE 'pccp_expert_approved';
ALTER TYPE audit_action ADD VALUE 'pccp_algorithm_change_triggered';
ALTER TYPE audit_action ADD VALUE 'pccp_status_changed';
