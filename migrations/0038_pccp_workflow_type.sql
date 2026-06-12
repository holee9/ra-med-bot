-- REQ-PCCP-025: Add 'pccp' to workflow_type enum.
-- Postgres requires a separate transaction for ALTER TYPE ADD VALUE.
-- @MX:SPEC SPEC-REGULA-PCCP-001

ALTER TYPE workflow_type ADD VALUE 'pccp';
