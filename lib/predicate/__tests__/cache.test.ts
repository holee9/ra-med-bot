// @vitest-environment node
// Unit tests for the KV-backed predicate search cache — SPEC-REGULA-PREDICATE-001
// (REQ-PRE-009 caching, REQ-PRE-021 generation-based invalidation,
//  REQ-PRE-025 50-result cap).

import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createPredicateCache } from '../cache';
import type { PredicateCandidate } from '../types';

/** Minimal in-memory KVNamespace stub matching the project KV interface. */
function makeKV() {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string, _opts?: { expirationTtl?: number }) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
}

/** Build a candidate with a deterministic k_number. */
function candidate(k: string): PredicateCandidate {
  return {
    k_number: k,
    applicant_name: 'Acme',
    device_name: 'Infusion Pump',
    decision_date: '2023-01-01',
    decision: 'SESE',
    product_code: 'ABC',
    statement_or_summary: 'S',
    device_description: 'D',
  };
}

const md5 = (s: string): string => createHash('md5').update(s).digest('hex');

describe('createPredicateCache — get/set lifecycle (REQ-PRE-009)', () => {
  it('returns null on a cache miss', async () => {
    const kv = makeKV();
    const cache = createPredicateCache(kv as unknown as KVNamespace);

    const result = await cache.get('infusion pump');

    expect(result).toBeNull();
  });

  it('stores results in KV under the md5-of-normalized-query key', async () => {
    const kv = makeKV();
    const cache = createPredicateCache(kv as unknown as KVNamespace);

    await cache.set('Infusion Pump', [candidate('K1')]);

    // Generation defaults to 0; key includes gen prefix + md5 of normalized query.
    const expectedHash = md5('infusion pump');
    const writeKey = kv.put.mock.calls
      .map((c) => String(c[0]))
      .find((k) => k.includes(expectedHash));
    expect(writeKey).toBeDefined();
    expect(writeKey).toContain('predicate:search:');
  });

  it('writes with a 24-hour TTL (expirationTtl: 86400)', async () => {
    const kv = makeKV();
    const cache = createPredicateCache(kv as unknown as KVNamespace);

    await cache.set('Infusion Pump', [candidate('K1')]);

    const searchWrite = kv.put.mock.calls.find((c) => String(c[0]).includes('predicate:search:'));
    expect(searchWrite?.[2]).toMatchObject({ expirationTtl: 86400 });
  });

  it('returns cached results on a hit without writing to KV', async () => {
    const kv = makeKV();
    const cache = createPredicateCache(kv as unknown as KVNamespace);

    await cache.set('Infusion Pump', [candidate('K1'), candidate('K2')]);
    kv.put.mockClear();

    const result = await cache.get('Infusion Pump');

    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result?.[0]?.k_number).toBe('K1');
    // A read must never write back.
    expect(kv.put).not.toHaveBeenCalled();
  });
});

describe('createPredicateCache — normalization', () => {
  it('treats differently-cased and -spaced queries as the same key', async () => {
    const kv = makeKV();
    const cache = createPredicateCache(kv as unknown as KVNamespace);

    await cache.set('Infusion   Pump', [candidate('K1')]);
    const result = await cache.get('  infusion pump  ');

    expect(result).not.toBeNull();
    expect(result?.[0]?.k_number).toBe('K1');
  });
});

describe('createPredicateCache — 50-result cap (REQ-PRE-025)', () => {
  it('caches at most the top 50 candidates', async () => {
    const kv = makeKV();
    const cache = createPredicateCache(kv as unknown as KVNamespace);

    const hundred = Array.from({ length: 100 }, (_, i) => candidate(`K${i}`));
    await cache.set('big query', hundred);

    const result = await cache.get('big query');

    expect(result).toHaveLength(50);
    // Order preserved (no ranking) — first 50 by input order.
    expect(result?.[0]?.k_number).toBe('K0');
    expect(result?.[49]?.k_number).toBe('K49');
  });
});

describe('createPredicateCache — no KV binding (no-op)', () => {
  it('returns null from get and never throws from set', async () => {
    const cache = createPredicateCache(undefined);

    await expect(cache.set('infusion pump', [candidate('K1')])).resolves.toBeUndefined();
    await expect(cache.get('infusion pump')).resolves.toBeNull();
    await expect(cache.invalidateAll()).resolves.toBeUndefined();
  });
});

describe('createPredicateCache — invalidateAll (REQ-PRE-021)', () => {
  it('increments the generation counter so prior entries are unreachable', async () => {
    const kv = makeKV();
    const cache = createPredicateCache(kv as unknown as KVNamespace);

    await cache.set('infusion pump', [candidate('K1')]);
    expect(await cache.get('infusion pump')).not.toBeNull();

    await cache.invalidateAll();

    // After a generation bump the old gen-0 key is no longer read.
    expect(await cache.get('infusion pump')).toBeNull();
  });

  it('persists the bumped generation counter to KV', async () => {
    const kv = makeKV();
    const cache = createPredicateCache(kv as unknown as KVNamespace);

    await cache.invalidateAll();

    const genWrite = kv.put.mock.calls.find((c) => String(c[0]) === 'predicate:gen');
    expect(genWrite).toBeDefined();
    expect(Number(genWrite?.[1])).toBeGreaterThanOrEqual(1);
  });
});
