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
  text,
  timestamp,
  unique,
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
  // SPEC-REGULA-PMS-001 (Issue #53): EU MDR Article 83-86 PMS/PMCF audit trail.
  'pms.report_created',
  'pms.compliance_checked',
  'pms.report_exported',
  'pms.report_export_denied',
  'pms.report_closed',
  'pms.input_uploaded',
  'pmcf.plan_created',
  'pmcf.evaluation_drafted',
  'pms.cer_linked',
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
]);

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
  'pms_report',
  'pmcf_plan',
  'pmcf_evaluation',
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
// SPEC-REGULA-VIGILANCE-001 — Post-Market Surveillance tables (3).
// Migration: 0041_vigilance_tables.sql
// ---------------------------------------------------------------------------

// REQ-VIG-001: adverse_events — captures raw adverse event input data.
export const adverseEvents = pgTable('adverse_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  workflowRunId: uuid('workflow_run_id').references(() => workflowRuns.id, {
    onDelete: 'cascade',
  }),
  eventDate: date('event_date').notNull(),
  deviceName: text('device_name').notNull(),
  deviceModel: text('device_model'),
  lotNumber: text('lot_number'),
  eventDescription: text('event_description').notNull(),
  patientOutcome: text('patient_outcome').notNull(),
  awarenessDate: date('awareness_date').notNull(),
  reporterName: text('reporter_name').notNull(),
  reporterRole: text('reporter_role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  createdBy: text('created_by').notNull(),
});

// REQ-VIG-002: reportability_assessments — deterministic rule engine output.
export const reportabilityAssessments = pgTable('reportability_assessments', {
  id: uuid('id').defaultRandom().primaryKey(),
  adverseEventId: uuid('adverse_event_id')
    .notNull()
    .references(() => adverseEvents.id, { onDelete: 'cascade' }),
  fdaMdrRequired: boolean('fda_mdr_required').notNull(),
  fdaMdrDeadlineDays: integer('fda_mdr_deadline_days'),
  euMdvRequired: boolean('eu_mdv_required').notNull(),
  euMdvDeadlineDays: integer('eu_mdv_deadline_days'),
  fscaRequired: boolean('fsca_required').notNull(),
  assessmentRationale: text('assessment_rationale').notNull(),
  assessedByAi: boolean('assessed_by_ai').notNull().default(true),
  reviewedBy: text('reviewed_by'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// REQ-VIG-003: vigilance_reports — AI-generated report draft content.
export const vigilanceReports = pgTable('vigilance_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  adverseEventId: uuid('adverse_event_id')
    .notNull()
    .references(() => adverseEvents.id, { onDelete: 'cascade' }),
  // report_type: 'fda_mdr' | 'eu_mdv' | 'fsca'
  reportType: text('report_type').notNull(),
  // report_format: 'mdr_3500a' | 'eu_mdv_initial' | 'eu_mdv_final' | 'fsca_notice'
  reportFormat: text('report_format').notNull(),
  draftContent: jsonb('draft_content').notNull().default({}),
  version: integer('version').notNull().default(1),
  // status: 'draft' | 'reviewed' | 'submitted'
  status: text('status').notNull().default('draft'),
  submissionDeadline: date('submission_deadline'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

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

// @MX:NOTE [AUTO] PMS inputs/documents — SPEC-REGULA-PMS-001 (Issue #53).
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-001, REQ-PMS-005, REQ-PMS-006)
// complaint/vigilance data inputs and generated PMSR/PMCF documents. Both
// isolated per org via RLS on app.current_org_id (0068 pattern). org_id has
// no inline FK here — the migration owns the REFERENCES constraint; Drizzle
// mirrors columns only for query typing.
export const pmsInputs = pgTable(
  'pms_inputs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').notNull(),
    projectId: uuid('project_id').notNull(),
    source: text('source').notNull(),
    severity: text('severity'),
    susarFlag: boolean('susar_flag').notNull().default(false),
    trendCategory: text('trend_category'),
    payload: jsonb('payload').notNull().default({}),
    uploadedBy: uuid('uploaded_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    projectIdx: index('idx_pms_inputs_project').on(t.projectId),
    orgIdx: index('idx_pms_inputs_org').on(t.orgId),
  }),
);

export const pmsDocuments = pgTable(
  'pms_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').notNull(),
    projectId: uuid('project_id').notNull(),
    workflowRunId: uuid('workflow_run_id'),
    workflowType: workflowTypeEnum('workflow_type').notNull(),
    cerRef: uuid('cer_ref'),
    body: jsonb('body').notNull().default({}),
    complianceStatus: text('compliance_status').notNull().default('pending'),
    reviewStatus: text('review_status').notNull().default('draft'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    projectIdx: index('idx_pms_documents_project').on(t.projectId),
    orgIdx: index('idx_pms_documents_org').on(t.orgId),
    workflowIdx: index('idx_pms_documents_workflow').on(t.workflowRunId),
  }),
);

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
// SPEC-REGULA-CAPA-001 — Complaint → CAPA closed-loop management
// Migration: 0073_capa.sql
// REQ-CAPA-001 (workflow_type 'complaint') handled above in workflowTypeEnum.
// REQ-CAPA-010 (audit_action) handled above in auditActionEnum.
// ---------------------------------------------------------------------------

// REQ-002: complaint reportability lifecycle.
export const complaintReportabilityStatusEnum = pgEnum('complaint_reportability_status', [
  'pending',
  'reportable',
  'not_reportable',
]);

// REQ-004: corrective vs preventive action split.
export const capaTypeEnum = pgEnum('capa_type', ['corrective', 'preventive']);

// REQ-005: CAPA status lifecycle.
export const capaStatusEnum = pgEnum('capa_status', [
  'open',
  'in_progress',
  'pending_effectiveness',
  'closed',
  'cancelled',
]);

// REQ-005: effectiveness check result.
export const capaEffectivenessStatusEnum = pgEnum('capa_effectiveness_status', [
  'pending',
  'passed',
  'failed',
]);

// @MX:ANCHOR [AUTO] complaints — top-level structured complaint intake record.
// @MX:REASON Referenced by capa_records, reportability wrapper, trend detector, close-gate. fan_in >= 3.
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-001, REQ-002, REQ-007, REQ-011)
export const complaints = pgTable(
  'complaints',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    workflowRunId: uuid('workflow_run_id').references(() => workflowRuns.id, {
      onDelete: 'set null',
    }),
    intakeData: jsonb('intake_data').notNull().default({}),
    reportabilityStatus: text('reportability_status').notNull().default('pending'),
    vigilanceRef: uuid('vigilance_ref'),
    trendSignature: text('trend_signature'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    projectIdx: index('idx_complaints_project').on(t.projectId),
    orgIdx: index('idx_complaints_org').on(t.orgId),
    reportabilityIdx: index('idx_complaints_reportability').on(t.reportabilityStatus),
    trendIdx: index('idx_complaints_trend').on(t.orgId, t.trendSignature),
  }),
);

// @MX:ANCHOR [AUTO] capaRecords — corrective AND preventive action records (split).
// @MX:REASON Referenced by root causes, links, effectiveness checks, close route. fan_in >= 3.
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-004, REQ-005, REQ-010)
export const capaRecords = pgTable(
  'capa_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, {
        onDelete: 'cascade',
      }),
    complaintId: uuid('complaint_id')
      .notNull()
      .references(() => complaints.id, {
        onDelete: 'cascade',
      }),
    type: text('type').notNull(),
    description: text('description').notNull(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    dueDate: date('due_date').notNull(),
    status: text('status').notNull().default('open'),
    effectivenessStatus: text('effectiveness_status').notNull().default('pending'),
    closedBy: uuid('closed_by').references(() => users.id),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'date' }),
    closeSignatureHash: text('close_signature_hash'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    complaintIdx: index('idx_capa_records_complaint').on(t.complaintId),
    orgIdx: index('idx_capa_records_org').on(t.orgId),
    projectIdx: index('idx_capa_records_project').on(t.projectId),
    statusIdx: index('idx_capa_records_status').on(t.status),
    ownerIdx: index('idx_capa_records_owner').on(t.ownerId),
  }),
);

// REQ-003: root cause analysis (5 Whys / Fishbone).
export const capaRootCauses = pgTable(
  'capa_root_causes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    capaId: uuid('capa_id')
      .notNull()
      .references(() => capaRecords.id, { onDelete: 'cascade' }),
    method: text('method').notNull(),
    analysisData: jsonb('analysis_data').notNull().default({}),
    summary: text('summary').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    capaIdx: index('idx_capa_root_causes_capa').on(t.capaId),
    orgIdx: index('idx_capa_root_causes_org').on(t.orgId),
  }),
);

// REQ-008: cross-workflow traceability links (risk / change_control / DHF / PMS).
export const capaLinks = pgTable(
  'capa_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    capaId: uuid('capa_id')
      .notNull()
      .references(() => capaRecords.id, { onDelete: 'cascade' }),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    capaIdx: index('idx_capa_links_capa').on(t.capaId),
    targetIdx: index('idx_capa_links_target').on(t.targetType, t.targetId),
    orgIdx: index('idx_capa_links_org').on(t.orgId),
  }),
);

// REQ-006: scheduled effectiveness verification.
export const capaEffectivenessChecks = pgTable(
  'capa_effectiveness_checks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    capaId: uuid('capa_id')
      .notNull()
      .references(() => capaRecords.id, { onDelete: 'cascade' }),
    dueDate: date('due_date').notNull(),
    checkedAt: timestamp('checked_at', { withTimezone: true, mode: 'date' }),
    result: text('result'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    capaIdx: index('idx_capa_effectiveness_capa').on(t.capaId),
    orgIdx: index('idx_capa_effectiveness_org').on(t.orgId),
    dueIdx: index('idx_capa_effectiveness_due').on(t.dueDate),
  }),
);

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
export const ciEventTypeEnum = pgEnum('ci_event_type', ['milestone', 'deviation', 'adverse_event']);
export const ciLinkTargetTypeEnum = pgEnum('ci_link_target_type', ['cer', 'pms', 'dhf']);

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

// SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-008, AC-08).
// ci_events — milestone / deviation / adverse_event. adverse_event rows carry an
// optional vigilance_ref linking to the Vigilance domain (AC-08). Mirrors the
// capa.close_blocked_vigilance_missing linkage direction.
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
    vigilanceRef: text('vigilance_ref'),
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
