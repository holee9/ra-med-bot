// @MX:NOTE [AUTO] Unit tests for vectorstore ops (SPEC-REGULA-DELTA-SYNC-001).
// @MX:SPEC SPEC-REGULA-DELTA-SYNC-001 (REQ-DELTA-007, REQ-DELTA-009, REQ-DELTA-010) / Issue #402 (coverage ratchet-up).
// @MX:REASON Covers all 5 exports: MAX_RETRY_COUNT constant, shouldRetry (retryable
//   vs non-retryable vs exhausted), buildVectorizeUpsertPayload (metadata merge +
//   version stamp), upsertWithRetry (success/retry/exhausted branches), and
//   defaultRetryDelay (exponential backoff). Pure functions — no DB/vector deps.

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_RETRY_COUNT,
  buildVectorizeUpsertPayload,
  defaultRetryDelay,
  shouldRetry,
  upsertWithRetry,
} from '@/lib/radar/delta-sync/vectorstore';

describe('MAX_RETRY_COUNT', () => {
  it('is 3 (SPEC completion criteria)', () => {
    expect(MAX_RETRY_COUNT).toBe(3);
  });
});

describe('shouldRetry', () => {
  it('returns false when retry count is already at the limit', () => {
    // At MAX_RETRY_COUNT, no further retries regardless of error type.
    expect(shouldRetry('network timeout', MAX_RETRY_COUNT)).toBe(false);
  });

  it('returns false when retry count exceeds the limit', () => {
    expect(shouldRetry('network timeout', MAX_RETRY_COUNT + 1)).toBe(false);
  });

  it('returns true for a retryable transient error (network timeout)', () => {
    expect(shouldRetry('network timeout', 0)).toBe(true);
  });

  it('returns true for a retryable 429/503 error', () => {
    expect(shouldRetry('Service Unavailable: 503', 1)).toBe(true);
    expect(shouldRetry('Too Many Requests: 429', 2)).toBe(true);
  });

  it('returns false for PII guard triggers (non-retryable)', () => {
    expect(shouldRetry('pii guard blocked the input', 0)).toBe(false);
  });

  it('returns false for auth errors (non-retryable)', () => {
    expect(shouldRetry('invalid api key', 0)).toBe(false);
    expect(shouldRetry('Unauthorized', 0)).toBe(false);
    expect(shouldRetry('forbidden', 0)).toBe(false);
  });

  it('returns false for validation errors (non-retryable)', () => {
    expect(shouldRetry('bad request: invalid payload', 0)).toBe(false);
    expect(shouldRetry('validation failed on field x', 0)).toBe(false);
  });

  it('matches non-retryable patterns case-insensitively', () => {
    expect(shouldRetry('PII GUARD triggered', 0)).toBe(false);
    expect(shouldRetry('INVALID API KEY', 0)).toBe(false);
    expect(shouldRetry('Forbidden', 0)).toBe(false);
  });

  it('still retries non-retryable-class errors when below the limit but message is clean', () => {
    // A generic transient message with no matching pattern → retryable.
    expect(shouldRetry('connection reset by peer', 0)).toBe(true);
  });
});

describe('buildVectorizeUpsertPayload', () => {
  it('transforms chunks into Vectorize upsert entries with merged metadata', () => {
    const chunks = [
      {
        id: 'chunk-1',
        text: 'hello world',
        embedding: [0.1, 0.2, 0.3],
        metadata: { source: 'iso-9001', page: 1 },
      },
    ];
    const result = buildVectorizeUpsertPayload(chunks, {
      ingestionRunId: 'run-abc',
      corpus: 'public',
    });

    expect(result).toHaveLength(1);
    const entry = result[0];
    expect(entry).toBeTruthy();
    expect(entry?.id).toBe('chunk-1');
    expect(entry?.values).toEqual([0.1, 0.2, 0.3]);
    // Metadata merges original + content + ingestionRunId + corpus + version.
    expect(entry?.metadata).toMatchObject({
      source: 'iso-9001',
      page: 1,
      content: 'hello world',
      ingestionRunId: 'run-abc',
      corpus: 'public',
    });
    // version is a Date.now() stamp — must be a positive integer.
    expect(typeof entry?.metadata.version).toBe('number');
    expect(entry?.metadata.version).toBeGreaterThan(0);
  });

  it('handles multiple chunks and preserves order', () => {
    const chunks = [
      { id: 'a', text: 'a', embedding: [1], metadata: {} },
      { id: 'b', text: 'b', embedding: [2], metadata: {} },
      { id: 'c', text: 'c', embedding: [3], metadata: {} },
    ];
    const result = buildVectorizeUpsertPayload(chunks, {
      ingestionRunId: 'run-1',
      corpus: 'internal',
    });
    expect(result.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('produces an empty array for empty input', () => {
    expect(buildVectorizeUpsertPayload([], { ingestionRunId: 'run-x', corpus: 'public' })).toEqual(
      [],
    );
  });

  it('allows original metadata to override defaults (spread order: original first)', () => {
    // Original metadata is spread first, then content/ingestionRunId/corpus/version
    // are added. If the original has a conflicting key, it is overwritten by the
    // explicit keys below (content/ingestionRunId/corpus/version always win).
    const chunks = [
      {
        id: 'chunk-1',
        text: 'the real content',
        embedding: [0.5],
        metadata: { ingestionRunId: 'stale-id', extra: 'preserved' },
      },
    ];
    const result = buildVectorizeUpsertPayload(chunks, {
      ingestionRunId: 'new-run',
      corpus: 'public',
    });
    // Explicit ingestionRunId wins over the original.
    expect(result[0]?.metadata.ingestionRunId).toBe('new-run');
    // Non-conflicting original keys are preserved.
    expect(result[0]?.metadata.extra).toBe('preserved');
    expect(result[0]?.metadata.content).toBe('the real content');
  });
});

describe('upsertWithRetry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the result and resets retry count on success (no prior retry)', async () => {
    const upsertFn = vi.fn().mockResolvedValue('ok');
    const result = await upsertWithRetry(
      upsertFn,
      'network timeout',
      0,
      () => 0, // no delay
    );
    expect(result).toEqual({ result: 'ok', nextRetryCount: 0, exhausted: false });
    expect(upsertFn).toHaveBeenCalledTimes(1);
  });

  it('waits before retrying when currentRetryCount > 0', async () => {
    // When already retried once, the delay function is called with the count.
    const delayMs = vi.fn().mockReturnValue(0);
    const upsertFn = vi.fn().mockResolvedValue('recovered');
    const result = await upsertWithRetry(upsertFn, 'transient', 1, delayMs);
    expect(result.result).toBe('recovered');
    expect(delayMs).toHaveBeenCalledWith(1);
  });

  it('does NOT call the upsert fn when shouldRetry returns false (non-retryable)', async () => {
    const upsertFn = vi.fn();
    const result = await upsertWithRetry(
      upsertFn,
      'pii guard blocked', // non-retryable
      0,
      () => 0,
    );
    expect(result).toEqual({ result: null, nextRetryCount: 0, exhausted: true });
    expect(upsertFn).not.toHaveBeenCalled();
  });

  it('does NOT retry when already at MAX_RETRY_COUNT', async () => {
    const upsertFn = vi.fn();
    const result = await upsertWithRetry(
      upsertFn,
      'network timeout', // retryable-class, but count exhausted
      MAX_RETRY_COUNT,
      () => 0,
    );
    expect(result).toEqual({ result: null, nextRetryCount: MAX_RETRY_COUNT, exhausted: true });
    expect(upsertFn).not.toHaveBeenCalled();
  });

  it('increments retry count and continues when upsert throws (below limit)', async () => {
    const upsertFn = vi.fn().mockRejectedValue(new Error('boom'));
    const result = await upsertWithRetry(
      upsertFn,
      'transient',
      0, // first attempt
      () => 0,
    );
    expect(result).toEqual({ result: null, nextRetryCount: 1, exhausted: false });
    expect(upsertFn).toHaveBeenCalledTimes(1);
  });

  it('marks exhausted when the throw pushes retry count to MAX_RETRY_COUNT', async () => {
    // currentRetryCount = MAX_RETRY_COUNT - 1 → on throw, next = MAX → exhausted.
    const upsertFn = vi.fn().mockRejectedValue(new Error('boom'));
    const result = await upsertWithRetry(upsertFn, 'transient', MAX_RETRY_COUNT - 1, () => 0);
    expect(result).toEqual({ result: null, nextRetryCount: MAX_RETRY_COUNT, exhausted: true });
  });

  it('returns a typed result preserving the upsert fn return value type', async () => {
    const upsertFn = vi.fn().mockResolvedValue({ inserted: 42 });
    const result = await upsertWithRetry(upsertFn, 'transient', 0, () => 0);
    expect(result.result).toEqual({ inserted: 42 });
    expect(result.result).not.toBeNull();
  });
});

describe('defaultRetryDelay', () => {
  it('returns exponential backoff: 1s, 2s, 4s for attempts 0/1/2', () => {
    expect(defaultRetryDelay(0)).toBe(1000);
    expect(defaultRetryDelay(1)).toBe(2000);
    expect(defaultRetryDelay(2)).toBe(4000);
  });

  it('scales as 2^attempt * 1000ms', () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      expect(defaultRetryDelay(attempt)).toBe(2 ** attempt * 1000);
    }
  });
});
