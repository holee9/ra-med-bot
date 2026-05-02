// @MX:NOTE [AUTO] T-006 TDD RED phase — MFDS (Korea) retriever tests.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-035)

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const root = path.resolve(__dirname, '..', '..', '..');

vi.mock('@/lib/ai/retrievers/hybrid-search', () => ({
  hybridSearch: vi.fn(),
}));

describe('lib/ai/retrievers/mfds.ts (REQ-BREADTH-035)', () => {
  it('mfds.ts file exists', () => {
    const filePath = path.join(root, 'lib', 'ai', 'retrievers', 'mfds.ts');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('exports MfdsRetriever class', () => {
    const src = fs.readFileSync(path.join(root, 'lib', 'ai', 'retrievers', 'mfds.ts'), 'utf8');
    expect(src).toMatch(/export class MfdsRetriever/);
  });

  it('MfdsRetriever.corpus is "mfds"', async () => {
    const { MfdsRetriever } = await import('@/lib/ai/retrievers/mfds');
    const retriever = new MfdsRetriever();
    expect(retriever.corpus).toBe('mfds');
  });

  it('MfdsRetriever.retrieve() calls hybridSearch with corpus "mfds"', async () => {
    const { hybridSearch } = await import('@/lib/ai/retrievers/hybrid-search');
    const mockedHybridSearch = vi.mocked(hybridSearch);
    mockedHybridSearch.mockResolvedValueOnce([]);

    const { MfdsRetriever } = await import('@/lib/ai/retrievers/mfds');
    const retriever = new MfdsRetriever();
    await retriever.retrieve('의료기기 허가', { limit: 3 });

    expect(mockedHybridSearch).toHaveBeenCalledWith('의료기기 허가', 'mfds', 3, 'all');
  });

  it('retrieve() returns RetrievalResult array shape', async () => {
    const { hybridSearch } = await import('@/lib/ai/retrievers/hybrid-search');
    vi.mocked(hybridSearch).mockResolvedValueOnce([
      {
        sectionId: 'sec-mfds-1',
        sourceId: 'src-mfds-1',
        anchor: 'MFDS 1조',
        text: '의료기기법 내용',
        offset: 0,
        vec_score: 0.85,
        fts_score: 0.7,
        combined_score: 0.79,
        orgLabel: 'MFDS Korea',
        title: '의료기기법',
        year: 2023,
        type: 'Regulation',
        url: null,
      },
    ]);

    const { MfdsRetriever } = await import('@/lib/ai/retrievers/mfds');
    const results = await new MfdsRetriever().retrieve('query');
    expect(results[0]).toMatchObject({
      id: 'sec-mfds-1',
      content: '의료기기법 내용',
      score: expect.any(Number),
      sourceId: 'src-mfds-1',
      metadata: expect.any(Object),
    });
  });
});
