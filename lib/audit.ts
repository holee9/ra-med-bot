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
//
// Phase 10 Radar (3) via 0018, chat.query (1) via 0026, answer.refine (1) via 0027.
//
// SPEC-REGULA-PREDICATE-001 values added via 0031_predicate_audit_actions.sql (2):
//   predicate_search, predicate_comparison_generated
// SPEC-REGULA-IMPACT-001 values added via 0034_impact_audit_actions.sql (3):
//   impact.assessment_created, impact.critical_detected, impact.action_item_created
// SPEC-REGULA-PCCP-001 values added via 0040_pccp_audit_actions.sql (5):
//   pccp_created, pccp_component_completed, pccp_expert_approved,
//   pccp_algorithm_change_triggered, pccp_status_changed
// SPEC-REGULA-DHF-001 values added via 0055_design_history_files.sql (4):
//   dhf_created, dhf_updated, dhf_design_freeze, dhf_review_approved
// Total: 68 values.
//
// SPEC-REGULA-DELTA-SYNC-001 values added via 0065_delta_sync.sql (3):
//   corpus.sync_started, corpus.sync_completed, corpus.sync_failed
// Total: 71 values.
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
  | 'chat.query'
  // Wave 5 Answer Refine — added via 0027_answer_refine_audit_action.sql:
  | 'answer.refine'
  // Predicate Comparison — added via 0031_predicate_audit_actions.sql (REQ-PRE-017):
  | 'predicate_search'
  | 'predicate_comparison_generated'
  // Predicate export (PDF/DOCX) — REQ-PRE-015, audited for traceability:
  | 'predicate_comparison_exported'
  // CER-001 audit actions — added via 0037_cer_audit_actions.sql (REQ-CER-036~040):
  | 'cer_created'
  | 'cer_stage_completed'
  | 'cer_expert_approved'
  | 'cer_exported'
  | 'cer_literature_search'
  // SPEC-REGULA-IMPACT-001 — impact analysis events via 0034_impact_audit_actions.sql:
  | 'impact.assessment_created'
  | 'impact.critical_detected'
  | 'impact.action_item_created'
  // SPEC-REGULA-PCCP-001 — PCCP audit actions via 0040_pccp_audit_actions.sql (REQ-PCCP-021~023, 015, 024):
  | 'pccp_created'
  | 'pccp_component_completed'
  | 'pccp_expert_approved'
  | 'pccp_algorithm_change_triggered'
  | 'pccp_status_changed'
  // SPEC-REGULA-VIGILANCE-001 — adverse event report audit actions via 0042_vigilance_audit_actions.sql:
  | 'vigilance_event_created'
  | 'vigilance_reportability_assessed'
  | 'vigilance_report_drafted'
  | 'vigilance_report_exported'
  // SPEC-REGULA-STANDARDS-001 — standards tracker audit actions via 0048_standards_applicability.sql:
  | 'standards_searched'
  | 'standards_gap_analyzed'
  | 'standards_compliance_updated'
  // SPEC-REGULA-CLASSIFY-001 — classification audit actions via 0051_classification_audit_actions.sql:
  | 'device_classified'
  // SPEC-REGULA-DIGEST-001 — digest audit actions via 0053_digest_audit_actions.sql:
  | 'digest_generated'
  | 'digest_emailed'
  // SPEC-REGULA-SAMD-001 — SaMD pathway builder audit actions via 0054_samd_assessments.sql:
  | 'samd_assessment_created'
  | 'samd_assessment_updated'
  | 'samd_review_approved'
  // SPEC-REGULA-DHF-001 — Design History File audit actions via 0055_design_history_files.sql (4):
  | 'dhf_created'
  | 'dhf_updated'
  | 'dhf_design_freeze'
  | 'dhf_review_approved'
  // SPEC-REGULA-ESUBMIT-001 audit actions — added via 0056_submission_packages.sql:
  | 'submission_package_created'
  | 'submission_package_submitted'
  | 'submission_validation_completed'
  // SPEC-REGULA-RISK-001 — risk management audit actions (REQ-RISK-028~038):
  | 'risk.hazard_identified'
  | 'risk.matrix_evaluated'
  | 'risk.item_deleted'
  | 'risk.control_adopted'
  | 'risk.residual_accepted'
  | 'risk.gspr_mapped'
  | 'risk.report_approved'
  // SPEC-REGULA-EXPORT-HUB-001 — export audit actions via 0060_export_audit_actions.sql (REQ-EXP-006):
  | 'export.markdown'
  | 'export.docx'
  | 'export.pdf'
  | 'export.email'
  | 'export.confluence'
  // SPEC-REGULA-ESIG-001 — electronic signature events via 0061_answer_signatures.sql:
  | 'signature.applied'
  | 'signature.revoked'
  // SPEC-REGULA-AUDITOR-VIEW-001 — external auditor read-only persona events:
  //   audit.access          — auditor viewed audit log / signed answer / compliance report
  //   audit.denied          — auditor attempted a write operation (403)
  //   audit.package.generated — auditor generated a 1-click audit package ZIP
  | 'audit.access'
  | 'audit.denied'
  | 'audit.package.generated'
  // SPEC-REGULA-PERSONAL-LIB-001 — personal library bookmark events (Issue #86):
  //   personal_bookmark.created — user bookmarked a message/answer block
  //   personal_bookmark.deleted — user removed a personal bookmark
  | 'personal_bookmark.created'
  | 'personal_bookmark.deleted'
  // SPEC-REGULA-CALENDAR-001 — regulatory deadline events (Issue #44):
  //   deadline.created — ra-lead created a regulatory deadline
  //   deadline.updated — deadline fields (status, due date, notes) changed
  //   deadline.deleted — deadline removed
  | 'deadline.created'
  | 'deadline.updated'
  | 'deadline.deleted'
  // SPEC-REGULA-DELTA-SYNC-001 — corpus delta-sync events (Issue #45):
  //   corpus.sync_started   — delta-sync run began (new/changed document detected)
  //   corpus.sync_completed — chunk embedding + vector store upsert finished
  //   corpus.sync_failed    — sync failed after max retries
  | 'corpus.sync_started'
  | 'corpus.sync_completed'
  | 'corpus.sync_failed'
  // SPEC-REGULA-KNOWLEDGE-GAP-001 — knowledge gap lifecycle (Issue #35, REQ-KNOWLEDGE-GAP-016):
  //   knowledge_gap_created     — detector captured an unanswered question into unanswered_queue
  //   knowledge_gap_classified  — RA-lead assigned a gap_classification category
  //   knowledge_gap_digest_sent — daily digest delivery attempted (success or failure)
  //   knowledge_gap_resolved    — closed-loop replay passed, queue item closed
  | 'knowledge_gap_created'
  | 'knowledge_gap_classified'
  | 'knowledge_gap_digest_sent'
  | 'knowledge_gap_resolved';

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
