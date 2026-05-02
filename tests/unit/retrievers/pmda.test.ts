// @MX:NOTE [AUTO] T-007 TDD RED phase — PMDA (Japan) retriever tests.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-036)

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const root = path.resolve(__dirname, '..', '..', '..');

vi.mock('@/lib/ai/retrievers/hybrid-search', () => ({
  hybridSearch: vi.fn(),
}));

describe('lib/ai/retrievers/pmda.ts (REQ-BREADTH-036)', () => {
  it('pmda.ts file exists', () => {
    const filePath = path.join(root, 'lib', 'ai', 'retrievers', 'pmda.ts');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('exports PmdaRetriever class', () => {
    const src = fs.readFileSync(path.join(root, 'lib', 'ai', 'retrievers', 'pmda.ts'), 'utf8');
    expect(src).toMatch(/export class PmdaRetriever/);
  });

  it('PmdaRetriever.corpus is "pmda"', async () => {
    const { PmdaRetriever } = await import('@/lib/ai/retrievers/pmda');
    expect(new PmdaRetriever().corpus).toBe('pmda');
  });

  it('PmdaRetriever.retrieve() calls hybridSearch with corpus "pmda"', async () => {
    const { hybridSearch } = await import('@/lib/ai/retrievers/hybrid-search');
    vi.mocked(hybridSearch).mockResolvedValueOnce([]);

    const { PmdaRetriever } = await import('@/lib/ai/retrievers/pmda');
    await new PmdaRetriever().retrieve('薬機法', { limit: 6 });
    expect(hybridSearch).toHaveBeenCalledWith('薬機法', 'pmda', 6, 'all');
  });

  it('retrieve() uses default limit 10', async () => {
    const { hybridSearch } = await import('@/lib/ai/retrievers/hybrid-search');
    vi.mocked(hybridSearch).mockResolvedValueOnce([]);

    const { PmdaRetriever } = await import('@/lib/ai/retrievers/pmda');
    await new PmdaRetriever().retrieve('query');
    expect(hybridSearch).toHaveBeenCalledWith('query', 'pmda', 10, 'all');
  });
});
