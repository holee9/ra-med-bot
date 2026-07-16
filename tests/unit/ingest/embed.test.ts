import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the embedding provider seam (Phase A: centralized in lib/ai/embedding-provider).
// embed.ts calls embedBatchTexts(...) — we stub it to return 1536-dim vectors
// matching the input size. vi.hoisted ensures the mock fn exists before the
// hoisted vi.mock factory runs.
const { mockEmbedBatch } = vi.hoisted(() => ({ mockEmbedBatch: vi.fn() }));
vi.mock('@/lib/ai/embedding-provider', () => ({
  embedBatchTexts: mockEmbedBatch,
  getEmbeddingModelId: () => 'text-embedding-3-small',
}));

import { embedChunks } from '../../../lib/ingest/embed';

describe('embedChunks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbedBatch.mockImplementation((texts: string[]) =>
      Promise.resolve(texts.map(() => new Array(1536).fill(0.1))),
    );
  });

  it('returns array of embedding vectors', async () => {
    const result = await embedChunks(['Hello world', 'Medical device']);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(1536);
  });

  it('throws when text contains SSN pattern (PII guard)', async () => {
    await expect(embedChunks(['Patient SSN is 123-45-6789 for this record'])).rejects.toThrow(
      /PII|SSN/i,
    );
  });

  it('throws when text contains email-like PII pattern', async () => {
    await expect(
      embedChunks(['Contact john.doe@hospital.org for patient records']),
    ).rejects.toThrow(/PII|email/i);
  });

  // #517 / SPEC-REGULA-CORPUS-SEED-001: after #318 moved embedding on-prem (gx10
  // LAN), the URL PII guard is obsolete AND fatal — regulatory docs are URL-heavy,
  // so it silently dropped ~74% of the corpus. URLs must embed; real PII stays blocked.
  it('does NOT throw for URL-bearing regulatory content (on-prem embed)', async () => {
    const result = await embedChunks([
      'See FDA guidance at https://www.fda.gov/media/510k.pdf and EUDAMED https://ec.europa.eu/tools/eudamed',
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(1536);
  });

  it('still blocks email even when a URL is also present', async () => {
    await expect(
      embedChunks(['Ref https://www.fda.gov/x — contact jane.roe@notifiedbody.eu']),
    ).rejects.toThrow(/PII|email/i);
  });

  it('processes 150 texts correctly (batching)', async () => {
    const texts = Array.from({ length: 150 }, (_, i) => `Document chunk ${i}`);
    const result = await embedChunks(texts);
    expect(result).toHaveLength(150);
  });

  it('returns empty array for empty input', async () => {
    const result = await embedChunks([]);
    expect(result).toEqual([]);
  });

  it('each embedding is an array of numbers', async () => {
    const result = await embedChunks(['Test regulatory content']);
    expect(Array.isArray(result[0])).toBe(true);
    for (const val of result[0] ?? []) {
      expect(typeof val).toBe('number');
    }
  });
});
