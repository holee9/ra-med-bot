// @MX:ANCHOR Drizzle ORM schema — single source of truth for the Regula data model.
// @MX:REASON 16 tables and 11 pgEnums are referenced by every Route Handler,
// every migration, and every QA static analysis pass. fan_in is well above 3.
// @MX:SPEC SPEC-REGULA-FOUNDATION-001 (REQ-FND-031..044b),
//          SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-016, 027, 028),
//          SPEC-REGULA-WORKFLOWS-001 (REQ-WF-049, REQ-WF-051)
//
// Table inventory (16):
//   users, organizations, projects, conversations, messages, message_sources,
//   message_blocks, sources, source_sections, templates, regulatory_updates,
//   expert_reviews, audit_logs, org_members, project_members, workflow_runs
//
// pgEnum inventory (11):
//   locale, theme_pref, message_role, confidence_level, block_type,
//   source_type, expert_review_status, audit_action, user_role,
//   workflow_type, workflow_status
//
// Vector type: pgvector(1536) is exposed via customType because drizzle-orm
// does not yet ship a native vector helper. See migrations/0000_init.sql for
// the matching `CREATE EXTENSION vector;` statement.

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
// `dataType()` returns the SQL fragment Drizzle interpolates into DDL/DML.
// ---------------------------------------------------------------------------
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)';
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
export const userRoleEnum = pgEnum('user_role', ['admin', 'ra-lead', 'ra-member', 'viewer']);
export const userStatusEnum = pgEnum('user_status', ['pending', 'active', 'disabled']);
// REQ-TENANT-001: department pgEnum for secondary RBAC axis (SPEC-REGULA-TENANT-001 Tenant-Lite).
export const userDepartmentEnum = pgEnum('user_department', ['RA', 'Dev', 'Exec', 'External']);

// @MX:NOTE audit_action values mirror AuditAction type in lib/audit.ts.
// Phase 1: 3 values. Phase 3 / Breadth: +10 via 0003_breadth_audit_actions.sql.
// Phase 5 Enterprise: +12 via 0005_enterprise_audit_actions.sql.
// Phase 9 Workflows: +10 via 0013_workflow_audit_actions.sql.
// Phase 8 DocIngest: +6 via 0016_docingest_audit_actions.sql.
// Total: 43 values. Adding values here requires a matching ALTER TYPE migration.
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
]);

// REQ-WF-049: workflow_type pgEnum — three Phase 9 workflow kinds.
// Migration: 0012_workflow_schema.sql
export const workflowTypeEnum = pgEnum('workflow_type', [
  'submission_drafter',
  'audit_response',
  'indication_impact',
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
export const users = pgTable('users', {
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
  // Credentials auth — null means SSO-only account.
  password_hash: text('password_hash'),
  image: text('image'),
  // pending = awaiting admin approval, active = approved, disabled = revoked.
  status: userStatusEnum('status').notNull().default('pending'),
  // Issue #111: force password change on first login (admin bootstrap accounts only).
  mustChangePassword: boolean('must_change_password').notNull().default(false),
});

// REQ-FND-034
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  deviceClass: text('device_class'),
  targetMarkets: text('target_markets')
    .array()
    .notNull()
    .default(['']) // overridden below in SQL via DEFAULT '{}'
    .$default(() => []),
  color: text('color'),
  submissionDate: date('submission_date'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// REQ-FND-035
export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  title: text('title'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' }),
});

// REQ-FND-036 — meta_json is critical (v0.4.0 C7).
export const messages = pgTable('messages', {
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
  tokensIn: integer('tokens_in'),
  tokensOut: integer('tokens_out'),
  model: text('model'),
  metaJson: jsonb('meta_json'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// REQ-FND-039 — sources is created before message_sources because the latter FKs it.
export const sources = pgTable('sources', {
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
  // tsvector and vector use raw SQL types via customType / text fallback;
  // Drizzle does not introspect them but the migration creates them correctly.
  fullTextTsv: text('full_text_tsv'),
  embedding: vector('embedding'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

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
    embedding: vector('embedding'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    anchorUnique: unique('source_sections_source_anchor_idx').on(t.sourceId, t.anchor),
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
    matchedProductCategories: text('matched_product_categories').array().notNull().default([]),
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
export const auditLogs = pgTable('audit_logs', {
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
});

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
export const workflowRuns = pgTable('workflow_runs', {
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
