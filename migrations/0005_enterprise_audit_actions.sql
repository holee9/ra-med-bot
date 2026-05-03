-- @MX:NOTE [AUTO] Phase 5 Enterprise Hardening — audit_action enum extension.
-- @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-028)
--
-- Adds 12 new audit_action enum values for Phase 5 features.
-- PostgreSQL requires a separate ALTER TYPE ... ADD VALUE statement per value.
-- Each uses IF NOT EXISTS for idempotency (safe to re-run).
--
-- Existing values after 0003_breadth_audit_actions.sql (13 total):
--   llm.call, source.access, expert_review.flag (Phase 1: 3)
--   conversations.list, conversation.view, message.feedback,
--   template.list, template.download, updates.list, dashboard.view,
--   projects.list, project.create, project.update (Phase 3/Breadth: 10)
--
-- New values added here (Phase 5: 12):
-- NOTE: auth.mfa_fail is NOT included (removed in v0.3.0 H-5).
--
-- Total after this migration: 25 values.

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'auth.login';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'auth.logout';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'session.invalidate';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'expert_review.create';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'expert_review.assign';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'expert_review.resolve';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'rbac.permission_deny';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'profile.theme_update';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'profile.locale_update';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'checklist.toggle';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'consult.expert_review_auto_flag';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'project.switch';
