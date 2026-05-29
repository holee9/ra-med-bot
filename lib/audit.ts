// @MX:ANCHOR Audit log writer — single entry point for all 21 CFR Part 11 events.
// @MX:REASON Every regulated action (consult, source access, expert flag) flows
// through this function. fan_in will reach 3+ in Phase 2 (RAG handler) and
// Phase 5 (auth callbacks). Any new audit action MUST go through here so
// the static-analysis sweep in regula-compliance-qa stays effective.
// @MX:SPEC SPEC-REGULA-FOUNDATION-001 (REQ-FND-048, REQ-FND-049, REQ-FND-049a)
//
// 7-year retention policy (21 CFR Part 11)
// NOTE: writeAudit() is defined here but NOT called in Phase 1 code.
// Phase 2: wire llm.call, source.access (RAG handler).
// Phase 5: wire auth.login, auth.logout, expert_review.* (auth callbacks).

import { db } from './db/client';
import { auditLogs } from './db/schema';

// Phase 1 + Breadth (SPEC-REGULA-BREADTH-001) + Enterprise (SPEC-REGULA-ENTERPRISE-001)
// audit_action values.
// Extending this union requires:
//   1. ALTER TYPE audit_action ADD VALUE ... (new migration)
//   2. Update lib/db/schema.ts auditActionEnum
//   3. Update this type
// Keep them in lock-step or the runtime insert will fail.
//
// Phase 1 original values (3):
//   llm.call, source.access, expert_review.flag
//
// Phase 3 / Breadth values added via 0003_breadth_audit_actions.sql (10):
//   conversations.list, conversation.view, conversation.delete, message.feedback,
//   template.list, template.download, updates.list, dashboard.view,
//   projects.list, project.create, project.update
//
// Phase 5 Enterprise values added via 0005_enterprise_audit_actions.sql (12):
//   auth.login, auth.logout, session.invalidate,
//   expert_review.create, expert_review.assign, expert_review.resolve,
//   rbac.permission_deny, profile.theme_update, profile.locale_update,
//   checklist.toggle, consult.expert_review_auto_flag, project.switch
// NOTE: auth.mfa_fail is NOT included (removed in v0.3.0 H-5).
//
// Phase 9 Workflow values added via 0013_workflow_audit_actions.sql (10):
//   workflow.start, workflow.step.complete, workflow.step.fail,
//   workflow.pause, workflow.resume, workflow.pending_review,
//   workflow.approve, workflow.reject, workflow.download, workflow.edit
// Total: 37 values.
//
// Phase 8 DocIngest values added via 0016_docingest_audit_actions.sql (6):
//   document.upload, document.access, document.redact,
//   document.chunk, document.search, redaction_map.access
// Total: 46 values.
export type AuditAction =
  | 'llm.call'
  | 'source.access'
  | 'expert_review.flag'
  | 'conversations.list'
  | 'conversation.view'
  | 'conversation.delete'
  | 'message.feedback'
  | 'template.list'
  | 'template.download'
  | 'updates.list'
  | 'dashboard.view'
  | 'projects.list'
  | 'project.create'
  | 'project.update'
  | 'auth.login'
  | 'auth.logout'
  | 'session.invalidate'
  | 'expert_review.create'
  | 'expert_review.assign'
  | 'expert_review.resolve'
  | 'rbac.permission_deny'
  | 'profile.theme_update'
  | 'profile.locale_update'
  | 'checklist.toggle'
  | 'consult.expert_review_auto_flag'
  | 'project.switch'
  | 'profile.update'
  | 'workflow.start'
  | 'workflow.step.complete'
  | 'workflow.step.fail'
  | 'workflow.pause'
  | 'workflow.resume'
  | 'workflow.pending_review'
  | 'workflow.approve'
  | 'workflow.reject'
  | 'workflow.download'
  | 'workflow.edit'
  // Phase 8 DocIngest actions (REQ-DOC-8A-7)
  | 'document.upload'
  | 'document.access'
  | 'document.redact'
  | 'document.chunk'
  | 'document.search'
  | 'redaction_map.access'
  // Phase 10 Radar actions added via 0018_radar.sql (3):
  | 'radar.crawler_run'
  | 'radar.notification'
  | 'radar.search'
  // E2E test mode audit action — added via 0026_chat_query_audit_action.sql:
  | 'chat.query';

export interface AuditEvent {
  /** User UUID, or null for system-initiated events. */
  actor_id: string | null;
  action: AuditAction;
  /** e.g. 'message', 'source', 'conversation'. */
  resource_type: string;
  /** Free-form ID — UUID for DB rows, opaque string for external resources. */
  resource_id: string;
  /** Optional FK so audit-trail queries can join by conversation. */
  conversation_id?: string | null;
  /**
   * Non-PII context only. PII rule: never include question text, answer text,
   * email, phone, or any free-form prose. Use `messageId` to indirect-reference.
   */
  meta_json?: Record<string, unknown>;
}

/**
 * Insert an immutable audit row. Failures propagate to the caller — the
 * regulated workflow MUST fail closed if the audit write fails. Do NOT
 * swallow this error.
 */
export async function writeAudit(params: AuditEvent): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: params.actor_id,
    action: params.action,
    resourceType: params.resource_type,
    resourceId: params.resource_id,
    conversationId: params.conversation_id ?? null,
    metaJson: params.meta_json ?? {},
  });
}
