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
// Total: 73 values.
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
  // #255 — deliverable-persist row (in-tx with workflow_runs insert). Distinct from
  // cer_created (run initiation) for unambiguous 21 CFR Part 11 provenance.
  | 'cer_persisted'
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
  // SPEC-REGULA-CLASSIFY-001 — report export audit action via 0067_classify.sql:
  | 'classification_exported'
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
  | 'knowledge_gap_resolved'
  // SPEC-REGULA-TRACEABILITY-001 (Issue #47, REQ-TRACEABILITY-010).
  // Four edge lifecycle actions for the local evidence graph layer.
  // #240: +1 matrix_viewed (0075) — distinct read audit for the evidence matrix.
  | 'traceability.edge_created'
  | 'traceability.edge_deleted'
  | 'traceability.packet_exported'
  | 'traceability.stale_propagated'
  | 'traceability.matrix_viewed'
  // SPEC-REGULA-PMS-001 (Issue #53, REQ-PMS-010). EU MDR Article 83-86
  // PMS/PMCF state-transition audit trail (21 CFR Part 11).
  | 'pms.report_created'
  | 'pms.compliance_checked'
  | 'pms.report_exported'
  | 'pms.report_export_denied'
  | 'pms.report_closed'
  | 'pms.input_uploaded'
  | 'pmcf.plan_created'
  | 'pmcf.evaluation_drafted'
  | 'pms.cer_linked'
  // SPEC-REGULA-CHANGE-CONTROL-001 (Issue #54, REQ-CHANGE-CONTROL-012).
  // 6 change-control lifecycle audit actions for 21 CFR Part 11 traceability.
  //   change.assessment_created         — new assessment record inserted
  //   change.verdict_produced           — per-jurisdiction verdict generated
  //   change.verdict_citation_rejected  — verdict blocked by REQ-006 citation enforcement
  //   change.assessment_reviewed        — expert review gate: provisional → reviewed (REQ-009)
  //   change.report_exported            — PDF report exported (only reviewed/final)
  //   change.export_blocked             — provisional export denied (REQ-009/011 gate, H-4)
  | 'change.assessment_created'
  | 'change.verdict_produced'
  | 'change.verdict_citation_rejected'
  | 'change.assessment_reviewed'
  | 'change.report_exported'
  | 'change.export_blocked'
  // SPEC-REGULA-LABELING-001 (Issue #66, REQ-LABEL-010):
  // 6 labeling lifecycle audit actions for 21 CFR Part 11 traceability.
  //   label.document_created            — new labeling document inserted (REQ-001)
  //   label.claim_validated             — claim passed citation validation (REQ-003)
  //   label.claim_citation_rejected     — claim blocked: no grounded citation → expert-review (REQ-004)
  //   label.translation_diff_detected   — semantic diff detected in translation (REQ-007)
  //   label.approved                    — RA-lead approved labeling document (REQ-012)
  //   label.export_blocked              — export denied: unsupported claims exist (REQ-006)
  | 'label.document_created'
  | 'label.claim_validated'
  | 'label.claim_citation_rejected'
  | 'label.translation_diff_detected'
  | 'label.approved'
  | 'label.export_blocked'
  // SPEC-REGULA-CAPA-001 (Issue #68, REQ-CAPA-010). 7 complaint/CAPA lifecycle
  // audit actions for 21 CFR Part 11 traceability. Mirror the schema enum.
  //   complaint.intake_created             — new structured complaint inserted (REQ-001)
  //   complaint.reportability_assessed     — reportability decision + vigilance link (REQ-002)
  //   capa.record_created                  — corrective/preventive record inserted (REQ-004/005)
  //   capa.root_cause_documented           — RCA (5 Whys / Fishbone) saved (REQ-003)
  //   capa.effectiveness_scheduled         — effectiveness check scheduled (REQ-006)
  //   capa.closed                          — CAPA closed with ESIG (REQ-010)
  //   capa.close_blocked_vigilance_missing — close denied: reportable + no vigilance_ref (REQ-011)
  | 'complaint.intake_created'
  | 'complaint.reportability_assessed'
  | 'capa.record_created'
  | 'capa.root_cause_documented'
  | 'capa.effectiveness_scheduled'
  | 'capa.closed'
  | 'capa.close_blocked_vigilance_missing'
  // SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-010).
  // 8 clinical-investigation lifecycle audit actions for 21 CFR Part 11 traceability.
  // Mirror the schema enum. ci.close_blocked_signoff_missing records the expert-signoff
  // close-gate denial (REQ-012), mirroring capa.close_blocked_vigilance_missing.
  //   ci.assessed                       — gap-based necessity assessment produced (REQ-001)
  //   ci.pathway_determined             — FDA IDE / EU MDR pathway decision (REQ-002/003)
  //   ci.protocol_updated               — synopsis/endpoint/criteria saved (REQ-005)
  //   ci.irb_package_drafted            — IRB/EC submission package draft (REQ-004)
  //   ci.event_recorded                 — milestone/deviation/AE tracked (REQ-008)
  //   ci.results_linked                 — results linked to CER/PMS/DHF (REQ-009)
  //   ci.closed                         — investigation closed with expert signoff (REQ-012)
  //   ci.close_blocked_signoff_missing  — close denied: no expert signoff (REQ-012 gate)
  | 'ci.assessed'
  | 'ci.pathway_determined'
  | 'ci.protocol_updated'
  | 'ci.irb_package_drafted'
  | 'ci.event_recorded'
  | 'ci.results_linked'
  | 'ci.closed'
  | 'ci.close_blocked_signoff_missing'
  // SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-007/012/014):
  // 8 model-governance lifecycle audit actions for 21 CFR Part 11 traceability
  // of LLM/prompt/template changes. Added via 0077_model_governance.sql.
  //   modelgov.prompt_registered   — immutable prompt/template version registered (REQ-001)
  //   modelgov.change_requested    — change request submitted + eval triggered (REQ-004)
  //   modelgov.eval_passed         — promptfoo eval threshold met (REQ-010)
  //   modelgov.eval_failed         — promptfoo eval threshold missed (REQ-011)
  //   modelgov.approved            — combination approved by expert (REQ-012)
  //   modelgov.rejected            — combination rejected (REQ-014)
  //   modelgov.rolled_back         — active combination reverted (REQ-006)
  //   modelgov.runtime_blocked     — unapproved combination blocked at runtime (REQ-008)
  | 'modelgov.prompt_registered'
  | 'modelgov.change_requested'
  | 'modelgov.eval_passed'
  | 'modelgov.eval_failed'
  | 'modelgov.approved'
  | 'modelgov.rejected'
  | 'modelgov.rolled_back'
  | 'modelgov.runtime_blocked'
  // SPEC-REGULA-CYBERDEVICE-001 (Issue 67) — 9 cybersecurity lifecycle audit actions
  // for 21 CFR Part 11 traceability of medical-device cybersecurity evidence.
  // Added via 0078_cyberdevice.sql. Mirror the auditActionEnum in lib/db/schema.ts.
  //   cyber.threat_modeled       — threat model generated from architecture input (REQ-001)
  //   cyber.sbom_imported        — SBOM ingested (REQ-003)
  //   cyber.sbom_validated       — SBOM format validation result recorded (REQ-003)
  //   cyber.sbom_diffed          — two SBOM versions diffed (REQ-004)
  //   cyber.cve_analyzed         — CVE/KEV impact analysis performed (REQ-005/006)
  //   cyber.update_plan_created  — secure update / patch / EOS plan generated (REQ-007)
  //   cyber.evidence_bundled     — cybersecurity evidence bundle assembled (REQ-009/012/014)
  //   cyber.risk_linked          — residual cyber risk linked to ISO 14971 risk item (REQ-010)
  //   cyber.access_denied        — entitlement-less access blocked (REQ-013)
  // SPEC-REGULA-CYBERDEVICE-001 (Issue 67, H-2 fix) — added via
  // 0079_cyberdevice_linkage_hardening.sql (1 action):
  //   cyber.reassess_triggered   — REQ-011 CVE/KEV change-control re-eval signal (durable audit)
  | 'cyber.threat_modeled'
  | 'cyber.sbom_imported'
  | 'cyber.sbom_validated'
  | 'cyber.sbom_diffed'
  | 'cyber.cve_analyzed'
  | 'cyber.update_plan_created'
  | 'cyber.evidence_bundled'
  | 'cyber.risk_linked'
  | 'cyber.access_denied'
  | 'cyber.reassess_triggered'
  // SPEC-REGULA-CORPUS-LICENSE-001 (Issue 72) — 9 corpus-license lifecycle audit
  // actions for 21 CFR Part 11 traceability of license/entitlement state.
  // Added via 0080_corpus_license.sql. Mirror the auditActionEnum in lib/db/schema.ts.
  //   corpus.license_set            — license metadata created or updated (REQ-001/010)
  //   corpus.ingestion_blocked      — ingestion gate blocked unlicensed source (REQ-002/003)
  //   corpus.full_text_blocked      — paid full-text blocked without entitlement (REQ-004)
  //   corpus.entitlement_granted    — entitlement granted for a source (REQ-001/008)
  //   corpus.entitlement_revoked    — entitlement revoked, source search-excluded (REQ-008)
  //   corpus.export_blocked         — export blocked for unentitled source (REQ-011)
  //   corpus.access_denied          — cross-org or unauthorized access blocked (REQ-012)
  //   corpus.expiry_warned          — admin warned of upcoming license expiry (REQ-014)
  //   corpus.abstract_only_enforced — abstract-only policy enforced, full-text blocked (REQ-013)
  | 'corpus.license_set'
  | 'corpus.ingestion_blocked'
  | 'corpus.full_text_blocked'
  | 'corpus.entitlement_granted'
  | 'corpus.entitlement_revoked'
  | 'corpus.export_blocked'
  | 'corpus.access_denied'
  | 'corpus.expiry_warned'
  | 'corpus.abstract_only_enforced'
  // SPEC-REGULA-SOURCE-GOVERNANCE-001 — added via 0081_source_governance.sql
  // (Issue 48, REQ-SOURCE-GOV-015): 8 source-governance lifecycle audit actions.
  //   source.approved              — RA owner approved a pending_review source (REQ-015)
  //   source.rejected              — RA owner rejected a pending_review source (REQ-015)
  //   source.review_due            — periodic review cycle due notification (REQ-011/013)
  //   source.superseded            — source marked superseded_by another (REQ-005)
  //   source.stale_blocked         — stale citation blocked at draft/export (REQ-007)
  //   source.low_authority_flagged — low-authority-only retrieval flagged expert review (REQ-008)
  //   source.governance_updated    — governance fields updated (authority/jurisdiction/dates)
  //   source.delta_sync_updated    — #45 delta-sync refreshed governance state (REQ-016)
  | 'source.approved'
  | 'source.rejected'
  | 'source.review_due'
  | 'source.superseded'
  | 'source.stale_blocked'
  | 'source.low_authority_flagged'
  | 'source.governance_updated'
  | 'source.delta_sync_updated'
  // SPEC-REGULA-RLHF-001 — added via 0082_rlhf.sql (Issue #56, REQ-RLHF-013).
  // feedback_submitted: every feedback write (21 CFR Part 11 audit-material).
  //   The revision-vs-new distinction is carried in meta_json.revised (L-2),
  //   not a separate enum value, to avoid churning the enum count.
  // reranking_proposed: retrieval re-rank recorded as a PENDING change_request
  //   (REQ-RLHF-013) — renamed from reranking_applied (H-2 fix) because the
  //   change is never auto-applied and waits for eval + approval. The old name
  //   mis-stated the operational state to regulators.
  // reranking_rolled_back: re-ranking revert.
  | 'feedback_submitted'
  | 'reranking_proposed'
  | 'reranking_rolled_back'
  // SPEC-REGULA-KNOWLEDGE-PROMO-001 — added via 0086_knowledge_promo.sql
  // (Issue #50, REQ-KNOWLEDGE-PROMO-013/014). Promotion / unpromotion is a
  // 21 CFR Part 11 audit-material record (who promoted what when).
  | 'answer_promoted'
  | 'answer_unpromoted'
  // SPEC-REGULA-PROJECT-MEMORY-001 — added via 0087_project_memory.sql
  // (Issue #51, REQ-007/008/009). Memory lifecycle is 21 CFR Part 11
  // audit-material (who decided what when, for design-control consistency).
  //   memory_created     — explicit RA-lead create OR pending->active approval (REQ-014)
  //   memory_updated     — same-key supersession (REQ-012 invalidate+create in one tx)
  //   memory_invalidated — soft-delete (valid_until + status), hard delete forbidden
  | 'memory_created'
  | 'memory_updated'
  | 'memory_invalidated'
  // SPEC-REGULA-STANDARDS-001 — added via 0088_standards.sql (Issue #62).
  // Standards lifecycle is 21 CFR Part 11 audit-material (ISO 13485 design-input).
  // Charter [지양-2] citation provenance — every applicable-standard result
  // carries a catalog row reference. The mapping.generated audit row records
  // WHO received WHICH applicable standards list, and WHEN.
  //   standards.mapping.generated    — mapping engine produced an applicable list
  //   standards.recognition.checked  — FDA recognition real-time check (or degraded)
  //   standards.revision.detected    — revision detector noticed a new revision
  //   standards.alert.emitted         — transition milestone alert (D-12/D-6/D-3)
  | 'standards.mapping.generated'
  | 'standards.recognition.checked'
  | 'standards.revision.detected'
  | 'standards.alert.emitted'
  // Issue #157 — owning-project issue routing (cross-repo GitHub issue automation).
  //   owning_issue_created          — owning issue opened in target repo (ra-project/MD-process/gitea-wiki/hybrid-ra-saas)
  //   owning_issue_creation_failed  — retry exhausted, degraded to queue, capture not aborted
  | 'owning_issue_created'
  | 'owning_issue_creation_failed';

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
 * Minimal transaction-handle type compatible with both the db singleton and a
 * tx-scoped clone. Uses the structural `insert` signature so both the db and a
 * Drizzle PgTransaction satisfy this without a hard import of the tx type.
 */
export type AuditDbHandle = {
  insert: (typeof db)['insert'];
};

/**
 * Insert an immutable audit row. Failures propagate to the caller — the
 * regulated workflow MUST fail closed if the audit write fails. Do NOT
 * swallow this error.
 *
 * H2 fix (21 CFR Part 11 atomicity): accepts an optional `tx` transaction
 * handle so the audit insert rides the same transaction boundary as the
 * mutation it records. Callers that wrap mutation + audit in `db.transaction`
 * pass the `tx` here so a transient failure between the two rolls back both.
 * Omitting `tx` uses the singleton `db` (autocommit) — the historical path.
 */
export async function writeAudit(params: AuditEvent, tx?: AuditDbHandle): Promise<void> {
  const client = tx ?? db;
  await client.insert(auditLogs).values({
    actorId: params.actor_id,
    action: params.action,
    resourceType: params.resource_type,
    resourceId: params.resource_id,
    conversationId: params.conversation_id ?? null,
    metaJson: params.meta_json ?? {},
  });
}
