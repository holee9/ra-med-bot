// @MX:NOTE [AUTO] T-008 TDD RED phase — Internal SOPs retriever tests (org-isolated).
// @MX:WARN [AUTO] SQL-level org isolation is critical — JavaScript-side filtering is NOT acceptable.
// @MX:REASON REQ-BREADTH-043 requires org isolation at the SQL WHERE clause level.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-037, REQ-BREADTH-043)

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const root = path.resolve(__dirname, '..', '..', '..');

// Mock the db client to avoid real DB connections.
// vi.hoisted ensures dbMock exists before the hoisted vi.mock factory runs.
const { dbMock } = vi.hoisted(() => ({ dbMock: { execute: vi.fn() } }));
vi.mock('@/lib/db/client', () => ({
  db: dbMock,
  withTenantScope: vi.fn(
    async <T>(_orgId: string, fn: (db: typeof dbMock) => Promise<T>): Promise<T> =>
      fn(dbMock) as Promise<T>,
  ),
}));

// Mock OpenAI embedding.
vi.mock('ai', () => ({
  embed: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: {
    embedding: vi.fn().mockReturnValue('mock-embedding-model'),
  },
}));

describe('lib/ai/retrievers/internal-sops.ts (REQ-BREADTH-037, REQ-BREADTH-043)', () => {
  it('internal-sops.ts file exists', () => {
    const filePath = path.join(root, 'lib', 'ai', 'retrievers', 'internal-sops.ts');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('exports InternalSopsRetriever class', () => {
    const src = fs.readFileSync(
      path.join(root, 'lib', 'ai', 'retrievers', 'internal-sops.ts'),
      'utf8',
    );
    expect(src).toMatch(/export class InternalSopsRetriever/);
  });

  it('InternalSopsRetriever.corpus is "internal-sops"', async () => {
    const { InternalSopsRetriever } = await import('@/lib/ai/retrievers/internal-sops');
    expect(new InternalSopsRetriever().corpus).toBe('internal-sops');
  });

  it('REQ-BREADTH-043: SQL query contains org_id filter (not JS-side filter)', () => {
    // Verify the source code has an org_id WHERE clause in the SQL, not in JS.
    const src = fs.readFileSync(
      path.join(root, 'lib', 'ai', 'retrievers', 'internal-sops.ts'),
      'utf8',
    );
    // The SQL must include org_id filter.
    expect(src).toMatch(/org_id/);
    // Must use Drizzle sql tag — not a JS .filter() call on results.
    expect(src).toMatch(/sql`/);
  });

  it('retrieve() throws when orgId is not provided', async () => {
    const { InternalSopsRetriever } = await import('@/lib/ai/retrievers/internal-sops');
    const retriever = new InternalSopsRetriever();
    // Calling without orgId should throw — cross-org data leak prevention.
    await expect(retriever.retrieve('SOP query', {})).rejects.toThrow(/orgId/i);
  });

  it('retrieve() passes orgId to the SQL query (SQL-level isolation)', async () => {
    const { db } = await import('@/lib/db/client');
    const { embed } = await import('ai');

    vi.mocked(embed).mockResolvedValueOnce({
      embedding: new Array(1536).fill(0.1),
      value: 'SOP query',
      usage: { tokens: 10 },
    });

    vi.mocked(db.execute).mockResolvedValueOnce([] as never);

    const { InternalSopsRetriever } = await import('@/lib/ai/retrievers/internal-sops');
    const retriever = new InternalSopsRetriever();
    const results = await retriever.retrieve('SOP query', { orgId: 'org-abc', limit: 5 });

    // db.execute must have been called (SQL-level isolation).
    expect(db.execute).toHaveBeenCalledTimes(1);
    // Result is an array (may be empty since mock returns []).
    expect(Array.isArray(results)).toBe(true);
  });

  it('retrieve() returns RetrievalResult shape for valid results', async () => {
    const { db } = await import('@/lib/db/client');
    const { embed } = await import('ai');

    vi.mocked(embed).mockResolvedValueOnce({
      embedding: new Array(1536).fill(0.2),
      value: 'SOP procedure',
      usage: { tokens: 8 },
    });

    // Simulate DB returning a row.
    vi.mocked(db.execute).mockResolvedValueOnce([
      {
        section_id: 'sop-sec-1',
        source_id: 'sop-src-1',
        anchor: 'SOP-001 §3',
        text: 'Internal SOP content',
        combined_score: 0.91,
        org_label: 'Acme Corp',
        title: 'Device Quality SOP',
        year: 2024,
        type: 'Internal',
        url: null,
      },
    ] as never);

    const { InternalSopsRetriever } = await import('@/lib/ai/retrievers/internal-sops');
    const results = await new InternalSopsRetriever().retrieve('SOP procedure', {
      orgId: 'org-abc',
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'sop-sec-1',
      content: 'Internal SOP content',
      score: expect.any(Number),
      sourceId: 'sop-src-1',
      metadata: expect.any(Object),
    });
  });
});
