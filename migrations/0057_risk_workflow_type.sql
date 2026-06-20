-- SPEC-REGULA-RISK-001: ISO 14971 Risk Management — workflow type + audit actions
-- Adds 'risk' to workflow_type enum and 7 risk audit action values.

ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'risk';

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'risk.hazard_identified';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'risk.matrix_evaluated';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'risk.item_deleted';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'risk.control_adopted';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'risk.residual_accepted';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'risk.gspr_mapped';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'risk.report_approved';
