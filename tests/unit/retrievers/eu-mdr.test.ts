// @MX:NOTE [AUTO] T-005 TDD RED phase — EU MDR retriever tests.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-034)

import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const root = path.resolve(__dirname, '..', '..', '..');

// Mock hybrid-search to avoid real DB/OpenAI calls.
vi.mock('@/lib/ai/retrievers/hybrid-search', () => ({
  hybridSearch: vi.fn(),
}));

describe('lib/ai/retrievers/eu-mdr.ts (REQ-BREADTH-034)', () => {
  it('eu-mdr.ts file exists', () => {
    const filePath = path.join(root, 'lib', 'ai', 'retrievers', 'eu-mdr.ts');
    expect(fs.existsSync(filePath), 'lib/ai/retrievers/eu-mdr.ts does not exist').toBe(true);
  });

  it('exports EuMdrRetriever class', () => {
    const src = fs.readFileSync(path.join(root, 'lib', 'ai', 'retrievers', 'eu-mdr.ts'), 'utf8');
    expect(src).toMatch(/export class EuMdrRetriever/);
  });

  it('EuMdrRetriever.corpus is "eu-mdr"', async () => {
    const { EuMdrRetriever } = await import('@/lib/ai/retrievers/eu-mdr');
    const retriever = new EuMdrRetriever();
    expect(retriever.corpus).toBe('eu-mdr');
  });

  it('EuMdrRetriever implements IRetriever (retrieve method exists)', async () => {
    const { EuMdrRetriever } = await import('@/lib/ai/retrievers/eu-mdr');
    const retriever = new EuMdrRetriever();
    expect(typeof retriever.retrieve).toBe('function');
  });

  it('retrieve() calls hybridSearch with corpus "eu-mdr"', async () => {
    const { hybridSearch } = await import('@/lib/ai/retrievers/hybrid-search');
    const mockedHybridSearch = vi.mocked(hybridSearch);
    mockedHybridSearch.mockResolvedValueOnce([
      {
        sectionId: 'sec-1',
        sourceId: 'src-1',
        anchor: 'MDR Art.1',
        text: 'EU MDR content',
        offset: 0,
        vec_score: 0.9,
        fts_score: 0.8,
        combined_score: 0.86,
        orgLabel: 'EU Commission',
        title: 'EU MDR 2017/745',
        year: 2017,
        type: 'Regulation',
        url: null,
      },
    ]);

    const { EuMdrRetriever } = await import('@/lib/ai/retrievers/eu-mdr');
    const retriever = new EuMdrRetriever();
    const results = await retriever.retrieve('safety requirements', { limit: 5 });

    expect(mockedHybridSearch).toHaveBeenCalledWith('safety requirements', 'eu-mdr', 5, 'all');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'sec-1',
      content: 'EU MDR content',
      score: expect.any(Number),
      sourceId: 'src-1',
      metadata: expect.any(Object),
    });
  });

  it('retrieve() uses default limit 10 when not specified', async () => {
    const { hybridSearch } = await import('@/lib/ai/retrievers/hybrid-search');
    const mockedHybridSearch = vi.mocked(hybridSearch);
    mockedHybridSearch.mockResolvedValueOnce([]);

    const { EuMdrRetriever } = await import('@/lib/ai/retrievers/eu-mdr');
    const retriever = new EuMdrRetriever();
    await retriever.retrieve('query');

    expect(mockedHybridSearch).toHaveBeenCalledWith('query', 'eu-mdr', 10, 'all');
  });
});
