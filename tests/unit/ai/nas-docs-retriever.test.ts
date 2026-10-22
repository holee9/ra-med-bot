// @MX:NOTE [AUTO] NasDocsRetriever tests — NAS Qdrant 연결 (2026-10-21).
// Verifies: org gate, 4096 native embedding call, payload mapping, score
// floor, and graceful degradation on Qdrant/embedding failure.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEmbed = vi.fn();
const mockDbSelect = vi.fn();

vi.mock('ai', () => ({
  embed: (...args: unknown[]) => mockEmbed(...args),
}));

vi.mock('@/lib/kernel/db/client', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

vi.mock('@/lib/kernel/db/schema', () => ({
  sources: { id: 'id', org_label: 'org_label' },
}));

vi.mock('@/lib/ai/embedding-provider', () => ({
  getNativeEmbeddingModel: () => ({ modelId: 'qwen3-embedding:latest-native' }),
}));

import { NasDocsRetriever } from '@/lib/ai/retrievers/nas-docs';

const ORG = '10000000-0000-4000-8000-000000000001';
const NAS_SOURCE = '0385c397-2bac-4391-ad5e-83dbf8c2a7d8';

function fakeDbChain() {
  // db.select().from().where().limit() → [{id}]
  return {
    from: () => ({
      where: () => ({
        limit: async () => [{ id: NAS_SOURCE }],
      }),
    }),
  };
}

describe('NasDocsRetriever (NAS Qdrant 연결)', () => {
  beforeEach(() => {
    vi.resetModules();
    mockEmbed.mockReset();
    mockDbSelect.mockReset();
    mockDbSelect.mockImplementation(fakeDbChain);
    globalThis.fetch = vi.fn();
  });

  it('returns [] without orgId (security parity with InternalSopsRetriever)', async () => {
    const r = new NasDocsRetriever();
    expect(await r.retrieve('질문', {})).toEqual([]);
    expect(mockEmbed).not.toHaveBeenCalled();
  });

  it('maps Qdrant hits into RetrievalResult with proxy sourceId', async () => {
    mockEmbed.mockResolvedValue({ embedding: new Array(4096).fill(0.01) });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: [
          {
            id: 12345,
            score: 0.62,
            payload: {
              file_path: '/mnt/nas-ra/문서/가이드.pdf',
              filename: '가이드.pdf',
              folder_category: '04_제품별',
              chunk_index: 3,
              text: '제출 문서 목록 ...',
            },
          },
          { id: 2, score: 0.05, payload: { text: 'noise' } }, // below floor → dropped
        ],
      }),
    });
    const results = await new NasDocsRetriever().retrieve('제출 문서', {
      orgId: ORG,
      limit: 5,
    });
    expect(results).toHaveLength(1);
    const first = results[0];
    expect(first?.id).toBe('nas-12345');
    expect(first?.sourceId).toBe(NAS_SOURCE);
    expect(first?.score).toBe(0.62);
    expect(first?.metadata.orgLabel).toBe('NAS 실무문서');
    expect(first?.metadata.title).toBe('가이드.pdf');
    // 4096-dim native vector sent to Qdrant
    const body = JSON.parse(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body,
    );
    expect(body.vector).toHaveLength(4096);
    expect(body.limit).toBe(5);
  });

  it('degrades to [] when Qdrant is unreachable', async () => {
    mockEmbed.mockResolvedValue({ embedding: new Array(4096).fill(0) });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ECONNREFUSED'));
    const r = await new NasDocsRetriever().retrieve('질문', { orgId: ORG });
    expect(r).toEqual([]);
  });

  it('degrades to [] when native embedding fails', async () => {
    mockEmbed.mockRejectedValue(new Error('ollama down'));
    const r = await new NasDocsRetriever().retrieve('질문', { orgId: ORG });
    expect(r).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
