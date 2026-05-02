// @MX:NOTE [AUTO] T-009 TDD RED phase — merge.ts tests.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-039, REQ-BREADTH-042)

import type { RetrievalResult } from '@/lib/ai/retrievers/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all 5 retriever classes to prevent real DB/network calls.
vi.mock('@/lib/ai/retrievers/eu-mdr', () => ({
  EuMdrRetriever: vi.fn().mockImplementation(() => ({
    corpus: 'eu-mdr',
    retrieve: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/lib/ai/retrievers/mfds', () => ({
  MfdsRetriever: vi.fn().mockImplementation(() => ({
    corpus: 'mfds',
    retrieve: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/lib/ai/retrievers/nmpa', () => ({
  NmpaRetriever: vi.fn().mockImplementation(() => ({
    corpus: 'nmpa',
    retrieve: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/lib/ai/retrievers/pmda', () => ({
  PmdaRetriever: vi.fn().mockImplementation(() => ({
    corpus: 'pmda',
    retrieve: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/lib/ai/retrievers/internal-sops', () => ({
  InternalSopsRetriever: vi.fn().mockImplementation(() => ({
    corpus: 'internal-sops',
    retrieve: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/lib/ai/retrievers/fda', () => ({
  FdaRetriever: vi.fn().mockImplementation(() => ({
    corpus: 'fda',
    retrieve: vi.fn().mockResolvedValue([]),
  })),
}));

const makeResult = (id: string, score: number, corpus = 'fda'): RetrievalResult => ({
  id,
  content: `Content for ${id}`,
  score,
  sourceId: `src-${id}`,
  metadata: { corpus },
});

describe('lib/ai/merge.ts (REQ-BREADTH-039, REQ-BREADTH-042)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure COHERE_API_KEY is absent so fallback sort is used in tests.
    process.env.COHERE_API_KEY = undefined;
  });

  it('merge.ts file exists', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const root = path.resolve(__dirname, '..', '..', '..');
    const filePath = path.join(root, 'lib', 'ai', 'merge.ts');
    expect(fs.existsSync(filePath), 'lib/ai/merge.ts does not exist').toBe(true);
  });

  it('exports parallelRetrieveAndMerge function', async () => {
    const mod = await import('@/lib/ai/merge');
    expect(typeof mod.parallelRetrieveAndMerge).toBe('function');
  });

  it('parallelRetrieveAndMerge returns an array', async () => {
    const { parallelRetrieveAndMerge } = await import('@/lib/ai/merge');
    const results = await parallelRetrieveAndMerge('test query', [], {});
    expect(Array.isArray(results)).toBe(true);
  });

  it('parallelRetrieveAndMerge returns empty array when no corpora specified', async () => {
    const { parallelRetrieveAndMerge } = await import('@/lib/ai/merge');
    const results = await parallelRetrieveAndMerge('test query', [], {});
    expect(results).toHaveLength(0);
  });

  it('parallelRetrieveAndMerge calls retrievers for each corpus in parallel', async () => {
    const { EuMdrRetriever } = await import('@/lib/ai/retrievers/eu-mdr');
    const { MfdsRetriever } = await import('@/lib/ai/retrievers/mfds');

    const euMdrRetrieve = vi.fn().mockResolvedValue([makeResult('eu-1', 0.9)]);
    const mfdsRetrieve = vi.fn().mockResolvedValue([makeResult('mf-1', 0.8)]);

    vi.mocked(EuMdrRetriever).mockImplementation(() => ({
      corpus: 'eu-mdr',
      retrieve: euMdrRetrieve,
    }));

    vi.mocked(MfdsRetriever).mockImplementation(() => ({
      corpus: 'mfds',
      retrieve: mfdsRetrieve,
    }));

    const { parallelRetrieveAndMerge } = await import('@/lib/ai/merge');
    const results = await parallelRetrieveAndMerge('query', ['eu-mdr', 'mfds'], { limit: 5 });

    expect(euMdrRetrieve).toHaveBeenCalledWith('query', { limit: 5 });
    expect(mfdsRetrieve).toHaveBeenCalledWith('query', { limit: 5 });
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('parallelRetrieveAndMerge flattens results from multiple corpora', async () => {
    const { EuMdrRetriever } = await import('@/lib/ai/retrievers/eu-mdr');
    const { MfdsRetriever } = await import('@/lib/ai/retrievers/mfds');

    vi.mocked(EuMdrRetriever).mockImplementation(() => ({
      corpus: 'eu-mdr',
      retrieve: vi.fn().mockResolvedValue([makeResult('eu-1', 0.9), makeResult('eu-2', 0.8)]),
    }));

    vi.mocked(MfdsRetriever).mockImplementation(() => ({
      corpus: 'mfds',
      retrieve: vi.fn().mockResolvedValue([makeResult('mf-1', 0.7), makeResult('mf-2', 0.6)]),
    }));

    const { parallelRetrieveAndMerge } = await import('@/lib/ai/merge');
    const results = await parallelRetrieveAndMerge('query', ['eu-mdr', 'mfds'], {});

    // Should have results from both corpora, capped at 8
    expect(results.length).toBeLessThanOrEqual(8);
    const ids = results.map((r) => r.id);
    expect(ids).toContain('eu-1');
    expect(ids).toContain('mf-1');
  });

  it('parallelRetrieveAndMerge returns at most 8 results (top-8 cap)', async () => {
    const { EuMdrRetriever } = await import('@/lib/ai/retrievers/eu-mdr');

    const manyResults = Array.from({ length: 20 }, (_, i) => makeResult(`eu-${i}`, 1 - i * 0.04));

    vi.mocked(EuMdrRetriever).mockImplementation(() => ({
      corpus: 'eu-mdr',
      retrieve: vi.fn().mockResolvedValue(manyResults),
    }));

    const { parallelRetrieveAndMerge } = await import('@/lib/ai/merge');
    const results = await parallelRetrieveAndMerge('query', ['eu-mdr'], {});

    expect(results.length).toBeLessThanOrEqual(8);
  });

  it('parallelRetrieveAndMerge sorts by score descending when COHERE_API_KEY is absent', async () => {
    const { EuMdrRetriever } = await import('@/lib/ai/retrievers/eu-mdr');

    vi.mocked(EuMdrRetriever).mockImplementation(() => ({
      corpus: 'eu-mdr',
      retrieve: vi
        .fn()
        .mockResolvedValue([
          makeResult('low', 0.3),
          makeResult('high', 0.9),
          makeResult('mid', 0.6),
        ]),
    }));

    const { parallelRetrieveAndMerge } = await import('@/lib/ai/merge');
    const results = await parallelRetrieveAndMerge('query', ['eu-mdr'], {});

    // Without Cohere, results should be sorted by score descending
    for (let i = 0; i < results.length - 1; i++) {
      const curr = results[i];
      const next = results[i + 1];
      if (curr && next) {
        expect(curr.score).toBeGreaterThanOrEqual(next.score);
      }
    }
  });

  it('parallelRetrieveAndMerge handles unknown corpus name gracefully', async () => {
    const { parallelRetrieveAndMerge } = await import('@/lib/ai/merge');
    // Should not throw — unknown corpus is skipped
    await expect(parallelRetrieveAndMerge('query', ['unknown-corpus'], {})).resolves.toBeInstanceOf(
      Array,
    );
  });

  it('parallelRetrieveAndMerge recognizes fda corpus', async () => {
    const { FdaRetriever } = await import('@/lib/ai/retrievers/fda');

    const fdaRetrieve = vi.fn().mockResolvedValue([makeResult('fda-1', 0.85, 'fda')]);
    vi.mocked(FdaRetriever).mockImplementation(() => ({
      corpus: 'fda',
      retrieve: fdaRetrieve,
    }));

    const { parallelRetrieveAndMerge } = await import('@/lib/ai/merge');
    await parallelRetrieveAndMerge('query', ['fda'], {});

    expect(fdaRetrieve).toHaveBeenCalledWith('query', {});
  });
});
