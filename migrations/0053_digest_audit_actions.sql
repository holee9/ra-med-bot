ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'digest_generated';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'digest_emailed';
ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'digest';
