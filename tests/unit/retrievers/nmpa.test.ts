// @MX:NOTE [AUTO] T-007 TDD RED phase — NMPA (China) retriever tests.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-036)

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const root = path.resolve(__dirname, '..', '..', '..');

vi.mock('@/lib/ai/retrievers/hybrid-search', () => ({
  hybridSearch: vi.fn(),
}));

describe('lib/ai/retrievers/nmpa.ts (REQ-BREADTH-036)', () => {
  it('nmpa.ts file exists', () => {
    const filePath = path.join(root, 'lib', 'ai', 'retrievers', 'nmpa.ts');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('exports NmpaRetriever class', () => {
    const src = fs.readFileSync(path.join(root, 'lib', 'ai', 'retrievers', 'nmpa.ts'), 'utf8');
    expect(src).toMatch(/export class NmpaRetriever/);
  });

  it('NmpaRetriever.corpus is "nmpa"', async () => {
    const { NmpaRetriever } = await import('@/lib/ai/retrievers/nmpa');
    expect(new NmpaRetriever().corpus).toBe('nmpa');
  });

  it('NmpaRetriever.retrieve() calls hybridSearch with corpus "nmpa"', async () => {
    const { hybridSearch } = await import('@/lib/ai/retrievers/hybrid-search');
    vi.mocked(hybridSearch).mockResolvedValueOnce([]);

    const { NmpaRetriever } = await import('@/lib/ai/retrievers/nmpa');
    await new NmpaRetriever().retrieve('medical device registration', { limit: 8 });
    expect(hybridSearch).toHaveBeenCalledWith('medical device registration', 'nmpa', 8, 'all');
  });

  it('retrieve() maps hybridSearch results to RetrievalResult shape', async () => {
    const { hybridSearch } = await import('@/lib/ai/retrievers/hybrid-search');
    vi.mocked(hybridSearch).mockResolvedValueOnce([
      {
        sectionId: 'nmpa-sec-1',
        sourceId: 'nmpa-src-1',
        anchor: 'Chapter 1',
        text: 'NMPA regulation content',
        offset: 0,
        vec_score: 0.88,
        fts_score: 0.72,
        combined_score: 0.816,
        orgLabel: 'NMPA China',
        title: 'Medical Device Registration Regulation',
        year: 2021,
        type: 'Regulation',
        url: null,
      },
    ]);

    const { NmpaRetriever } = await import('@/lib/ai/retrievers/nmpa');
    const results = await new NmpaRetriever().retrieve('test');
    expect(results[0]).toMatchObject({
      id: 'nmpa-sec-1',
      content: 'NMPA regulation content',
      score: expect.any(Number),
      sourceId: 'nmpa-src-1',
    });
  });
});
