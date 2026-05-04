// @MX:ANCHOR [AUTO] DocIngest schema — 4 new tables for Phase 8 document ingest.
// @MX:REASON fan_in >= 3: ingest pipeline, ACL layer, and search API all reference these tables.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-036~045)
//
// Table inventory (4):
//   organization_documents, document_chunks, document_access_policies, ingest_jobs
//
// pgEnum inventory (2):
//   doc_class_enum, doc_status_enum
//
// DO NOT modify lib/db/schema.ts — all new tables live here.
// organizations and users tables are referenced via FK from schema.ts exports.

import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { organizations, users, userRoleEnum } from './schema';

// ---------------------------------------------------------------------------
// pgvector custom type — 1536-dim for OpenAI ada-002 / text-embedding-3-small
// ---------------------------------------------------------------------------
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)';
  },
});

// ---------------------------------------------------------------------------
// pgEnums — must match migration 0014_docingest_schema.sql exactly
// ---------------------------------------------------------------------------

// REQ-DOC-001: 8-class document taxonomy
export const docClassEnum = pgEnum('doc_class_enum', [
  'issued_certificate',
  'submission_success',
  'submission_inprogress',
  'clinical_report',
  'checklist_template',
  'surveillance_report',
  'internal_sop',
  'audit_response',
]);

// REQ-DOC-036: document lifecycle states
export const docStatusEnum = pgEnum('doc_status_enum', [
  'processing',
  'indexed',
  'quarantine',
  'archived',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/**
 * REQ-DOC-036: Core document registry.
 * Hard delete is prohibited — use archived_at for soft delete.
 */
export const organizationDocuments = pgTable(
  'organization_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    docClass: docClassEnum('doc_class').notNull(),
    title: text('title').notNull(),
    status: docStatusEnum('status').notNull().default('processing'),
    // Cloudflare R2 object keys
    r2ObjectKey: text('r2_object_key').notNull(),
    r2RedactedKey: text('r2_redacted_key'), // optional redacted version
    // SHA-256 hash for deduplication
    sha256Hash: text('sha256_hash').notNull(),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    mimeType: text('mime_type').notNull(),
    metadataJson: jsonb('metadata_json').default({}),
    uploadedBy: uuid('uploaded_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    // Soft delete — hard delete is prohibited (21 CFR Part 11)
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => ({
    // Composite index for filtering by org + class + status
    orgClassStatusIdx: index('idx_org_docs_org_class_status').on(
      table.organizationId,
      table.docClass,
      table.status,
    ),
    // Unique constraint for deduplication within an org
    sha256Unique: unique('uq_org_docs_sha256').on(table.organizationId, table.sha256Hash),
  }),
);

/**
 * REQ-DOC-037: Chunked text with pgvector embeddings.
 * organization_id is denormalized for RLS policy enforcement.
 */
export const documentChunks = pgTable(
  'document_chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => organizationDocuments.id, { onDelete: 'cascade' }),
    // Denormalized for RLS — must match organizationDocuments.organizationId
    organizationId: uuid('organization_id').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding'),
    tokenCount: integer('token_count'),
    metadataJson: jsonb('metadata_json').default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    // Secondary index for org-scoped queries (HNSW index created in migration)
    orgIdx: index('idx_doc_chunks_org').on(table.organizationId),
  }),
);

/**
 * REQ-DOC-038: Per-class, per-role, per-project access control.
 * Unique constraint prevents duplicate entries for same (org, class, project, role) tuple.
 */
export const documentAccessPolicies = pgTable(
  'document_access_policies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    docClass: docClassEnum('doc_class'), // null = applies to all classes
    projectId: uuid('project_id'), // null = org-wide policy
    role: userRoleEnum('role').notNull(),
    canRead: boolean('can_read').notNull().default(false),
    canWrite: boolean('can_write').notNull().default(false),
    canAdmin: boolean('can_admin').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    accessPolicyUnique: unique('uq_doc_access_policy').on(
      table.organizationId,
      table.docClass,
      table.projectId,
      table.role,
    ),
  }),
);

/**
 * REQ-DOC-039: Ingest job tracking.
 * Tracks async processing jobs from upload to indexed state.
 */
export const ingestJobs = pgTable('ingest_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  documentId: uuid('document_id').references(() => organizationDocuments.id),
  inngestRunId: text('inngest_run_id'),
  source: text('source').notNull(), // 'manual' | 'google_drive' | 'sharepoint' | 'dropbox' | 'email'
  status: text('status').notNull().default('pending'), // 'pending' | 'running' | 'completed' | 'failed'
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
