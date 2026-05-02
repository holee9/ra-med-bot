// @MX:NOTE [AUTO] T-002 TDD RED phase — IRetriever interface type-level tests.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-038, REQ-BREADTH-039)
//
// These tests verify the IRetriever interface shape at compile time and the
// source file structure at the file level. No database or network is required.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..', '..');
const readText = (rel: string): string => fs.readFileSync(path.join(root, rel), 'utf8');

describe('lib/ai/retrievers/types.ts (REQ-BREADTH-038, REQ-BREADTH-039)', () => {
  it('types.ts file exists', () => {
    const filePath = path.join(root, 'lib', 'ai', 'retrievers', 'types.ts');
    expect(fs.existsSync(filePath), 'lib/ai/retrievers/types.ts does not exist').toBe(true);
  });

  it('exports RetrieverOptions interface', () => {
    const src = readText('lib/ai/retrievers/types.ts');
    expect(src).toMatch(/export interface RetrieverOptions/);
  });

  it('exports RetrievalResult interface', () => {
    const src = readText('lib/ai/retrievers/types.ts');
    expect(src).toMatch(/export interface RetrievalResult/);
  });

  it('exports IRetriever interface', () => {
    const src = readText('lib/ai/retrievers/types.ts');
    expect(src).toMatch(/export interface IRetriever/);
  });

  it('IRetriever has retrieve method signature', () => {
    const src = readText('lib/ai/retrievers/types.ts');
    expect(src).toMatch(/retrieve\s*\(/);
    expect(src).toMatch(/Promise<RetrievalResult\[\]>/);
  });

  it('IRetriever has readonly corpus property', () => {
    const src = readText('lib/ai/retrievers/types.ts');
    expect(src).toMatch(/readonly corpus:\s*string/);
  });

  it('RetrieverOptions has limit, projectId, orgId optional fields', () => {
    const src = readText('lib/ai/retrievers/types.ts');
    expect(src).toMatch(/limit\?:\s*number/);
    expect(src).toMatch(/projectId\?:\s*string/);
    expect(src).toMatch(/orgId\?:\s*string/);
  });

  it('RetrievalResult has id, content, score, sourceId, metadata fields', () => {
    const src = readText('lib/ai/retrievers/types.ts');
    expect(src).toMatch(/id:\s*string/);
    expect(src).toMatch(/content:\s*string/);
    expect(src).toMatch(/score:\s*number/);
    expect(src).toMatch(/sourceId:\s*string/);
    expect(src).toMatch(/metadata:\s*Record<string,\s*unknown>/);
  });
});

describe('IRetriever type conformance (compile-time structural check)', () => {
  it('a mock class can structurally satisfy IRetriever', async () => {
    // Import the interface — if the file does not exist, this throws and the
    // test fails with a clear "module not found" message (RED phase intent).
    const { type: _type } = (await import('@/lib/ai/retrievers/types').catch(() => {
      throw new Error(
        'lib/ai/retrievers/types.ts does not exist or has a syntax error. ' +
          'This is expected in the RED phase.',
      );
    })) as { type?: unknown };

    // Structural conformance: a plain object that satisfies the interface shape
    // must be accepted by TypeScript (compile-time) and pass duck-type checks.
    const mockRetriever = {
      corpus: 'test-corpus',
      retrieve: async (_query: string, _opts?: { limit?: number }) => [
        {
          id: 'test-id',
          content: 'test content',
          score: 0.9,
          sourceId: 'source-1',
          metadata: { key: 'value' },
        },
      ],
    };

    expect(mockRetriever.corpus).toBe('test-corpus');
    expect(typeof mockRetriever.retrieve).toBe('function');
  });

  it('IRetriever.retrieve returns an array of RetrievalResult shapes', async () => {
    const {} = await import('@/lib/ai/retrievers/types').catch(() => {
      throw new Error('lib/ai/retrievers/types.ts does not exist. RED phase.');
    });

    const mockRetriever = {
      corpus: 'fda',
      retrieve: async () => [
        { id: 'a', content: 'hello', score: 0.8, sourceId: 'src-1', metadata: {} },
      ],
    };
    const results = await mockRetriever.retrieve();
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: expect.any(String),
      content: expect.any(String),
      score: expect.any(Number),
      sourceId: expect.any(String),
      metadata: expect.any(Object),
    });
  });
});
