import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock DB to avoid real connections
vi.mock('../../../../lib/db/client', () => ({
  withTenantScope: vi
    .fn()
    .mockImplementation(async (_orgId: string, fn: (db: unknown) => Promise<unknown>) => {
      const mockDb = {
        execute: vi.fn().mockResolvedValue([]),
      };
      return fn(mockDb);
    }),
}));

vi.mock('../../../../lib/acl/document-acl', () => ({
  computeDocumentPermissions: vi.fn().mockResolvedValue({
    readable: ['issued_certificate', 'submission_success'],
    writable: [],
  }),
}));

// Phase A: batch embedding centralized in lib/ai/embedding-provider.
vi.mock('@/lib/ai/embedding-provider', () => ({
  embedBatchTexts: vi.fn().mockResolvedValue([new Array(1536).fill(0.1)]),
  getEmbeddingModelId: () => 'text-embedding-3-small',
}));

import { internalDocsRetrieve } from '../../../../lib/ai/retrievers/internal-docs';
import { DocClass } from '../../../../lib/ingest/doc-class';

describe('internalDocsRetrieve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is exported as a function', () => {
    expect(typeof internalDocsRetrieve).toBe('function');
  });

  it('returns a RetrieverResult with results array', async () => {
    const result = await internalDocsRetrieve('510k submission requirements', {
      topK: 5,
      orgId: 'org-123',
      userId: 'user-456',
    });
    expect(result).toHaveProperty('results');
    expect(Array.isArray(result.results)).toBe(true);
  });

  it('accepts allowedClasses filter', async () => {
    const result = await internalDocsRetrieve('audit response template', {
      topK: 3,
      orgId: 'org-123',
      userId: 'user-456',
      allowedClasses: [DocClass.audit_response],
    });
    expect(result).toHaveProperty('results');
  });

  it('sets expert_review_required when clinical_report or audit_response chunks returned', async () => {
    // Mock to return a clinical_report chunk
    const { withTenantScope } = await import('../../../../lib/db/client');
    vi.mocked(withTenantScope).mockImplementationOnce(async (_orgId, fn) => {
      return fn({
        execute: vi.fn().mockResolvedValue([
          {
            id: 'chunk-1',
            content: 'Clinical study results...',
            document_id: 'doc-1',
            metadata_json: { docClass: 'clinical_report' },
            score: 0.95,
          },
        ]),
      } as never);
    });

    const result = await internalDocsRetrieve('clinical trial results', {
      topK: 5,
      orgId: 'org-123',
      userId: 'user-456',
    });
    expect(result.expertReviewRequired).toBe(true);
  });

  it('accepts projectScope option', async () => {
    const result = await internalDocsRetrieve('device testing', {
      topK: 5,
      orgId: 'org-123',
      userId: 'user-456',
      projectScope: 'project-789',
    });
    expect(result).toHaveProperty('results');
  });
});
