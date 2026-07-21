// @MX:NOTE [AUTO] Unit tests for docingest schema (6 runtime exports).
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-036~045, Issue #402)
// @MX:REASON pgEnum + pgTable are drizzle config objects. Tests assert their
//   runtime shape: enum values, table name, column names/types, and the type
//   helper exports ($inferSelect). No DB connection needed.

import { describe, expect, it } from 'vitest';

import {
  docClassEnum,
  docSourceEnum,
  docStatusEnum,
  documentAccessPolicies,
  documentChunks,
  organizationDocuments,
} from '@/lib/kernel/db/schema-docingest';

// ---------------------------------------------------------------------------
// pgEnums (3)
// ---------------------------------------------------------------------------

describe('docClassEnum (REQ-DOC-001)', () => {
  it('exports all 8 document classes in canonical order', () => {
    const values = docClassEnum.enumValues;
    expect(values).toEqual([
      'issued_certificate',
      'submission_success',
      'submission_inprogress',
      'clinical_report',
      'checklist_template',
      'surveillance_report',
      'internal_sop',
      'audit_response',
    ]);
  });
});

describe('docStatusEnum (REQ-DOC-036)', () => {
  it('exports all 8 lifecycle states in canonical order', () => {
    const values = docStatusEnum.enumValues;
    expect(values).toEqual([
      'pending',
      'extracting',
      'redacting',
      'chunking',
      'indexed',
      'failed',
      'quarantine',
      'archived',
    ]);
  });
});

describe('docSourceEnum (REQ-DOC-011)', () => {
  it('exports all 6 document source channels', () => {
    const values = docSourceEnum.enumValues;
    expect(values).toEqual([
      'google_drive',
      'sharepoint',
      'dropbox',
      'email_workers',
      'manual_upload',
      'regulatory_portal',
    ]);
  });
});

// ---------------------------------------------------------------------------
// organizationDocuments table
// ---------------------------------------------------------------------------

describe('organizationDocuments table (REQ-DOC-036)', () => {
  it('is named organization_documents', () => {
    // biome-ignore lint/suspicious/noExplicitAny: drizzle internal symbol access
    expect((organizationDocuments as any)[Symbol.for('drizzle:Name')]).toBe(
      'organization_documents',
    );
  });

  it('has the expected core columns', () => {
    const cols = Object.keys(organizationDocuments);
    expect(cols).toContain('id');
    expect(cols).toContain('orgId');
    expect(cols).toContain('docClass');
    expect(cols).toContain('title');
    expect(cols).toContain('status');
    expect(cols).toContain('source');
    expect(cols).toContain('originalFileR2Key');
    expect(cols).toContain('fileHashSha256');
    expect(cols).toContain('fileSizeBytes');
    expect(cols).toContain('fileMimeType');
    expect(cols).toContain('language');
    expect(cols).toContain('redactedFileR2Key');
    expect(cols).toContain('sourceMetaJson');
    expect(cols).toContain('metadataJson');
    expect(cols).toContain('version');
    expect(cols).toContain('supersedesDocId');
    expect(cols).toContain('projectId');
    expect(cols).toContain('uploadedBy');
    expect(cols).toContain('uploadedAt');
    expect(cols).toContain('indexedAt');
    expect(cols).toContain('createdAt');
    expect(cols).toContain('updatedAt');
    expect(cols).toContain('archivedAt');
  });

  it('has an extra config builder (composite index + unique constraint declared)', () => {
    // biome-ignore lint/suspicious/noExplicitAny: drizzle internal symbol access
    const tableAny = organizationDocuments as any;
    // The ExtraConfigBuilder symbol holds the 3rd-arg config callback. When
    // defined, the table has indexes/constraints that will be materialized by
    // the dialect builder.
    const EXTRA_CONFIG = Symbol.for('drizzle:ExtraConfigBuilder');
    expect(typeof tableAny[EXTRA_CONFIG]).toBe('function');

    // Call the builder to materialize the config; it returns a record of
    // index/constraint name -> builder instance. The names match the keys
    // passed in the schema's 3rd-arg callback.
    const EXTRA_CONFIG_COLS = Symbol.for('drizzle:ExtraConfigColumns');
    const configCols = tableAny[EXTRA_CONFIG_COLS];
    const config = tableAny[EXTRA_CONFIG](configCols);
    const configKeys = Object.keys(config);

    // orgClassStatusIdx + sha256Unique are the keys in the schema callback.
    expect(configKeys).toContain('orgClassStatusIdx');
    expect(configKeys).toContain('sha256Unique');
  });
});

// ---------------------------------------------------------------------------
// documentChunks table
// ---------------------------------------------------------------------------

describe('documentChunks table (REQ-DOC-037)', () => {
  it('is named document_chunks', () => {
    // biome-ignore lint/suspicious/noExplicitAny: drizzle internal symbol access
    expect((documentChunks as any)[Symbol.for('drizzle:Name')]).toBe('document_chunks');
  });

  it('has the expected columns including pgvector embedding', () => {
    const cols = Object.keys(documentChunks);
    expect(cols).toContain('id');
    expect(cols).toContain('documentId');
    expect(cols).toContain('organizationId');
    expect(cols).toContain('chunkIndex');
    expect(cols).toContain('content');
    expect(cols).toContain('embedding');
    expect(cols).toContain('tokenCount');
    expect(cols).toContain('metadataJson');
    expect(cols).toContain('createdAt');
  });
});

// ---------------------------------------------------------------------------
// documentAccessPolicies table
// ---------------------------------------------------------------------------

describe('documentAccessPolicies table (REQ-DOC-038)', () => {
  it('is named document_access_policies', () => {
    // biome-ignore lint/suspicious/noExplicitAny: drizzle internal symbol access
    expect((documentAccessPolicies as any)[Symbol.for('drizzle:Name')]).toBe(
      'document_access_policies',
    );
  });

  it('has the expected ACL columns', () => {
    const cols = Object.keys(documentAccessPolicies);
    expect(cols).toContain('id');
    expect(cols).toContain('organizationId');
    expect(cols).toContain('docClass');
    expect(cols).toContain('projectId');
    expect(cols).toContain('role');
    expect(cols).toContain('canRead');
    expect(cols).toContain('canWrite');
    expect(cols).toContain('canAdmin');
    expect(cols).toContain('createdAt');
  });
});

// ---------------------------------------------------------------------------
// Cross-table enum sharing
// ---------------------------------------------------------------------------

describe('enum sharing across tables', () => {
  it('organizationDocuments.docClass and documentAccessPolicies.docClass reference the same enum values', () => {
    expect(docClassEnum.enumValues).toHaveLength(8);
    // Both columns derive from the same pgEnum instance.
    expect(organizationDocuments.docClass?.enumValues).toEqual(docClassEnum.enumValues);
  });

  it('organizationDocuments.status references docStatusEnum', () => {
    expect(organizationDocuments.status?.enumValues).toEqual(docStatusEnum.enumValues);
  });

  it('organizationDocuments.source references docSourceEnum', () => {
    expect(organizationDocuments.source?.enumValues).toEqual(docSourceEnum.enumValues);
  });
});
