// @MX:ANCHOR Drizzle ORM schema — single source of truth for the Regula data model.
// @MX:REASON 16 tables and 11 pgEnums are referenced by every Route Handler,
// every migration, and every QA static analysis pass. fan_in is well above 3.
// @MX:SPEC SPEC-REGULA-FOUNDATION-001 (REQ-FND-031..044b),
//          SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-016, 027, 028),
//          SPEC-REGULA-WORKFLOWS-001 (REQ-WF-049, REQ-WF-051)
//
// Table inventory (18):
//   users, organizations, projects, conversations, messages, message_sources,
//   message_blocks, sources, source_sections, templates, regulatory_updates,
//   expert_reviews, audit_logs, org_members, project_members, workflow_runs,
//   regulatory_impact_assessments, impact_action_items
//
// pgEnum inventory (11):
//   locale, theme_pref, message_role, confidence_level, block_type,
//   source_type, expert_review_status, audit_action, user_role,
//   workflow_type, workflow_status
//
// Vector type: pgvector(1536) is exposed via customType because drizzle-orm
// does not yet ship a native vector helper. See migrations/0000_init.sql for
// the matching `CREATE EXTENSION vector;` statement.

import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// pgvector custom type — backs sources.embedding and source_sections.embedding.
// Drizzle Kit 0.20 quotes custom type names containing parentheses during
// `push:pg`, so migrations keep the production `vector(1536)` dimension while
// schema-push based local test DBs use the extension's generic `vector` type.
// ---------------------------------------------------------------------------
const vector = customType<{ data: number[] | null; driverData: string | null }>({
  dataType() {
    return 'vector';
  },
  toDriver(value: number[] | null): string | null {
    if (value === null) return null;
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string | null): number[] | null {
    if (value === null) return null;
    return value.slice(1, -1).split(',').map(Number);
  },
});

// ---------------------------------------------------------------------------
// pgEnums (9) — declared in dependency order so the generated SQL is valid.
// ---------------------------------------------------------------------------
export const localeEnum = pgEnum('locale', ['ko', 'en']);
export const themePrefEnum = pgEnum('theme_pref', ['light', 'dark', 'system']);
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system']);
export const confidenceLevelEnum = pgEnum('confidence_level', ['high', 'med', 'low']);
export const blockTypeEnum = pgEnum('block_type', [
  'prose',
  'checklist',
  'comparison',
  'timeline',
  'sources',
  'related',
  'workflow_result',
]);
export const sourceTypeEnum = pgEnum('source_type', [
  'Regulation',
  'Guidance',
  'Standard',
  'Industry',
  'Internal',
]);
export const expertReviewStatusEnum = pgEnum('expert_review_status', [
  'pending',
  'in_progress',
  'resolved',
]);

// REQ-ENTERPRISE-016: user_role pgEnum replaces TEXT role column on users table.
// Migration: 0004_user_role_enum.sql (creates type, migrates 'member' → 'ra-member').
// SPEC-REGULA-ESIG-001: 'qa-lead' added via 0061_answer_signatures.sql (REQ-ESIG-006).
// SPEC-REGULA-AUDITOR-VIEW-001: 'auditor' added via 0062_auditor_view_enums.sql.
export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'qa-lead',
  'ra-lead',
  'ra-member',
  'viewer',
  'auditor',
]);
export const userStatusEnum = pgEnum('user_status', ['pending', 'active', 'disabled']);
// REQ-TENANT-001: department pgEnum for secondary RBAC axis (SPEC-REGULA-TENANT-001 Tenant-Lite).
export const userDepartmentEnum = pgEnum('user_department', ['RA', 'Dev', 'Exec', 'External']);

// @MX:NOTE audit_action values mirror AuditAction type in lib/audit.ts.
// Phase 1: 3 values. Phase 3 / Breadth: +10 via 0003_breadth_audit_actions.sql.
// Phase 5 Enterprise: +12 via 0005_enterprise_audit_actions.sql.
// Phase 9 Workflows: +10 via 0013_workflow_audit_actions.sql.
// Phase 8 DocIngest: +6 via 0016_docingest_audit_actions.sql.
// Phase 10 Radar: +3 via 0018_radar.sql. chat.query: +1. answer.refine: +1. Total: 48.
// CER-001: +5 via 0037_cer_audit_actions.sql. Total: 53. (REQ-CER-036~040)
// #255: +1 cer_persisted via 0074_cer_persisted_audit_action.sql (CER deliverable
//        persist, REQ-CER-036 provenance split — separates initiation from persist).
// VIGILANCE-001: +4 via 0042_vigilance_audit_actions.sql. Total: 57.
// NOTE: auth.mfa_fail is NOT included (removed in v0.3.0 H-5).
export const auditActionEnum = pgEnum('audit_action', [
  'llm.call',
  'source.access',
  'expert_review.flag',
  'conversations.list',
  'conversation.view',
  'conversation.delete',
  'message.feedback',
  'template.list',
  'template.download',
  'updates.list',
  'dashboard.view',
  'projects.list',
  'project.create',
  'project.update',
  'auth.login',
  'auth.logout',
  'session.invalidate',
  'expert_review.create',
  'expert_review.assign',
  'expert_review.resolve',
  'rbac.permission_deny',
  'profile.theme_update',
  'profile.locale_update',
  'checklist.toggle',
  'consult.expert_review_auto_flag',
  'project.switch',
  'profile.update',
  'workflow.start',
  'workflow.step.complete',
  'workflow.step.fail',
  'workflow.pause',
  'workflow.resume',
  'workflow.pending_review',
  'workflow.approve',
  'workflow.reject',
  'workflow.download',
  'workflow.edit',
  'document.upload',
  'document.access',
  'document.redact',
  'document.chunk',
  'document.search',
  'redaction_map.access',
  // Phase 10 Radar values added via 0018_radar.sql (3):
  'radar.crawler_run',
  'radar.notification',
  'radar.search',
  // E2E test mode audit action — added via 0026_chat_query_audit_action.sql:
  'chat.query',
  // Wave 5 Answer Refine — added via 0027_answer_refine_audit_action.sql:
  'answer.refine',
  // SPEC-REGULA-PREDICATE-001 — added via 0031_predicate_audit_actions.sql (REQ-PRE-017):
  'predicate_search',
  'predicate_comparison_generated',
  // Predicate export (PDF/DOCX) — added via 0032_predicate_export_audit_action.sql (REQ-PRE-015):
  'predicate_comparison_exported',
  // CER-001 audit actions — added via 0037_cer_audit_actions.sql (REQ-CER-036~040):
  'cer_created',
  'cer_stage_completed',
  'cer_expert_approved',
  'cer_exported',
  'cer_literature_search',
  // #255 — added via 0074_cer_persisted_audit_action.sql: deliverable-persist row,
  // atomic with workflow_runs insert (distinct from cer_created = run initiated).
  'cer_persisted',
  // SPEC-REGULA-IMPACT-001 — added via 0034_impact_audit_actions.sql (3):
  'impact.assessment_created',
  'impact.critical_detected',
  'impact.action_item_created',
  // SPEC-V3-IMPACT-001 — added via 0110_audit_impact_actions.sql (wizard actions):
  'impact.check',
  'impact.ticket.create',
  'impact.view',
  // SPEC-REGULA-PCCP-001 — added via 0040_pccp_audit_actions.sql (REQ-PCCP-021~023, 015, 024):
  'pccp_created',
  'pccp_component_completed',
  'pccp_expert_approved',
  'pccp_algorithm_change_triggered',
  'pccp_status_changed',
  // SPEC-REGULA-VIGILANCE-001 — added via 0042_vigilance_audit_actions.sql:
  'vigilance_event_created',
  'vigilance_reportability_assessed',
  'vigilance_report_drafted',
  'vigilance_report_exported',
  // SPEC-REGULA-STANDARDS-001 — added via 0048_standards_applicability.sql:
  'standards_searched',
  'standards_gap_analyzed',
  'standards_compliance_updated',
  // SPEC-REGULA-CLASSIFY-001 — added via 0051_classification_audit_actions.sql:
  'device_classified',
  // SPEC-REGULA-CLASSIFY-001 — added via 0067_classify.sql (report export, REQ-CLASSIFY-017):
  'classification_exported',
  // SPEC-REGULA-DIGEST-001 — added via 0053_digest_audit_actions.sql:
  'digest_generated',
  'digest_emailed',
  // SPEC-REGULA-SAMD-001 — added via 0054_samd_assessments.sql (3):
  'samd_assessment_created',
  'samd_assessment_updated',
  'samd_review_approved',
  // SPEC-REGULA-DHF-001 — added via 0055_design_history_files.sql (4):
  'dhf_created',
  'dhf_updated',
  'dhf_design_freeze',
  'dhf_review_approved',
  // SPEC-REGULA-ESUBMIT-001 — added via 0056_submission_packages.sql (3):
  'submission_package_created',
  'submission_package_submitted',
  'submission_validation_completed',
  // SPEC-REGULA-RISK-001 — risk management audit actions (7):
  'risk.hazard_identified',
  'risk.matrix_evaluated',
  'risk.item_deleted',
  'risk.control_adopted',
  'risk.residual_accepted',
  'risk.gspr_mapped',
  'risk.report_approved',
  // SPEC-REGULA-EXPORT-HUB-001 — added via 0060_export_audit_actions.sql (REQ-EXP-006):
  'export.markdown',
  'export.docx',
  'export.pdf',
  'export.email',
  'export.confluence',
  // SPEC-REGULA-ESIG-001 — added via 0061_answer_signatures.sql:
  'signature.applied',
  'signature.revoked',
  // SPEC-REGULA-AUDITOR-VIEW-001 — added via 0062_auditor_view_enums.sql:
  'audit.access',
  'audit.denied',
  'audit.package.generated',
  'personal_bookmark.created',
  'personal_bookmark.deleted',
  'deadline.created',
  'deadline.updated',
  'deadline.deleted',
  // SPEC-REGULA-DELTA-SYNC-001 — added via 0065_delta_sync.sql (Issue #45):
  'corpus.sync_started',
  'corpus.sync_completed',
  'corpus.sync_failed',
  // SPEC-REGULA-KNOWLEDGE-GAP-001 — added via 0066_knowledge_gap.sql (Issue #35,
  // REQ-KNOWLEDGE-GAP-016): 4 knowledge-gap lifecycle audit actions.
  'knowledge_gap_created',
  'knowledge_gap_classified',
  'knowledge_gap_digest_sent',
  'knowledge_gap_resolved',
  // SPEC-REGULA-TRACEABILITY-001 — added via 0068_traceability.sql (Issue #47,
  // REQ-TRACEABILITY-010): 4 traceability graph audit actions for the local
  // evidence-graph layer (separate from Issue 169 BFF proxy).
  'traceability.edge_created',
  'traceability.edge_deleted',
  'traceability.packet_exported',
  'traceability.stale_propagated',
  // #240 — added via 0075_traceability_matrix_viewed_audit_action.sql: matrix
  // view read audit (+1), distinct from dashboard.view for 21 CFR Part 11 clarity.
  'traceability.matrix_viewed',
  // #300 (M-2) — added via 0098_traceability_section_superseded.sql: per-section
  // supersession audit, fired inside the supersession tx independent of
  // evidence_node existence (Part 11 traceability gap closure).
  'traceability.section_superseded',
  // SPEC-REGULA-PHI-REMOVAL-001 (Issue #319): pms.*/pmcf.* audit actions
  // removed — PMS/PMCF domain deleted (patient/clinical-subject data).
  // SPEC-REGULA-CHANGE-CONTROL-001 (Issue #54, REQ-CHANGE-CONTROL-012):
  // 6 change-control lifecycle audit actions (21 CFR Part 11). change.export_blocked
  // (H-4) records provisional-export denial, distinct from REQ-006 citation rejection.
  'change.assessment_created',
  'change.verdict_produced',
  'change.verdict_citation_rejected',
  'change.assessment_reviewed',
  'change.report_exported',
  'change.export_blocked',
  // SPEC-REGULA-LABELING-001 (Issue #66, REQ-LABEL-010):
  // 6 labeling lifecycle audit actions (21 CFR Part 11). label.export_blocked
  // records export denial when unsupported claims exist (REQ-LABEL-006).
  'label.document_created',
  'label.claim_validated',
  'label.claim_citation_rejected',
  'label.translation_diff_detected',
  'label.approved',
  'label.export_blocked',
  // SPEC-REGULA-LABELING-001 — added via 0097_label_esubmit_forwarded.sql (REQ-009, AC-07):
  //   label.esubmit_forwarded — approved labeling folded into submission package manifest
  'label.esubmit_forwarded',
  // Issue #307 — knowledge_sources 동기화 (0099_knowledge_sources.sql):
  'knowledge_source.created',
  'knowledge_source.updated',
  'knowledge_source.deleted',
  'knowledge_source.synced',
  // lock-step 보정 (DB에 있으나 schema 누락, #56 RLHF reranking).
  // rlhf.* 는 이미 하단(quality_gap_audit_actions 등)에 정의됨 — 중복 제거.
  'reranking_applied',
  // SPEC-REGULA-CAPA-001 — added via 0073_capa.sql (REQ-CAPA-010):
  // 7 complaint/capa lifecycle audit actions for 21 CFR Part 11 traceability.
  //   complaint.intake_created             — new structured complaint inserted (REQ-001)
  //   complaint.reportability_assessed     — reportability decision stored + vigilance link (REQ-002)
  //   capa.record_created                  — new corrective/preventive record inserted (REQ-004/005)
  //   capa.root_cause_documented           — RCA (5 Whys / Fishbone) saved (REQ-003)
  //   capa.effectiveness_scheduled         — effectiveness check scheduled (REQ-006)
  //   capa.closed                          — CAPA closed with ESIG (REQ-010)
  //   capa.close_blocked_vigilance_missing — close denied: reportable + no vigilance_ref (REQ-011 gate)
  'complaint.intake_created',
  'complaint.reportability_assessed',
  'capa.record_created',
  'capa.root_cause_documented',
  'capa.effectiveness_scheduled',
  'capa.closed',
  'capa.close_blocked_vigilance_missing',
  // SPEC-REGULA-CLINICAL-INVESTIGATION-001 — added via 0076_clinical_investigation.sql
  // (Issue #69, REQ-CLININV-010): 8 clinical-investigation lifecycle audit actions
  // for 21 CFR Part 11 traceability. ci.close_blocked_signoff_missing records the
  // expert-signoff close-gate denial (REQ-012), mirroring capa.close_blocked_*.
  'ci.assessed',
  'ci.pathway_determined',
  'ci.protocol_updated',
  'ci.irb_package_drafted',
  'ci.event_recorded',
  'ci.results_linked',
  'ci.closed',
  'ci.close_blocked_signoff_missing',
  // SPEC-REGULA-MODEL-GOVERNANCE-001 — added via 0077_model_governance.sql
  // (Issue 71, REQ-MODELGOV-007/012/014): 8 model-governance lifecycle audit
  // actions for 21 CFR Part 11 traceability of LLM/prompt/template changes.
  'modelgov.prompt_registered',
  'modelgov.change_requested',
  'modelgov.eval_passed',
  'modelgov.eval_failed',
  'modelgov.approved',
  'modelgov.rejected',
  'modelgov.rolled_back',
  'modelgov.runtime_blocked',
  // SPEC-REGULA-CYBERDEVICE-001 — added via 0078_cyberdevice.sql
  // (Issue 67, REQ-CYBERDEVICE-007/013/014): 9 cybersecurity lifecycle audit
  // actions for 21 CFR Part 11 traceability of medical-device cybersecurity evidence.
  'cyber.threat_modeled',
  'cyber.sbom_imported',
  'cyber.sbom_validated',
  'cyber.sbom_diffed',
  'cyber.cve_analyzed',
  'cyber.update_plan_created',
  'cyber.evidence_bundled',
  'cyber.risk_linked',
  'cyber.access_denied',
  // SPEC-REGULA-CYBERDEVICE-001 (Issue 67, H-2 fix) — added via
  // 0079_cyberdevice_linkage_hardening.sql: REQ-011 durable reassessment signal.
  'cyber.reassess_triggered',
  // SPEC-REGULA-CORPUS-LICENSE-001 — added via 0080_corpus_license.sql
  // (Issue 72, REQ-CORPUSLIC-010/012/014): 9 corpus-license lifecycle audit
  // actions for 21 CFR Part 11 traceability of license/entitlement state.
  'corpus.license_set',
  'corpus.ingestion_blocked',
  'corpus.full_text_blocked',
  'corpus.entitlement_granted',
  'corpus.entitlement_revoked',
  'corpus.export_blocked',
  'corpus.access_denied',
  'corpus.expiry_warned',
  'corpus.abstract_only_enforced',
  // SPEC-REGULA-SOURCE-GOVERNANCE-001 — added via 0081_source_governance.sql
  // (Issue 48, REQ-SOURCE-GOV-015): 8 source-governance lifecycle audit actions
  // for 21 CFR Part 11 traceability of approval/supersession/stale-citation events.
  'source.approved',
  'source.rejected',
  'source.review_due',
  'source.superseded',
  'source.stale_blocked',
  'source.low_authority_flagged',
  'source.governance_updated',
  'source.delta_sync_updated',
  // Issue 313 — orphan sources cleanup cron. Added via 0101_source_orphan_sunset.sql.
  // Fired by the daily orphan-cleanup cron (lib/inngest/knowledge-sources/orphan-cleanup.ts)
  // when a source's approval_status is set to 'sunset' because all its
  // source_sections are superseded. DISTINCT from 'source.superseded' (replaced
  // by a newer source version) and 'source.rejected' (human RA-owner rejection)
  // so regulators can distinguish the three lifecycle events (21 CFR Part 11).
  'source.orphan_sunsetted',
  // SPEC-REGULA-RLHF-001 — added via 0082_rlhf.sql (Issue #56, REQ-RLHF-013).
  // feedback_submitted: every feedback write (21 CFR Part 11 audit-material).
  //   The revision-vs-new distinction is carried in meta_json.revised (L-2),
  //   not a separate enum value, to avoid churning the enum count.
  // reranking_proposed: retrieval re-rank recorded as a PENDING change_request
  //   (REQ-RLHF-013). Renamed from `reranking_applied` (H-2 fix) — the change
  //   is never auto-applied, so the old name mis-stated state to regulators.
  // reranking_rolled_back: re-ranking revert.
  'feedback_submitted',
  'reranking_proposed',
  'reranking_rolled_back',
  // SPEC-REGULA-KNOWLEDGE-PROMO-001 — added via 0086_knowledge_promo.sql
  // (Issue #50, REQ-KNOWLEDGE-PROMO-013/014). Promotion / unpromotion is a
  // 21 CFR Part 11 audit-material record (who promoted what when).
  'answer_promoted',
  'answer_unpromoted',
  // SPEC-REGULA-PROJECT-MEMORY-001 — added via 0087_project_memory.sql
  // (Issue #51, REQ-007/008/009). Memory lifecycle is 21 CFR Part 11
  // audit-material (who decided what when, for design-control consistency).
  //   memory_created    — explicit RA-lead create OR pending->active approval
  //   memory_updated    — same-key supersession (invalidate old + create new, REQ-012)
  //   memory_invalidated — soft-delete (valid_until + status); hard delete forbidden
  'memory_created',
  'memory_updated',
  'memory_invalidated',
  // SPEC-V3-INBOX-001 — added via 0104_inbox_tickets_and_approved_answers.sql (Issue 320).
  // RA Inbox lifecycle audit actions (REQ-V3-INBOX-021).
  //   inbox.created     — new ticket created (employee ask or internal)
  //   inbox.triaged     — triage_state transition (any valid transition)
  //   inbox.assigned     — ra_assignee changed (manual assignment)
  //   inbox.escalated    — escalated to external expert (escalate_to set)
  //   inbox.answered     — final_answer drafted (not yet approved)
  //   inbox.approved     — final_answer ESIG-approved (closed + promoted)
  //   inbox.closed        — ticket closed (without promotion to approved_answers)
  //   inbox.rejected      — ticket rejected (ra-lead/admin action)
  'inbox.created',
  'inbox.triaged',
  'inbox.assigned',
  'inbox.escalated',
  'inbox.answered',
  'inbox.approved',
  'inbox.closed',
  'inbox.rejected',
  'inbox.approve_failed', // H-2 fix: approval failed (ESIG re-auth failure or domain error)
  // SPEC-V3-CONSULT-001 — added via 0107_create_consult_tables.sql (Issue 341):
  // 21 CFR Part 11 §11.10(e) audit material. Power Chat session/turn lifecycle.
  'consult.session.create',
  'consult.turn.create',
  'consult.session.delete',
  // SPEC-V3-CONSULT-001 — added via 0108_consult_turn_failed_audit.sql (REQ-CONS-010):
  // 21 CFR Part 11 debugging audit for timeout/runtime_error turns (AC-CONS-05).
  'consult.turn.failed',
  // SPEC-REGULA-STANDARDS-001 — added via 0088_standards.sql (Issue #62).
  // Standards lifecycle is 21 CFR Part 11 audit-material (design-input records
  // under ISO 13485 / 21 CFR 820.30). Charter [지양-2] citation provenance.
  //   standards.mapping.generated    — mapping engine produced an applicable list
  //   standards.recognition.checked  — FDA recognition real-time check (or degraded)
  //   standards.revision.detected    — revision detector noticed a new revision
  //   standards.alert.emitted         — transition milestone alert (D-12/D-6/D-3)
  'standards.mapping.generated',
  'standards.recognition.checked',
  'standards.revision.detected',
  'standards.alert.emitted',
  // Issue #157 — owning-project issue routing. Two lifecycle actions for the
  // cross-repo issue creation flow (21 CFR Part 11 traceability).
  //   owning_issue_created          — owning issue successfully opened in target repo
  //   owning_issue_creation_failed  — 3x retry exhausted; queue row stays in queued state
  'owning_issue_created',
  'owning_issue_creation_failed',
  // SPEC-REGULA-RLHF-001 — Issue #264 sub-PR 2/3, added via 0095_rlhf_calibration_candidates.sql.
  // rlhf.calibration_proposed: a confidence-calibration candidate was detected
  // and written as status=pending for RA-Lead governance review (REQ-RLHF-005/015,
  // Charter [지양-2]/[지양-4]). Mirrors `reranking_proposed` naming — PENDING
  // proposal, NEVER an applied change.
  'rlhf.calibration_proposed',
  // SPEC-REGULA-RLHF-001 — Issue #264 sub-PR 3/3, added via 0096_rlhf_implicit_feedback.sql.
  // rlhf.implicit_feedback_recorded: a user clicked "Regenerate answer" and the
  // implicit downvote was captured. DISTINCT from feedback_submitted so
  // regulators can separate implicit-regenerate signals from explicit
  // thumbs-up/down submissions in the audit trail (21 CFR Part 11).
  'rlhf.implicit_feedback_recorded',
  // SPEC-V3-AUDIT-CHAIN-001 M0 — added via 0111_audit_chain_infrastructure.sql:
  // emitted by the verify cron (M3) when a chain break is detected (tamper-evidence,
  // 21 CFR Part 11 §11.10(e)). Distinct from rbac.permission_deny so regulators can
  // isolate integrity violations from authorization denials.
  'audit_chain.violation_detected',
]);

// @MX:NOTE [AUTO] Source governance enums — SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48).
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (REQ-SOURCE-GOV-001, REQ-SOURCE-GOV-009)
// @MX:REASON Drizzle pgEnum mirrors the SQL types created in 0081_source_governance.sql.
// Keep in lock-step with the migration or runtime inserts fail.
// authority_grade: 6-tier hierarchy, drives retrieval ranking (REQ-004) + low-auth gating (REQ-008).
// approval_status: pending_review default (REQ-009); gates search eligibility (REQ-004/005).
export const sourceAuthorityGradeEnum = pgEnum('source_authority_grade', [
  'regulator_official',
  'harmonized_standard',
  'internal_sop',
  'prior_submission',
  'public_database',
  'secondary_reference',
]);
export const sourceApprovalStatusEnum = pgEnum('source_approval_status', [
  'pending_review',
  'approved',
  'rejected',
  // Issue 313 — orphan sources cleanup cron. Added via 0101_source_orphan_sunset.sql.
  // 'sunset' is set by the daily cleanup cron when ALL source_sections are superseded.
  // Semantically distinct from 'rejected' (human RA-owner rejection of a pending_review
  // source): 'sunset' is a system-driven lifecycle event. The retrieval gate
  // (retrieval-gate.ts: approvalStatus !== 'approved') permanently excludes sunset
  // sources from RAG search without requiring a retriever logic change.
  'sunset',
]);

// @MX:NOTE [AUTO] RLHF enums — SPEC-REGULA-RLHF-001 (Issue #56).
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-001, REQ-RLHF-002, AC-02)
// @MX:REASON Drizzle pgEnum mirrors the SQL types created in 0082_rlhf.sql.
// Keep in lock-step with the migration or runtime inserts fail.
// feedback_rating: thumb up/down (REQ-RLHF-001).
// quality_tag: 12 values — 8 original (Issue #56) + 4 confidence-breakdown
//              dimensions (Issue #264 follow-up, sub-PR 1/3). Keep in lock-step
//              with migration 0082 (CREATE TYPE) + 0093 (ALTER TYPE ADD VALUE).
export const feedbackRatingEnum = pgEnum('feedback_rating', ['up', 'down']);

// @MX:NOTE [AUTO] feedbackSourceEnum — SPEC-REGULA-RLHF-001 (Issue #264 sub-PR 3/3).
// @MX:REASON Mirrors answer_feedback_source created in 0096_rlhf_implicit_feedback.sql.
//           'explicit' = thumbs up/down (default, back-compat). 'implicit_regenerate'
//           = user clicked "Regenerate answer" — the regeneration IS the implicit
//           downvote. Distinguishes the two channels in aggregation/audit without
//           excluding either (rating='down' flows into the SAME score regardless).
export const feedbackSourceEnum = pgEnum('answer_feedback_source', [
  'explicit',
  'implicit_regenerate',
]);
export const qualityTagEnum = pgEnum('quality_tag', [
  'citation_missing',
  'citation_wrong',
  'answer_incomplete',
  'answer_wrong',
  'outdated_info',
  'jurisdiction_mismatch',
  'helpful',
  'excellent',
  // #264 confidence-breakdown dimensions (sub-PR 1/3):
  'citation_coverage_low',
  'source_recency_stale',
  'source_authority_weak',
  'source_agreement_conflict',
]);

// @MX:NOTE [AUTO] Calibration candidate status enum — SPEC-REGULA-RLHF-001 (Issue #264 sub-PR 2/3).
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-005, REQ-RLHF-015)
// @MX:REASON Drizzle pgEnum mirrors the SQL type created in
//           0095_rlhf_calibration_candidates.sql. Lifecycle (REQ-RLHF-015):
//             pending                  — freshly detected, awaiting RA-Lead review
//             reviewed                  — linked to a governance change_request
//             dismissed                 — RA-Lead rejected (noise / no action)
//             applied_via_governance    — #71 change-control approved + rolled out
//           The detector ONLY inserts 'pending'. The applied_via_governance
//           transition is set by the governance approve path, never by the
//           calibration detector (Charter [지양-2]/[지양-4]).
export const calibrationCandidateStatusEnum = pgEnum('calibration_candidate_status', [
  'pending',
  'reviewed',
  'dismissed',
  'applied_via_governance',
]);

// @MX:NOTE [AUTO] Knowledge promotion enum — SPEC-REGULA-KNOWLEDGE-PROMO-001 (Issue #50).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-KNOWLEDGE-PROMO-006, REQ-KNOWLEDGE-PROMO-014)
// @MX:REASON Drizzle pgEnum mirrors the SQL type created in 0086_knowledge_promo.sql.
// 'active' is eligible for RAG retrieval; 'unpromoted' is excluded (REQ-014 / AC-08).
export const promotedAnswerStatusEnum = pgEnum('promoted_answer_status', ['active', 'unpromoted']);

// @MX:NOTE [AUTO] Knowledge gap enums — SPEC-REGULA-KNOWLEDGE-GAP-001 (Issue #35).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-KNOWLEDGE-GAP-001, REQ-KNOWLEDGE-GAP-008)
// @MX:REASON Drizzle pgEnum mirrors the SQL types created in 0066_knowledge_gap.sql.
// Keep in lock-step with the migration or runtime inserts fail.
// gap_reason: why a consult was classified as a knowledge gap (design.md §2.1).
// gap_status: lifecycle state of an unanswered_queue row.
// gap_classification: RA-lead classification category (REQ-KNOWLEDGE-GAP-008).
export const gapReasonEnum = pgEnum('gap_reason', [
  'low_confidence', // confidence score < 0.5 threshold
  'low_citation', // citation coverage < 80%
  'no_results', // search returned 0 chunks
  'policy_blocked', // LLM generation failed / policy restriction
]);
export const gapStatusEnum = pgEnum('gap_status', [
  'open', // Initial state after detection
  'classified', // RA-lead classification completed
  'resolved', // Closed-loop replay verification passed
]);
export const gapClassificationEnum = pgEnum('gap_classification', [
  'ra_project_gap', // RA project SOP gap
  'md_process_gap', // MD manufacturing/registration process gap
  'external_regulation_needed', // External regulation source needed
  'bug', // Product bug
]);

// REQ-WF-049: workflow_type pgEnum — workflow kinds.
// Migration: 0012_workflow_schema.sql
// REQ-PRE-010: predicate_comparison added via 0029_predicate_workflow_type.sql
// SPEC-REGULA-VIGILANCE-001: vigilance added via 0043_vigilance_workflow_type.sql
// (SPEC-REGULA-PREDICATE-001). Enum values must each be in their own migration.
// REQ-CER-012: cer added via 0035_cer_workflow_type.sql.
// REQ-PCCP-025: 'pccp' added via 0038_pccp_workflow_type.sql (SPEC-REGULA-PCCP-001).
// SPEC-REGULA-RISK-001: 'risk' added via 0057_risk_workflow_type.sql.
// SPEC-REGULA-CLASSIFY-001: 'classification' added via 0051_classification_audit_actions.sql;
// 'classify' added via 0067_classify.sql (tasks.md canonical value, mirrors 'risk' naming).
// SPEC-REGULA-PMS-001: 'pms_report', 'pmcf_plan', 'pmcf_evaluation' added via 0069_pms.sql.
// SPEC-REGULA-PHI-REMOVAL-001 (Issue #319): the 3 PMS/PMCF values removed via 0103_drop_pmcf_pms.sql.
// SPEC-REGULA-CHANGE-CONTROL-001: 'change_control_assessment' added via 0071_change_control.sql.
// SPEC-REGULA-LABELING-001: 'labeling' added via 0072_labeling.sql.
// SPEC-REGULA-CAPA-001: 'complaint' added via 0073_capa.sql.
export const workflowTypeEnum = pgEnum('workflow_type', [
  'submission_drafter',
  'audit_response',
  'indication_impact',
  'predicate_comparison',
  'cer',
  'pccp',
  'vigilance',
  'risk',
  'classification',
  'classify',
  // SPEC-REGULA-PHI-REMOVAL-001 (Issue #319): pms_report/pmcf_plan/pmcf_evaluation
  // removed — PMS/PMCF domain deleted (patient/clinical-subject data).
  'change_control_assessment',
  'labeling',
  'complaint',
  // Issue #69 (REQ-CLININV-001~012): clinical investigation planner.
  'clinical_investigation',
]);

// REQ-WF-049: workflow_status pgEnum — lifecycle states for workflow_runs.
// Migration: 0012_workflow_schema.sql
export const workflowStatusEnum = pgEnum('workflow_status', [
  'queued',
  'running',
  'paused',
  'pending_review',
  'approved',
  'rejected',
  'failed',
]);

// ---------------------------------------------------------------------------
// Tables — declared in FK-dependency order.
// ---------------------------------------------------------------------------

// REQ-FND-033
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  tier: text('tier').notNull().default('standard'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// REQ-FND-032, REQ-ENTERPRISE-016 (user_role enum), REQ-ENTERPRISE-027 (notification_pref)
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    // REQ-ENTERPRISE-016: migrated from TEXT to user_role pgEnum via 0004_user_role_enum.sql.
    // Default 'ra-member' replaces legacy default 'member'.
    role: userRoleEnum('role').notNull().default('ra-member'),
    locale: localeEnum('locale').notNull().default('ko'),
    themePref: themePrefEnum('theme_pref').notNull().default('system'),
    // @MX:NOTE: [AUTO] REQ-ENTERPRISE-027: notification_pref column — write-only in Phase 5.
    // Phase 6 will add read/update paths. Default '{}' is safe for existing rows.
    notificationPref: jsonb('notification_pref').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    // REQ-TENANT-001: nullable department for secondary RBAC axis. null = unrestricted.
    department: userDepartmentEnum('department'),
    // Auth.js v5 DrizzleAdapter requires emailVerified — null = unverified (Credentials flow).
    emailVerified: timestamp('email_verified', { withTimezone: true, mode: 'date' }),
    // Credentials auth — null means SSO-only account.
    password_hash: text('password_hash'),
    image: text('image'),
    // pending = awaiting admin approval, active = approved, disabled = revoked.
    status: userStatusEnum('status').notNull().default('pending'),
    // Issue #111: force password change on first login (admin bootstrap accounts only).
    mustChangePassword: boolean('must_change_password').notNull().default(false),
  },
  (t) => ({
    // Performance optimization: speed up authentication queries by email
    emailIdx: index('idx_users_email').on(t.email),
    // Performance optimization: filter users by status for admin dashboards
    statusIdx: index('idx_users_status').on(t.status),
  }),
);

// REQ-FND-034
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    deviceClass: text('device_class'),
    targetMarkets: text('target_markets')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`)
      .$default(() => []),
    color: text('color'),
    submissionDate: date('submission_date'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    // Performance optimization: org-level project listings
    orgIdx: index('idx_projects_org').on(t.organizationId),
    // Performance optimization: status filtering for dashboards
    statusIdx: index('idx_projects_status').on(t.status),
  }),
);

// REQ-FND-035
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    title: text('title'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => ({
    // Performance optimization: user conversation history queries
    userIdx: index('idx_conversations_user').on(t.userId, t.createdAt),
    // Performance optimization: project-specific conversations
    projectIdx: index('idx_conversations_project').on(t.projectId),
    // Performance optimization: active conversation filtering
    statusIdx: index('idx_conversations_status').on(t.status),
  }),
);

// REQ-FND-036 — meta_json is critical (v0.4.0 C7).
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: messageRoleEnum('role').notNull(),
    contentProse: text('content_prose').notNull().default(''),
    confidenceLevel: confidenceLevelEnum('confidence_level'),
    confidenceScore: numeric('confidence_score', { precision: 4, scale: 3 }),
    durationMs: integer('duration_ms'),
    expertReviewRequired: boolean('expert_review_required').notNull().default(false),
    // SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-KNOWLEDGE-GAP-003): separate flag from
    // expertReviewRequired — distinguishes expert review gating from knowledge gap tracking.
    knowledgeGapRequired: boolean('knowledge_gap_required').notNull().default(false),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    model: text('model'),
    metaJson: jsonb('meta_json'),
    // SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-002): embedding for semantic search.
    // Added via Issue #275 to enable general-conversation semantic search.
    // Nullable — backfilled async via Inngest job (nullable for OpenAI unavailability).
    embedding: vector('embedding'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    // Performance optimization: conversation message loading (chronological)
    conversationIdx: index('idx_messages_conversation_created').on(t.conversationId, t.createdAt),
    // Performance optimization: expert review queue filtering
    expertReviewIdx: index('idx_messages_expert_review').on(t.expertReviewRequired, t.createdAt),
  }),
);

// REQ-FND-039 — sources is created before message_sources because the latter FKs it.
export const sources = pgTable(
  'sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    orgLabel: text('org_label').notNull(),
    title: text('title').notNull(),
    year: integer('year'),
    type: sourceTypeEnum('type').notNull(),
    region: text('region'),
    url: text('url'),
    // Provenance fields for source traceability (REQ-INTEGRATION-001)
    sourceHost: text('source_host'), // github.com, gitea.example.com, local
    sourceOwner: text('source_owner'), // owner/repo for Git, organization for Gitea
    sourceRepo: text('source_repo'), // repository name
    sourceBranch: text('source_branch'), // branch name
    sourceRef: text('source_ref'), // commit SHA, tag, or reference
    sourcePath: text('source_path'), // file path within repository
    contentHash: text('content_hash'), // SHA256 of source content
    ingestionRunId: uuid('ingestion_run_id'), // links to ingestion job
    ingestedAt: timestamp('ingested_at', { withTimezone: true, mode: 'date' }), // ingestion timestamp
    // tsvector and vector use raw SQL types via customType / text fallback;
    // Drizzle does not introspect them but the migration creates them correctly.
    fullTextTsv: text('full_text_tsv'),
    embedding: vector('embedding'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    // SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48, REQ-SOURCE-GOV-001/002/003/009).
    // Governance columns backing the authority model, version/effective/sunset
    // tracking, supersession, and approval workflow. approval_status defaults to
    // 'pending_review' so new ingestions enter RA-owner review (REQ-009).
    authorityGrade: sourceAuthorityGradeEnum('authority_grade'),
    jurisdiction: text('jurisdiction'),
    effectiveDate: date('effective_date'),
    sunsetDate: date('sunset_date'),
    supersededBy: uuid('superseded_by'),
    ownerDepartment: text('owner_department'),
    approvalStatus: sourceApprovalStatusEnum('approval_status').notNull().default('pending_review'),
    reviewCycleDays: integer('review_cycle_days'),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => ({
    // Performance optimization: org-level source catalog queries
    orgIdx: index('idx_sources_org').on(t.organizationId),
    // Performance optimization: source type filtering
    typeIdx: index('idx_sources_type').on(t.type),
    // Performance optimization: regional filtering
    regionIdx: index('idx_sources_region').on(t.region),
    // Provenance queries optimization
    sourceHostIdx: index('idx_sources_host').on(t.sourceHost),
    ingestionRunIdx: index('idx_sources_ingestion').on(t.ingestionRunId),
    // SPEC-REGULA-SOURCE-GOVERNANCE-001 — retrieval-gate indexes.
    // authorityGrade: priority ranking (regulator_official first). REQ-004.
    // approvalStatus: exclude pending_review/rejected from default search. REQ-005/009.
    // sunsetDate: stale-citation detection at draft/export. REQ-007.
    // supersededBy: supersession traversal for historical lookups. REQ-006.
    authorityGradeIdx: index('idx_sources_authority_grade').on(t.authorityGrade),
    approvalStatusIdx: index('idx_sources_approval_status').on(t.approvalStatus),
    sunsetDateIdx: index('idx_sources_sunset_date').on(t.sunsetDate),
    supersededByIdx: index('idx_sources_superseded_by').on(t.supersededBy),
    effectiveDateIdx: index('idx_sources_effective_date').on(t.effectiveDate),
  }),
);

// REQ-FND-037 — cite_index is non-nullable; UNIQUE(message_id, cite_index).
export const messageSources = pgTable(
  'message_sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'restrict' }),
    relevanceScore: numeric('relevance_score', { precision: 4, scale: 3 }),
    quotedOffset: integer('quoted_offset'),
    quotedLength: integer('quoted_length'),
    citeIndex: integer('cite_index').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    citeIndexUnique: unique('message_sources_message_cite_idx').on(t.messageId, t.citeIndex),
  }),
);

// REQ-FND-038
export const messageBlocks = pgTable(
  'message_blocks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    blockType: blockTypeEnum('block_type').notNull(),
    blockJson: jsonb('block_json').notNull().default({}),
    orderIndex: integer('order_index').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    messageOrderIdx: index('message_blocks_message_order_idx').on(t.messageId, t.orderIndex),
  }),
);

// REQ-FND-044a — must NOT be omitted. UNIQUE(source_id, anchor).
export const sourceSections = pgTable(
  'source_sections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    anchor: text('anchor').notNull(),
    heading: text('heading'),
    text: text('text').notNull(),
    // Section-level provenance for citation reproducibility (REQ-INTEGRATION-001)
    chunkHash: text('chunk_hash'), // SHA256 of section text content
    sectionPath: text('section_path'), // full section path (file path + anchor)
    ingestionRunId: uuid('ingestion_run_id'), // links to ingestion job
    ingestedAt: timestamp('ingested_at', { withTimezone: true, mode: 'date' }), // ingestion timestamp
    embedding: vector('embedding'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    // SPEC-REGULA-DELTA-SYNC-001 — supersession tracking for incremental updates (Issue #45)
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    superseded_by: uuid('superseded_by'),
    // SPEC-REGULA-RLHF-001 — feedback-driven score for retrieval re-ranking
    // (Issue #56, REQ-RLHF-009). Default 0 so existing rows are re-ranking-neutral.
    feedbackScore: numeric('feedback_score', { precision: 6, scale: 3 }).notNull().default('0'),
  },
  (t) => ({
    anchorUnique: unique('source_sections_source_anchor_idx').on(t.sourceId, t.anchor),
    // Provenance queries optimization
    ingestionRunIdx: index('idx_source_sections_ingestion').on(t.ingestionRunId),
    // Delta-sync queries (REQ-DELTA-002)
    supersededByIdx: index('idx_source_sections_superseded_by').on(t.superseded_by),
    updatedAtIdx: index('idx_source_sections_updated_at').on(t.updated_at),
  }),
);

// @MX:NOTE [AUTO] answer_feedback — SPEC-REGULA-RLHF-001 (Issue #56, REQ-RLHF-001).
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-001, REQ-RLHF-004, AC-01)
// @MX:REASON One feedback row per user per message (UNIQUE). RLS is enabled in the
//           migration (0082_rlhf.sql) at the SQL level — org isolation via the
//           messages -> conversations -> org_members join.
// @MX:WARN [AUTO] user_id is uuid, NOT text (L-010/L-011 fix-up 0090).
// @MX:REASON users.id is uuid. Original 0082 declared user_id text -> uuid FK,
//           which is a type mismatch — Postgres refused the FK and the entire
//           CREATE TABLE rolled back, leaving answer_feedback ABSENT from the DB
//           (3 live /api/rlhf/* routes 500'd). Fix-up 0090 recreated the table
//           with user_id uuid. Schema mirrors the corrected migration. Do NOT
//           revert to text.
export const answerFeedback = pgTable(
  'answer_feedback',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: feedbackRatingEnum('rating').notNull(),
    qualityTags: qualityTagEnum('quality_tags').array().notNull().default(sql`'{}'::quality_tag[]`),
    comment: text('comment'),
    // @MX:NOTE [AUTO] feedbackSource — origin channel (0096, Issue #264 sub-PR 3/3).
    //   'explicit' default preserves back-compat for pre-0096 rows. The route
    //   scopes existing-row lookups by this column so explicit + implicit rows
    //   for the same (message, user) coexist without 409.
    feedbackSource: feedbackSourceEnum('feedback_source').notNull().default('explicit'),
    // @MX:NOTE [AUTO] variationDimensions — optional client metadata describing
    //   which retrieval/generation dimension differed on the regenerated attempt
    //   (region/corpus/model). NULLABLE; explicit feedback never sets it.
    variationDimensions: jsonb('variation_dimensions'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    // @MX:WARN [AUTO] UNIQUE(message_id, user_id, feedback_source) — replaces the
    //   original 2-column unique (0082). One explicit + one implicit_regenerate
    //   row per (message, user) coexist. Migration 0096 DROPs the old constraint
    //   name and ADDs this one.
    //   @MX:REASON A user who left explicit feedback AND later regenerates must
    //     not collide (409). The 3-column key lets both signals persist.
    messageUserSourceUnique: unique('answer_feedback_message_user_source_idx').on(
      t.messageId,
      t.userId,
      t.feedbackSource,
    ),
    messageIdx: index('idx_answer_feedback_message').on(t.messageId),
    createdIdx: index('idx_answer_feedback_created').on(t.createdAt),
    user_idx: index('idx_answer_feedback_user').on(t.userId),
  }),
);

// @MX:NOTE [AUTO] calibration_candidates — SPEC-REGULA-RLHF-001 (Issue #264 sub-PR 2/3).
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-005, REQ-RLHF-006, REQ-RLHF-014, REQ-RLHF-015)
// @MX:REASON Confidence-calibration detection surface. Each row captures ONE
//           observation: "in confidence bucket B, across N samples, the
//           observed up-vote ratio was R". Overconfident / underconfident
//           buckets become pending candidates for RA-Lead review.
//           Charter [지양-2]: correction values are NEVER auto-applied —
//           status starts at 'pending' and only transitions via governance.
//           Charter [지양-4]: any applied change flows through #71
//           MODEL-GOVERNANCE via the nullable governance_change_request_id FK.
//           RLS is inert project-wide (#239 debt); query-layer eq(orgId) is
//           the authoritative tenant boundary (mirrors answer_feedback).
export const calibrationCandidates = pgTable(
  'calibration_candidates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // @MX:WARN [AUTO] confidence_bucket is text (half-open interval label),
    //   NOT numeric — keeps candidate rows stable + human-readable in audit.
    //   @MX:REASON the detector buckets confidence into named bands; storing
    //     the label (not the raw score) matches detection granularity.
    confidenceBucket: text('confidence_bucket').notNull(),
    // Optional secondary dimension (default 'all' for the whole-bucket view).
    sourceType: text('source_type').notNull().default('all'),
    observedUpRatio: numeric('observed_up_ratio', { precision: 4, scale: 3 }),
    sampleSize: integer('sample_size').notNull().default(0),
    verdict: text('verdict').notNull(),
    status: calibrationCandidateStatusEnum('status').notNull().default('pending'),
    proposedBy: uuid('proposed_by').references(() => users.id, { onDelete: 'set null' }),
    proposedAt: timestamp('proposed_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true, mode: 'date' }),
    // Nullable link to #71 MODEL-GOVERNANCE change_request. Forward reference
    // — changeRequest is defined later in this module (Drizzle resolves it).
    governanceChangeRequestId: uuid('governance_change_request_id'),
    reviewNotes: text('review_notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    orgStatusIdx: index('idx_calibration_candidates_org_status').on(t.orgId, t.status),
    orgBucketIdx: index('idx_calibration_candidates_org_bucket').on(
      t.orgId,
      t.confidenceBucket,
      t.sourceType,
    ),
    proposedAtIdx: index('idx_calibration_candidates_proposed_at').on(t.proposedAt),
  }),
);

// @MX:NOTE [AUTO] promoted_answers — SPEC-REGULA-KNOWLEDGE-PROMO-001 (Issue #50).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-006, REQ-007, REQ-013, REQ-014, AC-02, AC-07)
// @MX:REASON Team knowledge library of promoted Q&A. UNIQUE(source_message_id)
//           prevents duplicate promotion; re-promotion re-activates the row.
//           RLS is enabled in 0086_knowledge_promo.sql at the SQL level; the
//           query-layer eq(orgId) is the actual tenant boundary (#239 debt).
//           embedding vector(1536) supports REQ-002 semantic search; messages
//           embedding added via Issue #275 for REQ-002 full semantic search;
//           nullable — backfilled async via Inngest job.
export const promotedAnswers = pgTable(
  'promoted_answers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    sourceMessageId: uuid('source_message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    // @MX:WARN [AUTO] promoted_by MUST be uuid, not text — users.id is uuid.
    //   @MX:REASON 0086 originally declared text(), causing a text-vs-uuid FK
    //     type mismatch that rolled back the entire CREATE TABLE in real PG.
    //   Fixed in migration 0089 (0086 left as merged history). Drizzle FK type
    //     now matches; typecheck prevents regression.
    promotedBy: uuid('promoted_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    promotedAt: timestamp('promoted_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    status: promotedAnswerStatusEnum('status').notNull().default('active'),
    // vector column — Drizzle does not introspect vector type; migration
    // creates it. Kept as customType via vector() helper (see sources.embedding).
    embedding: vector('embedding'),
  },
  (t) => ({
    // UNIQUE(source_message_id) — one promoted row per source answer.
    sourceMessageUnique: unique('promoted_answers_source_message_idx').on(t.sourceMessageId),
    // REQ-015 / AC-06: org-scoped active listing + tag filtering.
    orgActiveIdx: index('idx_promoted_answers_org_active').on(t.orgId, t.status),
  }),
);

// @MX:NOTE [AUTO] project_memory — project-scoped RA decision memory (Issue #51).
// @MX:SPEC SPEC-REGULA-PROJECT-MEMORY-001 (REQ-001, REQ-002, REQ-005, REQ-012)
// Accumulates device classification / target markets / submission strategy /
// predicate device / risk class decisions across sessions. Injected into the
// system prompt at consult time (REQ-003) so AI answers stay consistent with
// prior project decisions (ISO 13485 design control).
//   status='pending' = AI-extracted suggestion (Charter [지양-4], NEVER auto-active)
//   status='active'  = RA-lead-approved, eligible for injection
//   status='invalidated' = superseded (REQ-012 history preservation, hard-delete forbidden)
// UNIQUE NULLS NOT DISTINCT (project_id, key) WHERE status='active' is the
// DB-level atomicity guard for same-key update (invalidate old + create new
// in ONE tx). RLS inert project-wide (#239); JS org guard is authoritative.
export const projectMemoryTypeEnum = pgEnum('project_memory_type', [
  'device_classification',
  'target_markets',
  'submission_strategy',
  'predicate_device',
  'risk_class',
  'custom',
]);

export const projectMemoryStatusEnum = pgEnum('project_memory_status', [
  'active',
  'pending',
  'invalidated',
]);

export const projectMemory = pgTable(
  'project_memory',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    memoryType: projectMemoryTypeEnum('memory_type').notNull(),
    key: text('key').notNull(),
    value: text('value').notNull(),
    // REQ-013: provenance. NULL only for RA-lead manual entries.
    sourceConversationId: uuid('source_conversation_id').references(() => conversations.id, {
      onDelete: 'set null',
    }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    status: projectMemoryStatusEnum('status').notNull().default('active'),
    validFrom: timestamp('valid_from', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    validUntil: timestamp('valid_until', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    // §4.2: valid-memory lookup optimization.
    lookupIdx: index('idx_project_memory_lookup').on(t.projectId, t.key, t.validUntil),
    // Status filtering for pending review queue and active injection.
    projectStatusIdx: index('idx_project_memory_project_status').on(t.projectId, t.status),
  }),
);

// SPEC-REGULA-DELTA-SYNC-001 — corpus_sync_runs (Issue #45, migration 0065)
// Tracks each incremental sync execution: changed/unchanged/failed chunk counts.
export const corpusSyncRuns = pgTable(
  'corpus_sync_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    crawlerName: text('crawler_name').notNull(),
    sourceUrl: text('source_url').notNull(),
    contentHash: text('content_hash').notNull(),
    status: text('status').notNull().default('pending'),
    chunksAdded: integer('chunks_added').notNull().default(0),
    chunksOutdated: integer('chunks_outdated').notNull().default(0),
    chunksUnchanged: integer('chunks_unchanged').notNull().default(0),
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    crawlerStartedIdx: index('idx_corpus_sync_runs_crawler_started').on(t.crawlerName, t.startedAt),
    statusIdx: index('idx_corpus_sync_runs_status').on(t.status),
    sourceHashIdx: index('idx_corpus_sync_runs_source_hash').on(t.sourceUrl, t.contentHash),
  }),
);

// REQ-FND-041
export const templates = pgTable('templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  region: text('region'),
  category: text('category'),
  fileKey: text('file_key').notNull(),
  usageCount: integer('usage_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// REQ-FND-042 + REQ-RADAR: Extends with Phase 10 crawler/classification columns.
// New columns added via 0018_radar.sql — do NOT modify existing columns.
export const regulatoryUpdates = pgTable('regulatory_updates', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  region: text('region').notNull(),
  severity: text('severity').notNull().default('info'),
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }).notNull(),
  sourceUrl: text('source_url'),
  affectedProductTypes: text('affected_product_types')
    .array()
    .notNull()
    .$default(() => []),
  impactAnalysisText: text('impact_analysis_text'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  // Phase 10 Radar columns (0018_radar.sql)
  sourceCrawler: text('source_crawler'),
  externalId: text('external_id'),
  rawContentEn: text('raw_content_en'),
  rawContentKo: text('raw_content_ko'),
  impactTypeHint: text('impact_type_hint'),
  tier1Relevant: boolean('tier1_relevant'),
  impactScore: numeric('impact_score', { precision: 3, scale: 2 }),
});

// Phase 10 Radar: crawler_runs — tracks each crawler execution lifecycle.
// @MX:SPEC SPEC-REGULA-RADAR-001
export const crawlerRuns = pgTable(
  'crawler_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    crawlerName: text('crawler_name').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    status: text('status').notNull().default('running'),
    recordsAdded: integer('records_added').default(0),
    errorsJson: jsonb('errors_json').notNull().default([]),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    crawlerNameIdx: index('idx_crawler_runs_crawler_name').on(t.crawlerName, t.startedAt),
    startedAtIdx: index('idx_crawler_runs_started_at').on(t.startedAt),
  }),
);

// Phase 10 Radar: org_update_relevance — per-org impact scoring for regulatory updates.
// @MX:SPEC SPEC-REGULA-RADAR-001
export const orgUpdateRelevance = pgTable(
  'org_update_relevance',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    updateId: uuid('update_id')
      .notNull()
      .references(() => regulatoryUpdates.id, { onDelete: 'cascade' }),
    impactScore: numeric('impact_score', { precision: 3, scale: 2 }).notNull(),
    matchedProductCategories: text('matched_product_categories')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    feedback: text('feedback'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    orgUpdateUnique: unique('org_update_relevance_org_update_key').on(t.orgId, t.updateId),
    orgImpactIdx: index('idx_org_update_relevance_org_impact').on(t.orgId, t.impactScore),
    updateIdx: index('idx_org_update_relevance_update').on(t.updateId),
  }),
);

// REQ-FND-043; Risk R9 mitigation: composite index on (status, assigned_to)
// added via 0007_expert_reviews_index.sql.
export const expertReviews = pgTable(
  'expert_reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'restrict' }),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    status: expertReviewStatusEnum('status').notNull().default('pending'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => ({
    statusAssignedIdx: index('idx_expert_reviews_status_assigned').on(t.status, t.assignedTo),
  }),
);

// REQ-FND-044 — append-only enforced by trigger in 0001_audit_append_only.sql.
// @MX:WARN audit_logs is append-only. UPDATE/DELETE/TRUNCATE are blocked at
// the database layer (21 CFR Part 11 §11.10(c)). Do not add Drizzle-side
// .update() or .delete() calls — they will raise P0001 at runtime.
// @MX:REASON FDA Part 11 mandates immutable electronic records for 7 years.
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: auditActionEnum('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    conversationId: uuid('conversation_id').references(() => conversations.id, {
      onDelete: 'restrict',
    }),
    metaJson: jsonb('meta_json').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    // SPEC-V3-IMPACT-001 M8: Hash chain for 21 CFR Part 11 verification
    // Using text to store hex-encoded hash (SHA-256 = 64 hex chars)
    previousHash: text('previous_hash'),
    // SPEC-V3-AUDIT-CHAIN-001 M0: monotonic chain sequence (tie-break + prev-row lookup).
    // writeAudit sets chain_seq = prev.chain_seq + 1. Existing rows keep default 0
    // (genesis segment, Strategy B backfill — append-only trigger forbids UPDATE).
    chainSeq: bigint('chain_seq', { mode: 'number' }).notNull().default(0),
  },
  (t) => ({
    // Performance optimization: actor audit trail queries (REQ-FND-048)
    actorIdx: index('idx_audit_logs_actor_created').on(t.actorId, t.createdAt),
    // Performance optimization: action type filtering for compliance reports
    actionIdx: index('idx_audit_logs_action_created').on(t.action, t.createdAt),
    // Performance optimization: resource-specific audit queries
    resourceIdx: index('idx_audit_logs_resource').on(t.resourceType, t.resourceId),
  }),
);

// @MX:NOTE [AUTO] unanswered_queue — SPEC-REGULA-KNOWLEDGE-GAP-001 (Issue #35, REQ-KNOWLEDGE-GAP-004).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-KNOWLEDGE-GAP-001..004)
// @MX:REASON RLS org isolation enforced in 0066_knowledge_gap.sql — inherits
// app.current_org_id pattern from 0015_docingest_rls.sql. Do not bypass.
// Stores PII-redacted user questions that the RAG pipeline could not answer
// with sufficient confidence/citation, feeding the closed-loop KB augmentation.
export const unansweredQueue = pgTable(
  'unanswered_queue',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    redactedQuestion: text('redacted_question').notNull(),
    redactionHash: text('redaction_hash').notNull(),
    gapReason: gapReasonEnum('gap_reason').notNull(),
    clusterId: text('cluster_id'),
    githubIssueNumber: integer('github_issue_number'),
    classification: gapClassificationEnum('classification'),
    // Issue #157 — owning-project routing. Null until createOwningIssue succeeds.
    // owningIssueTarget stores the OwningTarget enum ('ra-project'|'md-process'|'gitea-wiki'|'hybrid-ra-saas').
    owningIssueUrl: text('owning_issue_url'),
    owningIssueTarget: text('owning_issue_target'),
    status: gapStatusEnum('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => ({
    // RLS org isolation lookup (REQ-KNOWLEDGE-GAP-004)
    orgIdx: index('idx_unanswered_queue_org').on(t.orgId),
    // Queue status filtering for RA-lead classification workflow
    statusIdx: index('idx_unanswered_queue_status').on(t.status),
    // Cluster append lookup (REQ-KNOWLEDGE-GAP-005)
    clusterIdx: index('idx_unanswered_queue_cluster').on(t.clusterId),
  }),
);

// CF-2 fix: RBAC 2-tier membership tables — absent from FOUNDATION schema.
// Discovered during Phase 5 Phase 1 analysis. Required for REQ-ENTERPRISE-016
// RBAC enforcement. Migration: 0009_membership_tables.sql.

// org_members: user ↔ organization membership.
export const orgMembers = pgTable(
  'org_members',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    pk: { columns: [t.userId, t.orgId] },
    orgIdIdx: index('idx_org_members_org_id').on(t.orgId),
  }),
);

// project_members: user ↔ project membership.
export const projectMembers = pgTable(
  'project_members',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    pk: { columns: [t.userId, t.projectId] },
    projectIdIdx: index('idx_project_members_project_id').on(t.projectId),
  }),
);

// REQ-WF-049: workflow_runs — long-running regulatory workflow state persistence.
// @MX:NOTE: [AUTO] review_required is enforced server-side; see lib/auth/with-workflow-review.ts
// @MX:SPEC SPEC-REGULA-WORKFLOWS-001 (REQ-WF-049)
export const workflowRuns = pgTable(
  'workflow_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    projectId: uuid('project_id').references(() => projects.id),
    workflowType: workflowTypeEnum('workflow_type').notNull(),
    status: workflowStatusEnum('status').notNull().default('queued'),
    inputJson: jsonb('input_json').notNull(),
    resultJson: jsonb('result_json'),
    stepProgress: jsonb('step_progress'),
    confidenceAggregate: numeric('confidence_aggregate', { precision: 3, scale: 2 }),
    reviewRequired: boolean('review_required').notNull().default(true),
    reviewerUserId: uuid('reviewer_user_id').references(() => users.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true, mode: 'date' }),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    cloudflareWorkflowInstanceId: text('cloudflare_workflow_instance_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    // Performance optimization: user workflow history
    userIdx: index('idx_workflow_runs_user').on(t.userId, t.createdAt),
    // Performance optimization: org-level workflow dashboard
    orgIdx: index('idx_workflow_runs_org').on(t.organizationId, t.createdAt),
    // Performance optimization: project workflow filtering
    projectIdx: index('idx_workflow_runs_project').on(t.projectId),
    // Performance optimization: status-based queue queries
    statusIdx: index('idx_workflow_runs_status').on(t.status, t.createdAt),
    // Performance optimization: reviewer queue filtering
    reviewerIdx: index('idx_workflow_runs_reviewer').on(t.reviewerUserId, t.status),
  }),
);

// REQ-CER-013: cer_literature — PubMed literature per CER workflow run.
// Migration: 0030_cer_literature.sql
// Stores search results with SIGN 50 / GRADE evidence appraisal and
// inclusion/exclusion decisions for EU MDR Annex XIV CER compliance.
export const cerLiterature = pgTable('cer_literature', {
  id: uuid('id').defaultRandom().primaryKey(),
  cerRunId: uuid('cer_run_id')
    .notNull()
    .references(() => workflowRuns.id, { onDelete: 'cascade' }),
  pmid: text('pmid').notNull(),
  title: text('title').notNull(),
  abstract: text('abstract'),
  vancouverCitation: text('vancouver_citation'),
  sign50Level: text('sign50_level'),
  gradeQuality: text('grade_quality'),
  included: boolean('included').notNull().default(false),
  exclusionReason: text('exclusion_reason'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// REQ-CLINLIT-001~005: literature_searches — PICO-based search protocol per CER run.
// Migration: 0041_lit_searches.sql
export const literatureSearches = pgTable('literature_searches', {
  id: uuid('id').defaultRandom().primaryKey(),
  cerRunId: uuid('cer_run_id')
    .notNull()
    .references(() => workflowRuns.id, { onDelete: 'cascade' }),
  protocolVersion: integer('protocol_version').notNull().default(1),
  deviceDescription: text('device_description').notNull(),
  picoPatient: text('pico_patient').notNull(),
  picoIntervention: text('pico_intervention').notNull(),
  picoComparator: text('pico_comparator'),
  picoOutcome: text('pico_outcome').notNull(),
  searchQuery: text('search_query').notNull(),
  meshTerms: jsonb('mesh_terms').$type<string[]>().notNull().default([]),
  totalRecords: integer('total_records').notNull().default(0),
  afterDedup: integer('after_dedup').notNull().default(0),
  afterTitleAbstract: integer('after_title_abstract').notNull().default(0),
  afterFullText: integer('after_full_text').notNull().default(0),
  includedCount: integer('included_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// REQ-CLINLIT-011~014: literature_references — screened article records per search.
// Migration: 0042_lit_references.sql
export const literatureReferences = pgTable('literature_references', {
  id: uuid('id').defaultRandom().primaryKey(),
  searchId: uuid('search_id')
    .notNull()
    .references(() => literatureSearches.id, { onDelete: 'cascade' }),
  pmid: text('pmid').notNull(),
  title: text('title').notNull(),
  abstract: text('abstract'),
  authors: jsonb('authors').$type<string[]>().notNull().default([]),
  journal: text('journal').notNull(),
  year: integer('year').notNull(),
  vancouverCitation: text('vancouver_citation'),
  sign50Level: text('sign50_level'),
  gradeQuality: text('grade_quality'),
  screeningDecision: text('screening_decision').notNull().default('pending'),
  screeningReason: text('screening_reason'),
  included: boolean('included').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// REQ-CLINLIT-021~025: evidence_syntheses — GRADE synthesis + CER section drafts.
// Migration: 0043_evidence_syntheses.sql
export const evidenceSyntheses = pgTable('evidence_syntheses', {
  id: uuid('id').defaultRandom().primaryKey(),
  searchId: uuid('search_id')
    .notNull()
    .references(() => literatureSearches.id, { onDelete: 'cascade' }),
  gradeSummary: text('grade_summary').notNull(),
  narrativeSynthesis: text('narrative_synthesis').notNull(),
  cerSection6Draft: text('cer_section6_draft').notNull(),
  cerSection7Draft: text('cer_section7_draft').notNull(),
  cerSection8Draft: text('cer_section8_draft').notNull(),
  highCount: integer('high_count').notNull().default(0),
  moderateCount: integer('moderate_count').notNull().default(0),
  lowCount: integer('low_count').notNull().default(0),
  veryLowCount: integer('very_low_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Auth.js v5 DrizzleAdapter tables — required for database session strategy.
// Migration: 0023_auth_adapter_tables.sql
// ---------------------------------------------------------------------------

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
});

export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  }),
);

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  }),
);

// SPEC-REGULA-IMPACT-001 — regulatory change impact assessment.
// Migrations: 0033_impact_tables.sql, 0034_impact_audit_actions.sql
// @MX:SPEC SPEC-REGULA-IMPACT-001
export const regulatoryImpactAssessments = pgTable(
  'regulatory_impact_assessments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    regulatoryUpdateId: uuid('regulatory_update_id')
      .notNull()
      .references(() => regulatoryUpdates.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    impactLevel: text('impact_level').notNull(),
    affectedSections: jsonb('affected_sections').notNull().default([]),
    analysisSummary: text('analysis_summary'),
    confidence: numeric('confidence', { precision: 3, scale: 2 }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    // SPEC-V3-IMPACT-001 M8: Wizard input columns (nullable)
    wizardType: text('wizard_type'),
    changeCategory: text('change_category'),
    changeDetail: text('change_detail'),
    markets: jsonb('markets'),
    retestMatrixResults: jsonb('retest_matrix_results'),
    llmCategory: jsonb('llm_category'),
    ragSimilarCases: jsonb('rag_similar_cases'),
  },
  (t) => ({
    riaUpdateProjectKey: unique('ria_update_project_key').on(t.regulatoryUpdateId, t.projectId),
    riaProjectImpactIdx: index('idx_ria_project_impact').on(t.projectId, t.impactLevel),
    riaUpdateIdx: index('idx_ria_update').on(t.regulatoryUpdateId),
  }),
);

export const impactActionItems = pgTable('impact_action_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  assessmentId: uuid('assessment_id')
    .notNull()
    .references(() => regulatoryImpactAssessments.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  priority: text('priority').notNull(),
  documentType: text('document_type'),
  sectionReference: text('section_reference'),
  description: text('description').notNull(),
  status: text('status').notNull().default('open'),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
});

// SPEC-REGULA-PCCP-001 — PCCP version and component tables.
// REQ-PCCP-010: pccp_versions — one PCCP document per device, versioned lifecycle.
// REQ-PCCP-022: pccp_components — per-component content and completion tracking.
// Migration: 0039_pccp_tables.sql
// AC-9: at most one active PCCP per device — enforced by partial UNIQUE INDEX in migration.
export const pccpVersions = pgTable('pccp_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceId: uuid('device_id').notNull(),
  version: text('version').notNull().default('1.0'),
  // status CHECK: 'draft' | 'submitted' | 'cleared' | 'superseded' (REQ-PCCP-024)
  status: text('status').notNull().default('draft'),
  active: boolean('active').notNull().default(true),
  baselineSnapshotJsonb: jsonb('baseline_snapshot_jsonb'),
  parentWorkflowId: uuid('parent_workflow_id'),
  deviceName: text('device_name').notNull(),
  manufacturer: text('manufacturer').notNull(),
  indication: text('indication'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const pccpComponents = pgTable(
  'pccp_components',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pccpVersionId: uuid('pccp_version_id')
      .notNull()
      .references(() => pccpVersions.id, { onDelete: 'cascade' }),
    // componentType CHECK: 'modification_description'|'sps'|'acp'|'impact_assessment'|'performance_testing'
    componentType: text('component_type').notNull(),
    contentJsonb: jsonb('content_jsonb').notNull().default({}),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueVersionComponent: unique().on(t.pccpVersionId, t.componentType),
  }),
);
// ---------------------------------------------------------------------------
// SPEC-REGULA-VIGILANCE-001 — Post-Market Surveillance tables.
// REMOVED by SPEC-REGULA-PHI-REMOVAL-001: adverse_events, reportability_assessments,
// vigilance_reports dropped (Regula does not handle patient outcomes).
// Migration: 0102_drop_phivigilance_capa_tables.sql
// ---------------------------------------------------------------------------

// SPEC-REGULA-DIGEST-001 — per-org digest preferences.
// Migration: 0052_weekly_digests.sql
export const orgDigestPreferences = pgTable('org_digest_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id')
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  // frequency: 'weekly'|'biweekly'|'manual'|'disabled'
  frequency: text('frequency').notNull().default('weekly'),
  timezone: text('timezone').notNull().default('UTC'),
  sendDayOfWeek: integer('send_day_of_week').notNull().default(1),
  sendHour: integer('send_hour').notNull().default(9),
  // minSeverity: 'low'|'medium'|'high'|'critical'
  minSeverity: text('min_severity').notNull().default('medium'),
  includeImmediateAlerts: boolean('include_immediate_alerts').notNull().default(true),
  recipientEmails: text('recipient_emails').array().notNull().default(sql`'{}'::text[]`),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// SPEC-REGULA-DIGEST-001 — generated weekly digest records.
// Migration: 0052_weekly_digests.sql
export const weeklyDigests = pgTable('weekly_digests', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  weekId: text('week_id').notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updateCount: integer('update_count').notNull().default(0),
  criticalCount: integer('critical_count').notNull().default(0),
  highCount: integer('high_count').notNull().default(0),
  mediumCount: integer('medium_count').notNull().default(0),
  lowCount: integer('low_count').notNull().default(0),
  digestJson: jsonb('digest_json').notNull().default({}),
  emailSentAt: timestamp('email_sent_at', { withTimezone: true, mode: 'date' }),
  shareToken: text('share_token').unique(),
});

// SPEC-REGULA-NOTIFICATIONS-001 — per-org webhook settings.
// Migration: 0028_org_notification_settings.sql
export const orgNotificationSettings = pgTable('org_notification_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id')
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  slackWebhookUrl: text('slack_webhook_url'),
  teamsWebhookUrl: text('teams_webhook_url'),
  fromEmail: text('from_email'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// SPEC-REGULA-STANDARDS-001 — standards catalog.
// Migration: 0047_standards_catalog.sql
export const standardsCatalog = pgTable('standards_catalog', {
  id: uuid('id').defaultRandom().primaryKey(),
  standardNumber: text('standard_number').notNull().unique(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  version: text('version').notNull(),
  publicationYear: integer('publication_year').notNull(),
  // status CHECK: 'current'|'withdrawn'|'under_revision'
  status: text('status').notNull().default('current'),
  supersedes: text('supersedes'),
  scopeKeywords: text('scope_keywords').array().notNull().default(sql`ARRAY['']::text[]`),
  fdaRecognized: boolean('fda_recognized').notNull().default(false),
  euHarmonized: boolean('eu_harmonized').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// SPEC-REGULA-STANDARDS-001 — standards applicability mapping.
// Migration: 0048_standards_applicability.sql
export const standardsApplicability = pgTable(
  'standards_applicability',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    deviceTypeKey: text('device_type_key').notNull(),
    standardId: uuid('standard_id')
      .notNull()
      .references(() => standardsCatalog.id, { onDelete: 'cascade' }),
    applicabilityReason: text('applicability_reason').notNull(),
    // regulatoryPathway CHECK: 'fda_510k'|'fda_pma'|'eu_mdr_class_i'|'eu_mdr_class_ii'|'eu_mdr_class_iii'|'all'
    regulatoryPathway: text('regulatory_pathway').notNull(),
    isMandatory: boolean('is_mandatory').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueMapping: unique().on(t.deviceTypeKey, t.standardId, t.regulatoryPathway),
  }),
);

// SPEC-REGULA-SAMD-001 — AI/ML SaMD regulatory pathway assessments.
// Migration: 0054_samd_assessments.sql
export const samdAssessments = pgTable('samd_assessments', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id'),
  title: text('title').notNull(),
  deviceDescription: text('device_description').notNull(),
  intendedUse: text('intended_use').notNull(),
  // aiMlType CHECK: 'locked'|'adaptive'|'continuously_learning'
  aiMlType: text('ai_ml_type').notNull(),
  // imdrfClinicalSituation CHECK: 'critical'|'serious'|'non_serious'
  imdrfClinicalSituation: text('imdrf_clinical_situation').notNull(),
  // imdrfHealthcareSituation CHECK: 'critical'|'serious'|'non_serious'
  imdrfHealthcareSituation: text('imdrf_healthcare_situation').notNull(),
  // Computed: 'I'|'II'|'III'|'IV'
  imdrfCategory: text('imdrf_category'),
  // fdaPathway: '510k'|'de_novo'|'pma'|'exempt'
  fdaPathway: text('fda_pathway'),
  // euAiRiskLevel: 'prohibited'|'high_risk'|'general_purpose'|'minimal'
  euAiRiskLevel: text('eu_ai_risk_level'),
  pccpRequired: boolean('pccp_required').notNull().default(false),
  // status CHECK: 'draft'|'in_review'|'approved'|'archived'
  status: text('status').notNull().default('draft'),
  generatedModelCard: jsonb('generated_model_card'),
  generatedChecklist: jsonb('generated_checklist'),
  generatedMonitoringPlan: jsonb('generated_monitoring_plan'),
  expertReviewApprovedBy: text('expert_review_approved_by'),
  expertReviewApprovedAt: timestamp('expert_review_approved_at', {
    withTimezone: true,
    mode: 'date',
  }),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// SPEC-REGULA-CLASSIFY-001 — device classification results.
// Migration: 0050_device_classifications.sql (flat columns) +
//            0067_classify.sql (workflow_run_id FK, input/result JSONB, status, RLS).
export const deviceClassifications = pgTable(
  'device_classifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    // 0067: optional link to the workflow_runs row for this classification.
    workflowRunId: uuid('workflow_run_id').references(() => workflowRuns.id, {
      onDelete: 'set null',
    }),
    deviceDescription: text('device_description').notNull(),
    // deviceType CHECK: 'active'|'non_active'|'software_only'|'ivd'|'implantable'
    deviceType: text('device_type').notNull(),
    // contactType CHECK: 'no_contact'|'external'|'internal'|'implant'
    contactType: text('contact_type').notNull(),
    hasSoftware: boolean('has_software').notNull().default(false),
    hasAiMl: boolean('has_ai_ml').notNull().default(false),
    isSterile: boolean('is_sterile').notNull().default(false),
    fdaClass: text('fda_class'),
    fdaPathway: text('fda_pathway'),
    fdaProductCode: text('fda_product_code'),
    fdaRegulationNumber: text('fda_regulation_number'),
    euClass: text('eu_class'),
    euPathway: text('eu_pathway'),
    euRule: text('eu_rule'),
    mfdsClass: text('mfds_class'),
    nmpaClass: text('nmpa_class'),
    pmdaClass: text('pmda_class'),
    classificationRationale: jsonb('classification_rationale').notNull().default({}),
    // 0067: full wizard input + structured 5-jurisdiction result (citations, nextSteps).
    input: jsonb('input').notNull().default({}),
    result: jsonb('result'),
    status: text('status').notNull().default('completed'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    runIdx: index('idx_device_classifications_run').on(t.workflowRunId),
  }),
);

// ---------------------------------------------------------------------------
// SPEC-REGULA-DHF-001 — Design History File (DHF) tables.
// Migration: 0055_design_history_files.sql
// ---------------------------------------------------------------------------

// Top-level DHF record per device.
export const designHistoryFiles = pgTable(
  'design_history_files',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    deviceName: text('device_name').notNull(),
    deviceModel: text('device_model'),
    intendedUse: text('intended_use').notNull(),
    // jurisdiction CHECK: 'FDA'|'EU'|'MFDS'|'NMPA'|'PMDA'
    jurisdiction: text('jurisdiction').notNull().default('FDA'),
    // regulatory_framework CHECK: 'QSR_QMSR'|'ISO_13485'|'EU_MDR'
    regulatoryFramework: text('regulatory_framework').notNull().default('QSR_QMSR'),
    // status CHECK: 'draft'|'in_review'|'design_freeze'|'archived'
    status: text('status').notNull().default('draft'),
    completenessScore: integer('completeness_score').notNull().default(0),
    designFreezeDate: date('design_freeze_date'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('idx_dhf_org').on(t.orgId),
  }),
);

// Design inputs (requirements) linked to a DHF.
export const designInputs = pgTable(
  'design_inputs',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    dhfId: text('dhf_id')
      .notNull()
      .references(() => designHistoryFiles.id, { onDelete: 'cascade' }),
    // input_type CHECK: 'user_need'|'regulatory'|'standards'|'risk'
    inputType: text('input_type').notNull(),
    requirementId: text('requirement_id'),
    description: text('description').notNull(),
    source: text('source'),
    // priority CHECK: 'must'|'should'|'nice_to_have'
    priority: text('priority').notNull().default('must'),
    // verification_status CHECK: 'pending'|'verified'|'not_applicable'
    verificationStatus: text('verification_status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    dhfIdx: index('idx_design_inputs_dhf').on(t.dhfId),
  }),
);

// V&V protocols linked to a DHF (optionally to a design input).
export const designVerifications = pgTable(
  'design_verifications',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    dhfId: text('dhf_id')
      .notNull()
      .references(() => designHistoryFiles.id, { onDelete: 'cascade' }),
    designInputId: text('design_input_id').references(() => designInputs.id),
    // verification_type CHECK: 'analysis'|'test'|'inspection'|'demonstration'
    verificationType: text('verification_type').notNull(),
    protocolTitle: text('protocol_title').notNull(),
    // result CHECK: 'pass'|'fail'|'pending'|'not_started'
    result: text('result'),
    testDate: date('test_date'),
    performedBy: text('performed_by'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    dhfIdx: index('idx_design_verifications_dhf').on(t.dhfId),
  }),
);

// Formal design review records per DHF.
export const designReviews = pgTable(
  'design_reviews',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    dhfId: text('dhf_id')
      .notNull()
      .references(() => designHistoryFiles.id, { onDelete: 'cascade' }),
    // review_stage CHECK: 'concept'|'preliminary'|'critical'|'final'|'design_freeze'
    reviewStage: text('review_stage').notNull(),
    reviewDate: date('review_date').notNull(),
    attendees: text('attendees').array().notNull().default(sql`'{}'::text[]`),
    decisions: text('decisions'),
    openActions: text('open_actions'),
    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    dhfIdx: index('idx_design_reviews_dhf').on(t.dhfId),
  }),
);

// ---------------------------------------------------------------------------
// SPEC-REGULA-ESUBMIT-001: Electronic submission packages
// Migration: 0056_submission_packages.sql
// ---------------------------------------------------------------------------

// @MX:ANCHOR: [AUTO] Submission package table — fan_in >= 3 (list, detail, validate routes)
// @MX:REASON: [AUTO] Core entity for all e-submission workflows; schema changes affect all downstream routes
// @MX:SPEC SPEC-REGULA-ESUBMIT-001
export const submissionPackages = pgTable(
  'submission_packages',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // submission_type CHECK: '510k'|'de_novo'|'pma'|'cer'|'pccp'|'mfds_import'|'nmpa_ecdt'
    submissionType: text('submission_type').notNull(),
    // jurisdiction CHECK: 'FDA'|'EU'|'MFDS'|'NMPA'|'PMDA'
    jurisdiction: text('jurisdiction').notNull(),
    deviceName: text('device_name').notNull(),
    submissionNumber: text('submission_number'),
    version: text('version').notNull().default('1.0'),
    // status CHECK: 'draft'|'validating'|'validated'|'submitted'|'rta'|'accepted'|'rejected'
    status: text('status').notNull().default('draft'),
    packageManifest: jsonb('package_manifest').notNull().default(sql`'{}'::jsonb`),
    validationResults: jsonb('validation_results').notNull().default(sql`'[]'::jsonb`),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    submittedAt: timestamp('submitted_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('idx_submission_packages_org').on(t.orgId),
  }),
);

// Regulatory interaction history per submission package (RTA, AI requests, etc.)
export const submissionInteractions = pgTable(
  'submission_interactions',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    packageId: text('package_id')
      .notNull()
      .references(() => submissionPackages.id, { onDelete: 'cascade' }),
    // interaction_type CHECK: 'rta'|'ai_request'|'deficiency'|'approval'|'rejection'
    interactionType: text('interaction_type').notNull(),
    referenceNumber: text('reference_number'),
    description: text('description').notNull(),
    dueDate: date('due_date'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    pkgIdx: index('idx_submission_interactions_pkg').on(t.packageId),
  }),
);

// ---------------------------------------------------------------------------
// SPEC-REGULA-RISK-001 — ISO 14971 Risk Management tables
// Migration: 0057_risk_workflow_type.sql (workflowType 'risk')
//            0058_risk_tables.sql (riskLevelEnum, controlTierEnum, tables)
// ---------------------------------------------------------------------------

// Risk level classification per ISO 14971 Annex E
export const riskLevelEnum = pgEnum('risk_level', ['acc', 'alarp', 'unacc']);

// ISO 14971 §7.1 risk control option hierarchy
export const controlTierEnum = pgEnum('control_tier', ['inherent', 'protective', 'information']);

// @MX:ANCHOR [AUTO] riskItems — central risk analysis record.
// @MX:REASON Referenced by riskControls, riskGsprMappings, BFF routes, and report builder. fan_in >= 3.
// @MX:SPEC SPEC-REGULA-RISK-001 (T0.3, REQ-RISK-001~010)
export const riskItems = pgTable(
  'risk_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workflowRunId: uuid('workflow_run_id')
      .notNull()
      .references(() => workflowRuns.id, { onDelete: 'cascade' }),
    hazard: text('hazard').notNull(),
    sequenceOfEvents: text('sequence_of_events').notNull(),
    hazardousSituation: text('hazardous_situation').notNull(),
    harm: text('harm').notNull(),
    citation: jsonb('citation').notNull().default(sql`'[]'::jsonb`),
    severity: integer('severity').notNull(),
    probability: integer('probability').notNull(),
    riskLevel: riskLevelEnum('risk_level').notNull(),
    lowConfidence: boolean('low_confidence').notNull().default(false),
    editedBy: uuid('edited_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    runIdx: index('idx_risk_items_run').on(t.workflowRunId),
  }),
);

// Risk control measures per ISO 14971 §7.1
export const riskControls = pgTable(
  'risk_controls',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    riskItemId: uuid('risk_item_id')
      .notNull()
      .references(() => riskItems.id, { onDelete: 'cascade' }),
    tier: controlTierEnum('tier').notNull(),
    description: text('description').notNull(),
    rationale: text('rationale'),
    isAdopted: boolean('is_adopted').notNull().default(false),
    residualSeverity: integer('residual_severity'),
    residualProbability: integer('residual_probability'),
    residualRiskLevel: riskLevelEnum('residual_risk_level'),
    alarpJustification: text('alarp_justification'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    itemIdx: index('idx_risk_controls_item').on(t.riskItemId),
  }),
);

// EU MDR Annex I (GSPR) clause mappings
export const riskGsprMappings = pgTable(
  'risk_gspr_mappings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workflowRunId: uuid('workflow_run_id')
      .notNull()
      .references(() => workflowRuns.id, { onDelete: 'cascade' }),
    riskItemId: uuid('risk_item_id').references(() => riskItems.id, { onDelete: 'cascade' }),
    gsprClause: text('gspr_clause').notNull(),
    requirement: text('requirement').notNull(),
    compliance: text('compliance').notNull(),
    evidence: text('evidence').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    runIdx: index('idx_risk_gspr_run').on(t.workflowRunId),
  }),
);

// SPEC-REGULA-ESIG-001: Electronic signature records (21 CFR Part 11 §11.50/§11.70)
// Migration: 0061_answer_signatures.sql
// Each row links one signature to one message (answer) via record_hash (§11.70).
// At most one active (revoked_at IS NULL) signature per message_id (enforced by partial unique index).
export const answerSignatures = pgTable(
  'answer_signatures',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    // Signer identity fields (§11.50(a)(1))
    signerId: text('signer_id').notNull(),
    signerName: text('signer_name').notNull(),
    signerTitle: text('signer_title'),
    // Meaning of signature (§11.50(a)(3))
    meaning: text('meaning').notNull(),
    // SHA-256 hash of signed content (§11.70)
    recordHash: text('record_hash').notNull(),
    signedAt: timestamp('signed_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    // Revocation fields — null means the signature is active
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    revokedBy: text('revoked_by'),
  },
  (t) => ({
    // Performance: look up active signature for a given message
    messageIdx: index('idx_answer_signatures_message').on(t.messageId),
    // Performance: look up all signatures by signer (audit queries)
    signerIdx: index('idx_answer_signatures_signer').on(t.signerId),
  }),
);

// ---------------------------------------------------------------------------
// SPEC-REGULA-PERSONAL-LIB-001 — Personal RA Library (Issue #86)
// Migration: 0064_personal_bookmarks.sql
// User-scoped bookmarks for fast re-reference of answers/blocks.
// Private layer — every query MUST filter by userId (row-level isolation).
// ---------------------------------------------------------------------------

// @MX:ANCHOR [AUTO] personalBookmarks — user-private answer bookmark records.
// @MX:REASON Referenced by /api/ra/personal/* routes and the library view.
//            Privacy invariant: rows are isolated by userId at the query layer.
// @MX:SPEC SPEC-REGULA-PERSONAL-LIB-001 (REQ-PERSONAL-001..008)
export const personalBookmarks = pgTable(
  'personal_bookmarks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    blockId: uuid('block_id'),
    title: text('title').notNull(),
    customTitle: text('custom_title'),
    note: text('note').notNull().default(''),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('idx_personal_bookmarks_user').on(t.userId, t.createdAt),
    userTagsIdx: index('idx_personal_bookmarks_user_tags').on(t.userId, t.tags),
  }),
);

// ---------------------------------------------------------------------------
// SPEC-REGULA-CALENDAR-001 — Regulatory Calendar & Deadline Management (Issue #44)
// Migration: 0063_regulatory_deadlines.sql
// Project-scoped deadline tracker for FDA clocks, EU MDR renewals, ISO surveillance.
// ---------------------------------------------------------------------------

// @MX:NOTE [AUTO] regulatoryDeadlines — project-scoped regulatory deadline records.
// @MX:SPEC SPEC-REGULA-CALENDAR-001 (REQ-CAL-001..006)
export const regulatoryDeadlines = pgTable(
  'regulatory_deadlines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    deadlineType: text('deadline_type').notNull(),
    jurisdiction: text('jurisdiction').notNull(),
    dueDate: date('due_date', { mode: 'date' }).notNull(),
    status: text('status').notNull().default('upcoming'),
    reference: text('reference'),
    notes: text('notes').notNull().default(''),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    projectIdx: index('idx_regulatory_deadlines_project').on(t.projectId, t.dueDate),
    jurisdictionIdx: index('idx_regulatory_deadlines_jurisdiction').on(t.jurisdiction),
  }),
);

// ---------------------------------------------------------------------------
// SPEC-REGULA-TRACEABILITY-001 (Issue #47) — local evidence graph layer.
// Thin abstract graph over the existing tables: nodes reference rows via
// (ref_table, ref_id), edges encode typed relations, stale_flags propagate
// when a source/regulation is superseded. Drizzle mirrors of the SQL types
// created in 0068_traceability.sql — keep in lock-step or runtime inserts fail.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-001~003, REQ-TRACEABILITY-009)
// ---------------------------------------------------------------------------

export const evidenceNodeTypeEnum = pgEnum('evidence_node_type', [
  'source_section',
  'message_source',
  'message',
  'workflow_run',
  'expert_review',
  'submission_package',
  'risk_item',
  'regulatory_update',
]);

export const evidenceEdgeRelationEnum = pgEnum('evidence_edge_relation', [
  'derived_from',
  'cites',
  'reviewed_by',
  'exported_in',
  'mitigates',
  'satisfies',
]);

export const staleReasonEnum = pgEnum('stale_reason', [
  'superseded_source',
  'superseded_regulation',
]);

export const evidenceNodes = pgTable(
  'evidence_nodes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').notNull(),
    projectId: uuid('project_id'),
    nodeType: evidenceNodeTypeEnum('node_type').notNull(),
    refTable: text('ref_table').notNull(),
    refId: text('ref_id').notNull(),
    authority: text('authority'),
    version: text('version'),
    effectiveDate: timestamp('effective_date', { withTimezone: true, mode: 'date' }),
    reviewerId: uuid('reviewer_id'),
    artifactHash: text('artifact_hash'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    createdBy: uuid('created_by').notNull(),
  },
  (t) => ({
    refIdx: index('idx_evidence_nodes_ref').on(t.refTable, t.refId),
    projectIdx: index('idx_evidence_nodes_project').on(t.projectId),
    orgIdx: index('idx_evidence_nodes_org').on(t.orgId),
    refUnique: unique('uq_evidence_nodes_ref').on(t.orgId, t.nodeType, t.refTable, t.refId),
  }),
);

export const evidenceEdges = pgTable(
  'evidence_edges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').notNull(),
    fromNodeId: uuid('from_node_id').notNull(),
    toNodeId: uuid('to_node_id').notNull(),
    relation: evidenceEdgeRelationEnum('relation').notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    fromIdx: index('idx_evidence_edges_from').on(t.fromNodeId),
    toIdx: index('idx_evidence_edges_to').on(t.toNodeId),
    relationIdx: index('idx_evidence_edges_relation').on(t.relation),
    relationUnique: unique('uq_evidence_edges_relation').on(
      t.orgId,
      t.fromNodeId,
      t.toNodeId,
      t.relation,
    ),
  }),
);

export const staleFlags = pgTable(
  'stale_flags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').notNull(),
    nodeId: uuid('node_id').notNull(),
    reason: staleReasonEnum('reason').notNull(),
    propagatedFromNodeId: uuid('propagated_from_node_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    nodeIdx: index('idx_stale_flags_node').on(t.nodeId),
    orgIdx: index('idx_stale_flags_org').on(t.orgId),
    nodeReasonUnique: unique('uq_stale_flags_node_reason').on(t.nodeId, t.reason),
  }),
);

// SPEC-REGULA-PHI-REMOVAL-001 (Issue #319): pmsInputs + pmsDocuments tables
// removed. PMS/PMCF domain carried patient/clinical-subject data (complaint,
// vigilance, SUSAR, adverse-event rate, PMCF registry/subjects) which Regula
// does not handle. See migrations/0103_drop_pmcf_pms.sql.

// ---------------------------------------------------------------------------
// SPEC-REGULA-CHANGE-CONTROL-001 — Design Change RA Impact Assessor (Issue #54)
// Migration: 0071_change_control.sql
// REQ-CHANGE-CONTROL-001 (workflow_type) handled above in workflowTypeEnum.
// REQ-CHANGE-CONTROL-012 (audit_action) handled above in auditActionEnum.
// ---------------------------------------------------------------------------

// REQ-003: 6 change types — mirrors the migration CHECK constraint.
export const changeTypeEnum = pgEnum('change_type_enum', [
  'design',
  'material',
  'manufacturing_process',
  'software',
  'labeling',
  'intended_use',
]);

// REQ-004: 4 verdicts × REQ-005: 5 jurisdictions
export const changeVerdictEnum = pgEnum('change_verdict_enum', [
  'new_submission_required',
  'change_notification',
  'internal_record_only',
  'not_applicable',
]);

// REQ-009/REQ-011: provisional → reviewed → final lifecycle
export const changeAssessmentStatusEnum = pgEnum('change_assessment_status', [
  'provisional',
  'reviewed',
  'final',
]);

// @MX:ANCHOR [AUTO] changeAssessments — top-level change assessment record.
// @MX:REASON Referenced by change_verdicts, change_risk_links, BFF routes, and
//           report builder. fan_in >= 3.
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-CHANGE-CONTROL-002~004, REQ-010)
export const changeAssessments = pgTable(
  'change_assessments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').notNull(),
    projectId: uuid('project_id').notNull(),
    workflowRunId: uuid('workflow_run_id'),
    changeType: text('change_type').notNull(),
    description: text('description').notNull(),
    impactScope: text('impact_scope').notNull(),
    status: text('status').notNull().default('provisional'),
    // REQ-010: version metadata for rollback
    modelVersion: text('model_version').notNull(),
    promptVersion: text('prompt_version').notNull(),
    templateVersion: text('template_version').notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    projectIdx: index('idx_change_assessments_project').on(t.projectId),
    orgIdx: index('idx_change_assessments_org').on(t.orgId),
    runIdx: index('idx_change_assessments_run').on(t.workflowRunId),
  }),
);

// @MX:NOTE [AUTO] change_verdicts — per-jurisdiction verdict with rationale.
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-004, REQ-005)
export const changeVerdicts = pgTable(
  'change_verdicts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').notNull(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => changeAssessments.id, { onDelete: 'cascade' }),
    jurisdiction: text('jurisdiction').notNull(),
    verdict: text('verdict').notNull(),
    rationale: text('rationale').notNull(),
    confidence: text('confidence').notNull().default('unverified'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    assessmentIdx: index('idx_change_verdicts_assessment').on(t.assessmentId),
    orgIdx: index('idx_change_verdicts_org').on(t.orgId),
  }),
);

// @MX:ANCHOR [AUTO] change_verdict_citations — REQ-006 citation enforcement table.
// @MX:REASON excerpt is the DB-level NOT NULL defense (dual with validateVerdictCitations)
//           against LLM-hallucinated verdicts without a grounded regulatory excerpt.
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-006)
export const changeVerdictCitations = pgTable(
  'change_verdict_citations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').notNull(),
    verdictId: uuid('verdict_id')
      .notNull()
      .references(() => changeVerdicts.id, { onDelete: 'cascade' }),
    sourceSectionId: uuid('source_section_id'),
    // REQ-006: excerpt NOT NULL — DB-level defense. The migration also has a
    // CHECK (length(btrim(excerpt)) > 0) so empty/whitespace strings are rejected.
    excerpt: text('excerpt').notNull(),
    sourceLabel: text('source_label'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    verdictIdx: index('idx_change_verdict_citations_verdict').on(t.verdictId),
    orgIdx: index('idx_change_verdict_citations_org').on(t.orgId),
  }),
);

// @MX:NOTE [AUTO] change_risk_links — ISO 14971 (#46) risk re-evaluation linkage.
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-008). risk_items from SPEC-REGULA-RISK-001 (#46).
export const changeRiskLinks = pgTable(
  'change_risk_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').notNull(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => changeAssessments.id, { onDelete: 'cascade' }),
    riskItemId: uuid('risk_item_id')
      .notNull()
      .references(() => riskItems.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    assessmentIdx: index('idx_change_risk_links_assessment').on(t.assessmentId),
    orgIdx: index('idx_change_risk_links_org').on(t.orgId),
    riskItemIdx: index('idx_change_risk_links_risk_item').on(t.riskItemId),
  }),
);

// ---------------------------------------------------------------------------
// SPEC-REGULA-LABELING-001 — Labeling & IFU Structured Authoring (Issue #66)
// Migration: 0072_labeling.sql
// REQ-LABEL-001 (workflow_type) handled above in workflowTypeEnum.
// REQ-LABEL-010 (audit_action) handled above in auditActionEnum.
// ---------------------------------------------------------------------------

// REQ-001: 5 structured section types.
export const labelingSectionTypeEnum = pgEnum('labeling_section_type_enum', [
  'intended_use',
  'indication',
  'contraindication',
  'warning',
  'precaution',
]);

// REQ-005: claim classification — supported/comparative/superiority/unsupported.
export const labelingClaimTypeEnum = pgEnum('labeling_claim_type_enum', [
  'supported',
  'comparative',
  'superiority',
  'unsupported',
]);

// REQ-006: document lifecycle — draft → in_review → approved.
export const labelingDocumentStatusEnum = pgEnum('labeling_document_status', [
  'draft',
  'in_review',
  'approved',
  'rejected',
]);

// REQ-007: translation semantic-diff status (MVP heuristic).
export const labelingDiffStatusEnum = pgEnum('labeling_diff_status', [
  'match',
  'minor_diff',
  'major_diff',
  'review_required',
]);

// @MX:ANCHOR [AUTO] labelingDocuments — top-level labeling/IFU record per project.
// @MX:REASON Referenced by labeling_sections, labeling_claims (transitively),
//           BFF routes, change-control linkage, and export hub. fan_in >= 3.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-LABEL-001, REQ-LABEL-006, REQ-LABEL-012)
export const labelingDocuments = pgTable(
  'labeling_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').notNull(),
    projectId: uuid('project_id').notNull(),
    workflowRunId: uuid('workflow_run_id'),
    productName: text('product_name').notNull(),
    // REQ-002/011: jurisdiction drives the required-elements checklist
    jurisdiction: text('jurisdiction').notNull(),
    // REQ-006/012: approval gate
    status: text('status').notNull().default('draft'),
    approvedBy: uuid('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true, mode: 'date' }),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    projectIdx: index('idx_labeling_documents_project').on(t.projectId),
    orgIdx: index('idx_labeling_documents_org').on(t.orgId),
    runIdx: index('idx_labeling_documents_run').on(t.workflowRunId),
  }),
);

// @MX:NOTE [AUTO] labeling_sections — structured sections per document.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-LABEL-001)
export const labelingSections = pgTable(
  'labeling_sections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').notNull(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => labelingDocuments.id, { onDelete: 'cascade' }),
    sectionType: text('section_type').notNull(),
    content: text('content').notNull().default(''),
    locale: text('locale').notNull().default('en'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    documentIdx: index('idx_labeling_sections_document').on(t.documentId),
    orgIdx: index('idx_labeling_sections_org').on(t.orgId),
  }),
);

// @MX:ANCHOR [AUTO] labeling_claims — atomic claims linked to a section.
// @MX:REASON REQ-003/004: claim-citation enforcement (expert_review_required
//           when no grounded citation). REQ-005: comparative/superiority detection.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-LABEL-003, REQ-LABEL-004, REQ-LABEL-005)
export const labelingClaims = pgTable(
  'labeling_claims',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').notNull(),
    sectionId: uuid('section_id')
      .notNull()
      .references(() => labelingSections.id, { onDelete: 'cascade' }),
    claimText: text('claim_text').notNull(),
    claimType: text('claim_type').notNull().default('supported'),
    expertReviewRequired: boolean('expert_review_required').notNull().default(false),
    matchedKeywords: jsonb('matched_keywords'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    sectionIdx: index('idx_labeling_claims_section').on(t.sectionId),
    orgIdx: index('idx_labeling_claims_org').on(t.orgId),
    expertReviewIdx: index('idx_labeling_claims_expert_review').on(t.expertReviewRequired),
  }),
);

// @MX:ANCHOR [AUTO] labeling_claim_citations — REQ-003 citation enforcement table.
// @MX:REASON excerpt is the DB-level NOT NULL defense (dual with
//           validateClaimCitations) against claims without a grounded excerpt.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-LABEL-003)
export const labelingClaimCitations = pgTable(
  'labeling_claim_citations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').notNull(),
    claimId: uuid('claim_id')
      .notNull()
      .references(() => labelingClaims.id, { onDelete: 'cascade' }),
    sourceSectionId: uuid('source_section_id'),
    // REQ-003: excerpt NOT NULL — DB-level defense. Migration CHECK rejects empty.
    excerpt: text('excerpt').notNull(),
    sourceLabel: text('source_label'),
    citationId: text('citation_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    claimIdx: index('idx_labeling_claim_citations_claim').on(t.claimId),
    orgIdx: index('idx_labeling_claim_citations_org').on(t.orgId),
  }),
);

// @MX:NOTE [AUTO] labeling_translations — translated sections with semantic-diff.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-LABEL-007)
export const labelingTranslations = pgTable(
  'labeling_translations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').notNull(),
    sectionId: uuid('section_id')
      .notNull()
      .references(() => labelingSections.id, { onDelete: 'cascade' }),
    sourceLocale: text('source_locale').notNull(),
    targetLocale: text('target_locale').notNull(),
    sourceTextSnapshot: text('source_text_snapshot').notNull(),
    targetText: text('target_text').notNull(),
    semanticDiffStatus: text('semantic_diff_status').notNull().default('match'),
    diffDetails: jsonb('diff_details'),
    approvalStatus: text('approval_status').notNull().default('pending'),
    approvedBy: uuid('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true, mode: 'date' }),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    sectionIdx: index('idx_labeling_translations_section').on(t.sectionId),
    orgIdx: index('idx_labeling_translations_org').on(t.orgId),
  }),
);

// ---------------------------------------------------------------------------
// SPEC-REGULA-CAPA-001 — Complaint → CAPA closed-loop management.
// REMOVED by SPEC-REGULA-PHI-REMOVAL-001: complaintReportabilityStatusEnum, complaints,
// capaRecords, capaRootCauses, capaLinks, capaEffectivenessChecks dropped (Regula does
// not handle patient outcomes). workflow_type 'complaint' + audit_action capa.* enum
// values retained (Postgres enum value removal is invasive; unused values are harmless).
// Migration: 0102_drop_phivigilance_capa_tables.sql
// ---------------------------------------------------------------------------

// @MX:NOTE [AUTO] Clinical Investigation enums — SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69).
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (REQ-CLININV-001~012)
// @MX:REASON Drizzle pgEnum mirrors the SQL types created in 0076_clinical_investigation.sql.
// Keep in lock-step with the migration or runtime inserts fail.
export const ciPathwayEnum = pgEnum('ci_pathway', ['fda_ide', 'eu_mdr']);
export const ciDocTypeEnum = pgEnum('ci_doc_type', [
  'irb_package',
  'consent',
  'brochure',
  'monitoring_plan',
]);
export const ciEventTypeEnum = pgEnum('ci_event_type', ['milestone', 'deviation']);
// SPEC-REGULA-PHI-REMOVAL-001 (Issue #319): 'pms' removed — pms_inputs dropped.
export const ciLinkTargetTypeEnum = pgEnum('ci_link_target_type', ['cer', 'dhf']);

// SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-001~012).
// @MX:NOTE [AUTO] clinical_investigations — root table of the CI planner domain.
// @MX:REASON All 5 CI tables are org_id-scoped (tenant isolation, L-007 cross-SPEC lesson:
//   tables without org_id caused CAPA C-1 defect). pathway is nullable until the user
//   commits to FDA IDE or EU MDR (REQ-002/003). necessity_status drives the gap-assessment
//   output (REQ-001); approval_status gates the expert-signoff close (REQ-012, AC-07).
export const clinicalInvestigations = pgTable(
  'clinical_investigations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    pathway: ciPathwayEnum('pathway'),
    necessityStatus: text('necessity_status').notNull().default('pending'),
    necessityRationale: text('necessity_rationale'),
    approvalStatus: text('approval_status').notNull().default('draft'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('idx_clinical_investigations_org').on(t.orgId),
    projectIdx: index('idx_clinical_investigations_project').on(t.projectId),
    statusIdx: index('idx_clinical_investigations_status').on(t.approvalStatus),
  }),
);

// SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-005).
// ci_protocols — protocol synopsis/endpoint/inclusion-exclusion criteria (AC-06).
export const ciProtocols = pgTable(
  'ci_protocols',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => clinicalInvestigations.id, { onDelete: 'cascade' }),
    synopsis: text('synopsis'),
    endpoints: jsonb('endpoints').notNull().default({}),
    inclusionCriteria: jsonb('inclusion_criteria').notNull().default([]),
    exclusionCriteria: jsonb('exclusion_criteria').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    investigationIdx: index('idx_ci_protocols_investigation').on(t.investigationId),
    orgIdx: index('idx_ci_protocols_org').on(t.orgId),
  }),
);

// SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-004/006/007).
// ci_documents — IRB/EC package draft, informed consent, investigator brochure,
// monitoring plan. doc_type is a typed enum; content holds the generated draft text.
export const ciDocuments = pgTable(
  'ci_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => clinicalInvestigations.id, { onDelete: 'cascade' }),
    docType: ciDocTypeEnum('doc_type').notNull(),
    content: text('content').notNull().default(''),
    reviewStatus: text('review_status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    investigationIdx: index('idx_ci_documents_investigation').on(t.investigationId),
    orgIdx: index('idx_ci_documents_org').on(t.orgId),
    typeIdx: index('idx_ci_documents_type').on(t.docType),
  }),
);

// SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-008).
// ci_events — milestone / deviation. SPEC-REGULA-PHI-REMOVAL-001 removed the
// adverse_event type + vigilance_ref coupling (Regula does not handle patient
// outcomes).
export const ciEvents = pgTable(
  'ci_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => clinicalInvestigations.id, { onDelete: 'cascade' }),
    type: ciEventTypeEnum('type').notNull(),
    data: jsonb('data').notNull().default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    investigationIdx: index('idx_ci_events_investigation').on(t.investigationId),
    orgIdx: index('idx_ci_events_org').on(t.orgId),
    typeIdx: index('idx_ci_events_type').on(t.type),
  }),
);

// SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-009, AC-04).
// ci_links — forward-compatibility hook linking investigation results to CER/PMS/DHF
// deliverables. Mirrors lib/pms/cer-linkage.ts project-scoped linkage pattern.
export const ciLinks = pgTable(
  'ci_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => clinicalInvestigations.id, { onDelete: 'cascade' }),
    targetType: ciLinkTargetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    investigationIdx: index('idx_ci_links_investigation').on(t.investigationId),
    orgIdx: index('idx_ci_links_org').on(t.orgId),
    targetIdx: index('idx_ci_links_target').on(t.targetType, t.targetId),
  }),
);

// @MX:NOTE [AUTO] Model Governance enums — SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (REQ-MODELGOV-001~014)
// @MX:REASON Drizzle pgEnum mirrors the SQL types created in 0077_model_governance.sql.
// Keep in lock-step with the migration or runtime inserts fail.
export const modelgovKindEnum = pgEnum('modelgov_kind', ['prompt', 'template']);
export const evalStatusEnum = pgEnum('eval_status', ['pending', 'passed', 'failed']);
export const modelgovApprovalStatusEnum = pgEnum('modelgov_approval_status', [
  'pending_review',
  'approved',
  'rejected',
]);

// @MX:NOTE [AUTO] prompt_registry — immutable prompt/template version store (REQ-MODELGOV-001).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (REQ-MODELGOV-001)
// @MX:REASON Insert-only by convention (lib/model-governance/registry.ts enforces).
//           content_hash deduplicates identical content. Never UPDATE — only new versions.
//           RLS org-isolation enforced in 0077_model_governance.sql.
export const promptRegistry = pgTable(
  'prompt_registry',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    kind: modelgovKindEnum('kind').notNull(),
    contentHash: text('content_hash').notNull(),
    content: text('content').notNull(),
    version: integer('version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => ({
    orgKindHashIdx: index('idx_prompt_registry_org_kind_hash').on(t.orgId, t.kind, t.contentHash),
    orgKindVersionIdx: index('idx_prompt_registry_org_kind_version').on(t.orgId, t.kind, t.version),
  }),
);

// @MX:NOTE [AUTO] model_pin — pinned model provider/id/version + retrieval_config (REQ-MODELGOV-002/003).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (REQ-MODELGOV-002, REQ-MODELGOV-003)
export const modelPin = pgTable(
  'model_pin',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    modelId: text('model_id').notNull(),
    modelVersion: text('model_version').notNull(),
    retrievalConfig: jsonb('retrieval_config').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => ({
    orgIdx: index('idx_model_pin_org').on(t.orgId),
  }),
);

// @MX:NOTE [AUTO] change_request — eval -> approval workflow (REQ-MODELGOV-004/005/010/011).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (REQ-MODELGOV-004, REQ-MODELGOV-005)
export const changeRequest = pgTable(
  'change_request',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    promptId: uuid('prompt_id').references(() => promptRegistry.id, { onDelete: 'restrict' }),
    modelPinId: uuid('model_pin_id').references(() => modelPin.id, { onDelete: 'restrict' }),
    evalRunId: text('eval_run_id'),
    evalStatus: evalStatusEnum('eval_status').notNull().default('pending'),
    evalResultRef: text('eval_result_ref'),
    approvalStatus: modelgovApprovalStatusEnum('approval_status')
      .notNull()
      .default('pending_review'),
    approverId: uuid('approver_id').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => ({
    orgIdx: index('idx_change_request_org').on(t.orgId),
    orgStatusIdx: index('idx_change_request_org_status').on(t.orgId, t.approvalStatus),
  }),
);

// @MX:NOTE [AUTO] approved_combination — the active approved prompt+model pair (REQ-MODELGOV-013).
// @MX:ANCHOR [AUTO] Single-active per org enforced by partial UNIQUE INDEX in 0077_model_governance.sql.
// @MX:REASON REQ-MODELGOV-013 — exactly one active combination per org. Mirrors PCCP
//           single-active pattern (lib/pccp/version-manager.ts). fan_in >= 3 expected
//           (approve route, rollback route, combination-resolver).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (REQ-MODELGOV-013, REQ-MODELGOV-006)
export const approvedCombination = pgTable(
  'approved_combination',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    promptId: uuid('prompt_id')
      .notNull()
      .references(() => promptRegistry.id, { onDelete: 'restrict' }),
    modelPinId: uuid('model_pin_id')
      .notNull()
      .references(() => modelPin.id, { onDelete: 'restrict' }),
    active: boolean('active').notNull().default(false),
    approvedAt: timestamp('approved_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    supersededBy: uuid('superseded_by'),
    changeRequestId: uuid('change_request_id').references(() => changeRequest.id, {
      onDelete: 'set null',
    }),
  },
  (t) => ({
    orgActiveIdx: index('idx_approved_combination_org_active').on(t.orgId, t.active),
  }),
);

// ===========================================================================
// SPEC-REGULA-CYBERDEVICE-001 (Issue 67, REQ-CYBERDEVICE-001~014)
// Medical-device cybersecurity & SBOM submission evidence.
// 4 tables (threat_model, sbom, cve_impact, cyber_evidence_bundle) + 2 enums.
// All org_id + project_id scoped (RLS via app.current_org_id, mirror 0067-0077).
// ===========================================================================

// REQ-CYBERDEVICE-003: SBOM interchange format.
export const sbomFormatEnum = pgEnum('sbom_format', ['spdx', 'cyclonedx']);

// REQ-CYBERDEVICE-005: CVSS v3.1 base-score severity bands.
export const cveSeverityEnum = pgEnum('cve_severity', [
  'none',
  'low',
  'medium',
  'high',
  'critical',
]);

// @MX:NOTE [AUTO] threatModel — product-architecture-driven threat model (REQ-001/002/008).
export const threatModel = pgTable(
  'threat_model',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    architectureInput: jsonb('architecture_input').notNull(),
    threats: jsonb('threats').notNull().default({}),
    gsprMapping: jsonb('gspr_mapping').notNull().default({}),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    orgProjectIdx: index('idx_threat_model_org_project').on(t.orgId, t.projectId),
  }),
);

// @MX:NOTE [AUTO] sbom — imported software bill of materials (REQ-003/004).
export const sbom = pgTable(
  'sbom',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    format: sbomFormatEnum('format').notNull(),
    version: text('version').notNull(),
    components: jsonb('components').notNull().default([]),
    validated: boolean('validated').notNull().default(false),
    contentHash: text('content_hash').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    orgProjectIdx: index('idx_sbom_org_project').on(t.orgId, t.projectId),
    orgProjectVersionIdx: index('idx_sbom_org_project_version').on(t.orgId, t.projectId, t.version),
  }),
);

// @MX:NOTE [AUTO] cveImpact — CVE/KEV impact on a product component (REQ-005/006/010/011).
export const cveImpact = pgTable(
  'cve_impact',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    cveId: text('cve_id').notNull(),
    kevFlag: boolean('kev_flag').notNull().default(false),
    affectedComponentRef: text('affected_component_ref').notNull(),
    severity: cveSeverityEnum('severity').notNull().default('none'),
    mitigation: text('mitigation'),
    // REQ-010: nullable FK to risk_items for ISO 14971 residual risk linkage.
    riskItemId: uuid('risk_item_id').references(() => riskItems.id, { onDelete: 'set null' }),
    sbomId: uuid('sbom_id').references(() => sbom.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    orgProjectIdx: index('idx_cve_impact_org_project').on(t.orgId, t.projectId),
    cveIdx: index('idx_cve_impact_cve').on(t.orgId, t.cveId),
    riskItemIdx: index('idx_cve_impact_risk_item').on(t.riskItemId),
  }),
);

// @MX:NOTE [AUTO] cyberEvidenceBundle — assembled cybersecurity evidence packet (REQ-009/012/014).
// Links threat model + SBOM + pen-test artifact + update plan to SaMD/DHF/Submission.
export const cyberEvidenceBundle = pgTable(
  'cyber_evidence_bundle',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    threatModelId: uuid('threat_model_id').references(() => threatModel.id, {
      onDelete: 'set null',
    }),
    sbomId: uuid('sbom_id').references(() => sbom.id, { onDelete: 'set null' }),
    pentestArtifactPath: text('pentest_artifact_path'),
    updatePlan: jsonb('update_plan').notNull().default({}),
    // Downstream linkages (Issue #63 SaMD, #64 DHF, #65 Submission) are opaque
    // uuid columns for tier1 — FK constraints added when those tables land.
    linkedSamdId: uuid('linked_samd_id'),
    linkedDhfId: uuid('linked_dhf_id'),
    linkedSubmissionId: uuid('linked_submission_id'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    orgProjectIdx: index('idx_cyber_evidence_bundle_org_project').on(t.orgId, t.projectId),
    samdIdx: index('idx_cyber_evidence_bundle_samd').on(t.linkedSamdId),
    dhfIdx: index('idx_cyber_evidence_bundle_dhf').on(t.linkedDhfId),
    submissionIdx: index('idx_cyber_evidence_bundle_submission').on(t.linkedSubmissionId),
  }),
);

// @MX:NOTE [AUTO] Corpus license enums — SPEC-REGULA-CORPUS-LICENSE-001 (Issue #72).
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-001, REQ-CORPUSLIC-006)
// @MX:REASON Drizzle pgEnum mirrors the SQL types created in 0080_corpus_license.sql.
// Keep in lock-step with the migration or runtime inserts fail.
// license_type: permitted-use policy group (paid standard / journal / internal SOP / open).
// confidentiality_level: trade-secret protection scoping for internal SOPs.
// entitlement_status: active / revoked / expired lifecycle for source access grants.
export const licenseTypeEnum = pgEnum('license_type', [
  'standard_paid',
  'journal',
  'internal_sop',
  'open',
]);
export const confidentialityLevelEnum = pgEnum('confidentiality_level', [
  'public',
  'internal',
  'trade_secret',
]);
export const entitlementStatusEnum = pgEnum('entitlement_status', ['active', 'revoked', 'expired']);

// @MX:NOTE [AUTO] source_license — per-source license metadata gating ingest/search/export (REQ-CORPUSLIC-001).
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-001~014)
// Links to #48 Source Governance (sources.id). permitted_use JSONB boolean map
// is evaluated by lib/corpus-license/license-gate.ts before embedding/ingest.
export const sourceLicense = pgTable(
  'source_license',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    licenseType: licenseTypeEnum('license_type').notNull(),
    entitlementRef: text('entitlement_ref'),
    permittedUse: jsonb('permitted_use').notNull().default({
      ingest: true,
      embed: true,
      search: true,
      summarize: true,
      export: true,
    }),
    fullTextAllowed: boolean('full_text_allowed').notNull().default(true),
    abstractOnly: boolean('abstract_only').notNull().default(false),
    confidentialityLevel: confidentialityLevelEnum('confidentiality_level')
      .notNull()
      .default('internal'),
    expiryDate: date('expiry_date'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    sourceUnique: unique('idx_source_license_source_unique').on(t.sourceId),
    orgIdx: index('idx_source_license_org').on(t.orgId),
    expiryIdx: index('idx_source_license_expiry').on(t.orgId, t.expiryDate),
  }),
);

// @MX:NOTE [AUTO] entitlement — grant/revoke lifecycle for a source_license (REQ-CORPUSLIC-008).
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-008)
// status 'revoked' / 'expired' excludes the source from corpus search.
export const entitlement = pgTable(
  'entitlement',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    sourceLicenseId: uuid('source_license_id')
      .notNull()
      .references(() => sourceLicense.id, { onDelete: 'cascade' }),
    status: entitlementStatusEnum('status').notNull().default('active'),
    grantedBy: uuid('granted_by')
      .notNull()
      .references(() => users.id),
    grantedAt: timestamp('granted_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    revokedBy: uuid('revoked_by').references(() => users.id),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => ({
    orgIdx: index('idx_entitlement_org').on(t.orgId),
    licenseIdx: index('idx_entitlement_license').on(t.sourceLicenseId),
    statusIdx: index('idx_entitlement_status').on(t.orgId, t.status),
  }),
);

// @MX:NOTE [AUTO] Standards enums — SPEC-REGULA-STANDARDS-001 (Issue #62).
// @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-STANDARDS-008, REQ-STANDARDS-013, REQ-STANDARDS-015, REQ-STANDARDS-017)
// @MX:REASON Drizzle pgEnum mirrors the SQL types created in 0088_standards.sql.
// Keep in lock-step with the migration or runtime inserts fail.
// standards_body: publisher (ISO/IEC/CEN/ASTM/other).
// recognition_status: FDA recognition state — 'withdrawn' triggers warn+alternative (AC-06).
// compliance_status: product×standard state for gap analysis (REQ-013).
// alert_tier: notification routing for transition milestones (D-12/D-6/D-3, REQ-017/018).
export const standardsBodyEnum = pgEnum('standards_body', ['ISO', 'IEC', 'CEN', 'ASTM', 'other']);
export const standardsRecognitionStatusEnum = pgEnum('standards_recognition_status', [
  'recognized',
  'not_recognized',
  'withdrawn',
  'unknown',
]);
export const standardsComplianceStatusEnum = pgEnum('standards_compliance_status', [
  'compliant',
  'gap',
  'unknown',
  'not_applicable',
]);
export const standardsAlertTierEnum = pgEnum('standards_alert_tier', ['info', 'warn', 'critical']);

// @MX:NOTE [AUTO] standards_org_catalog — org-scoped catalog metadata (REQ-STANDARDS-008).
// @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-STANDARDS-008, AC-01 PARTIAL)
// Metadata only — full text NEVER stored (copyright). source_url links to publisher.
// source='seed' | 'fda_api' | 'eu_oj' | 'manual' (Charter [지양-2] provenance).
// Named standards_org_catalog to coexist with the pre-existing global
// standards_catalog (migration 0047) — this table is org-scoped (RLS + org_id).
export const standardsOrgCatalog = pgTable(
  'standards_org_catalog',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    standardNumber: text('standard_number').notNull(),
    title: text('title').notNull(),
    version: text('version').notNull(),
    body: standardsBodyEnum('body').notNull(),
    status: text('status').notNull().default('current'),
    recognitionStatus: standardsRecognitionStatusEnum('recognition_status')
      .notNull()
      .default('unknown'),
    euHarmonized: boolean('eu_harmonized').notNull().default(false),
    source: text('source').notNull().default('seed'),
    sourceUrl: text('source_url'),
    scopeKeywords: text('scope_keywords').array().notNull().default(sql`ARRAY[]::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    orgNumberVersionUnique: unique('standards_org_catalog_org_number_version_unique').on(
      t.orgId,
      t.standardNumber,
      t.version,
    ),
    orgBodyIdx: index('idx_standards_org_catalog_org_body').on(t.orgId, t.body),
    orgNumberIdx: index('idx_standards_org_catalog_org_number').on(t.orgId, t.standardNumber),
  }),
);

// @MX:NOTE [AUTO] standards_org_applicability — device_profile → standard mapping rules (REQ-STANDARDS-001/004/005/006).
// @MX:SPEC SPEC-REGULA-STANDARDS-001
// rule_source='builtin' for engine defaults; 'custom' for org overrides.
// pathway narrows to a regulatory pathway (fda_510k, eu_mdr_class_iii, ...).
export const standardsOrgApplicability = pgTable(
  'standards_org_applicability',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    deviceProfileKey: text('device_profile_key').notNull(),
    standardId: uuid('standard_id')
      .notNull()
      .references(() => standardsOrgCatalog.id, { onDelete: 'cascade' }),
    isMandatory: boolean('is_mandatory').notNull().default(true),
    applicabilityReason: text('applicability_reason').notNull(),
    pathway: text('pathway').notNull().default('all'),
    ruleSource: text('rule_source').notNull().default('builtin'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    orgProfilePathStandardUnique: unique(
      'standards_org_applicability_org_profile_pathway_standard_unique',
    ).on(t.orgId, t.deviceProfileKey, t.pathway, t.standardId),
    orgProfileIdx: index('idx_standards_org_applicability_org_profile').on(
      t.orgId,
      t.deviceProfileKey,
    ),
  }),
);

// @MX:NOTE [AUTO] standards_updates — revision history + transition timeline (REQ-STANDARDS-009/010/011).
// @MX:SPEC SPEC-REGULA-STANDARDS-001
// oj_publication_date / date_of_withdrawal drive D-12/D-6/D-3 alerts (AC-05).
// alert_tier is the current tier for notification routing.
export const standardsUpdates = pgTable(
  'standards_updates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    standardId: uuid('standard_id')
      .notNull()
      .references(() => standardsOrgCatalog.id, { onDelete: 'cascade' }),
    revisionLabel: text('revision_label').notNull(),
    ojPublicationDate: date('oj_publication_date'),
    dateOfWithdrawal: date('date_of_withdrawal'),
    transitionEndDate: date('transition_end_date'),
    impactSummary: text('impact_summary'),
    detectedAt: timestamp('detected_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    source: text('source').notNull().default('manual'),
    alertTier: standardsAlertTierEnum('alert_tier').notNull().default('info'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    orgStandardIdx: index('idx_standards_updates_org_standard').on(t.orgId, t.standardId),
    orgAlertIdx: index('idx_standards_updates_org_alert').on(t.orgId, t.alertTier),
  }),
);

// @MX:NOTE [AUTO] product_standards_compliance — product×standard compliance state (REQ-STANDARDS-013).
// @MX:SPEC SPEC-REGULA-STANDARDS-001
// product_id weak reference (no FK) to avoid cross-SPEC migration coupling.
// last_assessed_at drives staleness checks in gap analysis.
export const productStandardsCompliance = pgTable(
  'product_standards_compliance',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').notNull(),
    standardId: uuid('standard_id')
      .notNull()
      .references(() => standardsOrgCatalog.id, { onDelete: 'cascade' }),
    complianceStatus: standardsComplianceStatusEnum('compliance_status')
      .notNull()
      .default('unknown'),
    lastAssessedAt: timestamp('last_assessed_at', { withTimezone: true, mode: 'date' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    orgProductStandardUnique: unique('product_standards_compliance_org_product_standard_unique').on(
      t.orgId,
      t.productId,
      t.standardId,
    ),
    orgProductIdx: index('idx_product_standards_compliance_org_product').on(t.orgId, t.productId),
    orgStatusIdx: index('idx_product_standards_compliance_org_status').on(
      t.orgId,
      t.complianceStatus,
    ),
  }),
);

// Issue #307: 설정 지식베이스 연결 (git repo 동기화 설정). 코퍼스 청크는 sources/source_sections.
export const knowledgeSources = pgTable('knowledge_sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  gitUrl: text('git_url').notNull(),
  branch: text('branch').notNull().default('main'),
  sourceHost: text('source_host'),
  sourceOwner: text('source_owner'),
  sourceRepo: text('source_repo'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'date' }),
  syncStatus: text('sync_status').notNull().default('idle'),
  authTokenEncrypted: text('auth_token_encrypted'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// SPEC-V3-INBOX-001 — RA Inbox (4-column Kanban + Triage State Machine)
// Migration 0104: inbox_tickets + approved_answers tables
// ---------------------------------------------------------------------------

// inbox_tickets table (REQ-V3-INBOX-001)
export const inboxTickets = pgTable(
  'inbox_tickets',
  {
    id: text('id').primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    fromUser: uuid('from_user')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    productId: text('product_id'),
    tags: text('tags').array(),
    triageState: text('triage_state')
      .notNull()
      .$type<'auto' | 'needs-review' | 'escalated' | 'waiting' | 'closed' | 'rejected'>(),
    autoAnswer: text('auto_answer'),
    autoConfidence: numeric('auto_confidence', { precision: 5, scale: 2 }),
    raAssignee: uuid('ra_assignee').references(() => users.id, { onDelete: 'set null' }),
    escalateTo: text('escalate_to'),
    finalAnswer: text('final_answer'),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true, mode: 'date' }),
    slaDeadline: timestamp('sla_deadline', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => ({
    triageStateSlaDeadlineIdx: index('inbox_tickets_triage_state_sla_deadline_idx').on(
      t.triageState,
      t.slaDeadline,
    ),
    fromUserIdx: index('inbox_tickets_from_user_idx').on(t.fromUser),
    orgIdIdx: index('inbox_tickets_org_id_idx').on(t.orgId),
  }),
);

// approved_answers table (REQ-V3-INBOX-026)
export const approvedAnswers = pgTable(
  'approved_answers',
  {
    id: text('id').primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    category: text('category'),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    citations: jsonb('citations')
      .$type<{ source: string; quote?: string }[]>()
      .default(sql`'[]'::jsonb`),
    esigSignature: text('esig_signature'), // §11.70 signature-record binding (Issue 321, C-1)
    hits: integer('hits').default(0),
    state: text('state')
      .notNull()
      .$type<'draft' | 'published' | 'deprecated'>()
      .default('published'),
    fromTicket: text('from_ticket')
      .notNull()
      .references(() => inboxTickets.id, { onDelete: 'cascade' }),
    publishedBy: uuid('published_by').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    stateIdx: index('approved_answers_state_idx').on(t.state),
    ftsIdx: index('approved_answers_fts_idx').using(
      'gin',
      sql`to_tsvector('simple', ${t.question} || ' ' || ${t.answer})`,
    ),
  }),
);

// SPEC-V3-CONSULT-001 (REQ-CONS-001, Issue 341): consult_sessions — RA Power Chat.
// v2 호환성 (R-01): ISOLATED from conversations/messages. Legacy /api/ra/consult
// 1-shot SSE route is untouched. v3 stores multi-turn RA deep-research sessions.
// 5년 보관 (MDR Art. 10(8)) — soft-delete via deletedAt (REQ-CONS-006).
export const consultSessions = pgTable(
  'consult_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    locale: text('locale').notNull().default('ko'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => ({
    // @MX:NOTE [AUTO] REQ-CONS-002 — org-scoped session list (ra-lead/admin see all).
    orgIdx: index('consult_sessions_org_id_idx').on(t.orgId),
    // @MX:NOTE [AUTO] REQ-CONS-002 — ra-member sees only own sessions.
    userIdx: index('consult_sessions_user_id_idx').on(t.userId),
    // @MX:NOTE [AUTO] REQ-CONS-002 — newest-first ordering.
    createdIdx: index('consult_sessions_created_at_idx').on(t.createdAt),
  }),
);

// SPEC-V3-CONSULT-001 (REQ-CONS-004, Issue 341): consult_turns — Exchange model (H-1).
// 한 turn = 한 Q+A pair. role 필드 없음. UNIQUE(session_id, turn_number)로
// 동시 POST 시 turnNumber 충돌 방지 (R-05 완화 — DB 제약 + tx retry).
export const consultTurns = pgTable(
  'consult_turns',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => consultSessions.id, { onDelete: 'cascade' }),
    turnNumber: integer('turn_number').notNull(),
    question: text('question').notNull(),
    answer: text('answer'),
    citations: jsonb('citations')
      .$type<{ source: string; quote?: string }[]>()
      .notNull()
      .default([]),
    sources: jsonb('sources')
      .$type<{ sourceId: string; sourceLabel?: string; quote?: string }[]>()
      .notNull()
      .default([]),
    confidence: real('confidence'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    // @MX:NOTE [AUTO] REQ-CONS-003 — session detail turns array, turnNumber asc (AC-CONS-02b).
    sessionTurnIdx: uniqueIndex('consult_turns_session_turn_idx').on(t.sessionId, t.turnNumber),
  }),
);
