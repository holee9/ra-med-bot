// @MX:ANCHOR [AUTO] DocIngest schema — corrected tables for Phase 8 document ingest.
// @MX:REASON fan_in >= 3: ingest pipeline, ACL layer, and search API all reference these tables.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-036~045)
//
// Table inventory (3 after 0017 fix — ingest_jobs removed):
//   organization_documents, document_chunks, document_access_policies
//
// pgEnum inventory (3):
//   doc_class_enum, doc_status_enum (8-value), doc_source
//
// DO NOT modify lib/kernel/db/schema.ts — all new tables live here.
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

import { organizations, userRoleEnum, users } from './schema';

// ---------------------------------------------------------------------------
// pgvector custom type — 1536-dim for OpenAI text-embedding-3-small
// ---------------------------------------------------------------------------
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)';
  },
});

// ---------------------------------------------------------------------------
// pgEnums — must match migration 0014 + 0017 exactly
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

// REQ-DOC-036: document lifecycle states (8-value corrected in 0017)
export const docStatusEnum = pgEnum('doc_status_enum', [
  'pending',
  'extracting',
  'redacting',
  'chunking',
  'indexed',
  'failed',
  'quarantine',
  'archived',
]);

// REQ-DOC-011: document source channels (created in 0017)
export const docSourceEnum = pgEnum('doc_source', [
  'google_drive',
  'sharepoint',
  'dropbox',
  'email_workers',
  'manual_upload',
  'regulatory_portal',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/**
 * REQ-DOC-036: Core document registry.
 * Hard delete is prohibited — use archived_at for soft delete (21 CFR Part 11).
 * Column names corrected in migration 0017.
 */
export const organizationDocuments = pgTable(
  'organization_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Renamed from organization_id in 0017
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    docClass: docClassEnum('doc_class').notNull(),
    title: text('title').notNull(),
    status: docStatusEnum('status').notNull().default('pending'),
    source: docSourceEnum('source').notNull().default('manual_upload'),
    // Renamed from r2_object_key in 0017
    originalFileR2Key: text('original_file_r2_key').notNull(),
    // Renamed from sha256_hash in 0017
    fileHashSha256: text('file_hash_sha256').notNull(),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    // Added in 0017 — finer-grained than mimeType
    fileMimeType: text('file_mime_type').notNull().default('application/pdf'),
    language: text('language').notNull().default('en'),
    // Redacted file stored separately in R2
    redactedFileR2Key: text('redacted_file_r2_key'),
    // Source-specific metadata (drive ID, sharepoint URL, etc.)
    sourceMetaJson: jsonb('source_meta_json').$type<Record<string, unknown>>().default({}),
    // Class-specific metadata (fda_k_number, etc.)
    metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>().default({}),
    version: integer('version').notNull().default(1),
    supersedesDocId: uuid('supersedes_doc_id'),
    projectId: uuid('project_id'),
    uploadedBy: uuid('uploaded_by').references(() => users.id),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    indexedAt: timestamp('indexed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    // Soft delete — hard delete is prohibited (21 CFR Part 11)
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => ({
    // Composite index for filtering by org + class + status
    orgClassStatusIdx: index('idx_org_docs_org_class_status').on(
      table.orgId,
      table.docClass,
      table.status,
    ),
    // Unique constraint for deduplication within an org
    sha256Unique: unique('uq_org_docs_sha256').on(table.orgId, table.fileHashSha256),
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
    // Denormalized for RLS — must match organizationDocuments.orgId
    organizationId: uuid('organization_id').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding'),
    tokenCount: integer('token_count'),
    metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    // Secondary index for org-scoped queries (HNSW index created in migration 0014)
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

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

export type OrganizationDocument = typeof organizationDocuments.$inferSelect;
export type NewOrganizationDocument = typeof organizationDocuments.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
export type DocumentAccessPolicy = typeof documentAccessPolicies.$inferSelect;
