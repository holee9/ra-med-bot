// @MX:NOTE [AUTO] TDD RED-GREEN phase — SPEC-REGULA-DELTA-SYNC-001 (Issue #45).
// @MX:SPEC SPEC-REGULA-DELTA-SYNC-001
//
// Unit tests for corpus delta-sync pipeline. Covers:
//   A. Change detection (content hash comparison)
//   B. Incremental chunking/embedding (outdate + upsert)
//   C. Vector store sync (pgvector upsert contract, Vectorize stub, retry queue)
//   D. Gap replay hook (#35 integration stub)

import { describe, expect, it } from 'vitest';
import {
  type ChangeDetectionResult,
  computeContentHash,
  detectChanges,
} from '../../lib/radar/delta-sync/detector';
import { shouldTriggerGapReplay } from '../../lib/radar/delta-sync/gap-replay';
import { type ChunkDelta, buildOutdateOperations } from '../../lib/radar/delta-sync/ingest';
import {
  MAX_RETRY_COUNT,
  buildVectorizeUpsertPayload,
  shouldRetry,
} from '../../lib/radar/delta-sync/vectorstore';

// ---------------------------------------------------------------------------
// A. Change detection
// ---------------------------------------------------------------------------
describe('delta-sync detector — A. change detection', () => {
  it('computeContentHash returns deterministic sha256 hex', () => {
    const hash1 = computeContentHash('FDA guidance content', 'https://fda.gov/abc');
    const hash2 = computeContentHash('FDA guidance content', 'https://fda.gov/abc');
    const hash3 = computeContentHash('FDA guidance content CHANGED', 'https://fda.gov/abc');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detectChanges returns "unchanged" when hash matches existing', () => {
    const content = 'Same content';
    const url = 'https://fda.gov/x';
    const hash = computeContentHash(content, url);

    const result = detectChanges({
      crawlerName: 'fda-federal-register',
      sourceUrl: url,
      rawContent: content,
      existingHash: hash,
    });

    expect(result.status).toBe('unchanged');
    expect(result.contentHash).toBe(hash);
  });

  it('detectChanges returns "new" when existingHash is null', () => {
    const result = detectChanges({
      crawlerName: 'fda-federal-register',
      sourceUrl: 'https://fda.gov/new',
      rawContent: 'New document',
      existingHash: null,
    });

    expect(result.status).toBe('new');
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detectChanges returns "changed" when hash differs', () => {
    const result = detectChanges({
      crawlerName: 'fda-federal-register',
      sourceUrl: 'https://fda.gov/x',
      rawContent: 'Updated content',
      existingHash: '0'.repeat(64),
    });

    expect(result.status).toBe('changed');
    expect(result.contentHash).not.toBe('0'.repeat(64));
  });

  it('detectChanges includes crawlerName and sourceUrl in result', () => {
    const result: ChangeDetectionResult = detectChanges({
      crawlerName: 'eu-oj',
      sourceUrl: 'https://eur-lex.europa.eu/123',
      rawContent: 'EU regulation',
      existingHash: null,
    });

    expect(result.crawlerName).toBe('eu-oj');
    expect(result.sourceUrl).toBe('https://eur-lex.europa.eu/123');
  });
});

// ---------------------------------------------------------------------------
// B. Incremental chunking/embedding operations
// ---------------------------------------------------------------------------
describe('delta-sync ingest — B. incremental chunking', () => {
  it('buildOutdateOperations marks all existing chunk ids as superseded', () => {
    const existingIds = ['chunk-1', 'chunk-2', 'chunk-3'];
    const ops = buildOutdateOperations(existingIds, 'new-run-id');

    expect(ops).toHaveLength(3);
    expect(ops[0]).toEqual({
      id: 'chunk-1',
      supersededBy: 'new-run-id',
      updatedAt: expect.any(Date),
    });
  });

  it('buildOutdateOperations returns empty array for no existing chunks', () => {
    const ops = buildOutdateOperations([], 'new-run-id');
    expect(ops).toEqual([]);
  });

  it('ChunkDelta distinguishes added vs outdated counts', () => {
    const delta: ChunkDelta = {
      added: [{ text: 'new chunk', embedding: [0.1, 0.2], metadata: {} }],
      outdated: ['old-1', 'old-2'],
      unchanged: [],
    };

    expect(delta.added).toHaveLength(1);
    expect(delta.outdated).toHaveLength(2);
    expect(delta.unchanged).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// C. Vector store sync
// ---------------------------------------------------------------------------
describe('delta-sync vectorstore — C. vector store sync', () => {
  it('buildVectorizeUpsertPayload includes id, values, and version metadata', () => {
    const chunks = [
      {
        id: 'sec-1',
        text: 'FDA clearance guidance',
        embedding: [0.1, 0.2, 0.3],
        metadata: { source: 'fda' },
      },
    ];

    const payload = buildVectorizeUpsertPayload(chunks, {
      ingestionRunId: 'run-2026-001',
      corpus: 'fda',
    });

    expect(payload).toHaveLength(1);
    const first = payload[0];
    expect(first?.id).toBe('sec-1');
    expect(first?.values).toEqual([0.1, 0.2, 0.3]);
    expect(first?.metadata).toMatchObject({
      ingestionRunId: 'run-2026-001',
      corpus: 'fda',
      content: 'FDA clearance guidance',
      version: expect.any(Number),
    });
  });

  it('shouldRetry returns true for retryable errors below max', () => {
    expect(shouldRetry('network timeout', 0)).toBe(true);
    expect(shouldRetry('network timeout', MAX_RETRY_COUNT - 1)).toBe(true);
  });

  it('shouldRetry returns false at or above max retries', () => {
    expect(shouldRetry('network timeout', MAX_RETRY_COUNT)).toBe(false);
    expect(shouldRetry('network timeout', MAX_RETRY_COUNT + 1)).toBe(false);
  });

  it('shouldRetry returns false for non-retryable errors', () => {
    expect(shouldRetry('PII guard triggered', 0)).toBe(false);
    expect(shouldRetry('Invalid API key', 0)).toBe(false);
  });

  it('MAX_RETRY_COUNT is 3 per SPEC requirement', () => {
    expect(MAX_RETRY_COUNT).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// D. Gap replay hook (#35 Knowledge Gap Ops integration stub)
// ---------------------------------------------------------------------------
describe('delta-sync gap-replay — D. #35 knowledge gap loop', () => {
  it('shouldTriggerGapReplay returns true when content targets a known gap', () => {
    const result = shouldTriggerGapReplay({
      crawlerName: 'fda-federal-register',
      matchedGapIds: ['gap-001', 'gap-002'],
    });

    expect(result).toBe(true);
  });

  it('shouldTriggerGapReplay returns false when no gaps matched', () => {
    const result = shouldTriggerGapReplay({
      crawlerName: 'fda-federal-register',
      matchedGapIds: [],
    });

    expect(result).toBe(false);
  });

  it('shouldTriggerGapReplay returns false when matchedGapIds is undefined', () => {
    const result = shouldTriggerGapReplay({
      crawlerName: 'fda-federal-register',
    });

    expect(result).toBe(false);
  });
});
