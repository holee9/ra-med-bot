-- @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-057)
--
-- Adds 10 new audit_action enum values for Wave 1 Breadth features.
-- PostgreSQL requires a separate ALTER TYPE ... ADD VALUE statement per value.
-- Each statement is transactional in PG 12+.
--
-- Existing values (Phase 1): llm.call, source.access, expert_review.flag
-- New values (Phase 3 / Breadth): conversations.list, conversation.view,
--   message.feedback, template.list, template.download, updates.list,
--   dashboard.view, projects.list, project.create, project.update

ALTER TYPE audit_action ADD VALUE 'conversations.list';
ALTER TYPE audit_action ADD VALUE 'conversation.view';
ALTER TYPE audit_action ADD VALUE 'message.feedback';
ALTER TYPE audit_action ADD VALUE 'template.list';
ALTER TYPE audit_action ADD VALUE 'template.download';
ALTER TYPE audit_action ADD VALUE 'updates.list';
ALTER TYPE audit_action ADD VALUE 'dashboard.view';
ALTER TYPE audit_action ADD VALUE 'projects.list';
ALTER TYPE audit_action ADD VALUE 'project.create';
ALTER TYPE audit_action ADD VALUE 'project.update';
