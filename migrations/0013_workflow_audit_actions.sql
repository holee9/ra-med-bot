-- SPEC-REGULA-WORKFLOWS-001 M1 — Phase 9 Workflow audit_action enum extension
-- REQ-WF-052: 10 Phase 9 workflow audit action values.

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'workflow.start';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'workflow.step.complete';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'workflow.step.fail';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'workflow.pause';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'workflow.resume';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'workflow.pending_review';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'workflow.approve';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'workflow.reject';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'workflow.download';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'workflow.edit';
