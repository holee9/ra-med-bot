// @MX:ANCHOR [AUTO] KV-backed predicate search cache with generation-based invalidation.
// @MX:REASON fan_in >= 3 expected: cascade search, the search API route, and the
//   cache-warming job (Tasks 2-4) all read/write through createPredicateCache.
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-009, REQ-PRE-021, REQ-PRE-025)

import { createHash } from 'node:crypto';
import type { PredicateCandidate } from './types';

/** Cache entries live for 24 hours (REQ-PRE-009). */
const TTL_SECONDS = 86_400;
/** Cap the number of cached candidates per query (REQ-PRE-025). */
const MAX_CACHED_RESULTS = 50;
/** KV key holding the monotonic cache generation counter (REQ-PRE-021). */
const GENERATION_KEY = 'predicate:gen';

/** Serialized cache entry stored as the KV value. */
interface CacheEntry {
  results: PredicateCandidate[];
  timestamp: number;
  query: string;
}

export interface PredicateCache {
  /** Return cached candidates for a query, or null on a miss. */
  get(query: string): Promise<PredicateCandidate[] | null>;
  /** Cache up to the top-50 candidates for a query (24h TTL). */
  set(query: string, results: PredicateCandidate[]): Promise<void>;
  /** Invalidate every cached entry by bumping the generation counter. */
  invalidateAll(): Promise<void>;
}

/** Lowercase, trim, and collapse internal whitespace for a stable cache key. */
function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Build the gen-prefixed KV key for a normalized query. */
function searchKey(generation: number, query: string): string {
  const hash = createHash('md5').update(normalizeQuery(query)).digest('hex');
  return `predicate:search:${generation}:${hash}`;
}

/**
 * Create a KV-backed predicate search cache.
 *
 * Cloudflare KV cannot delete by prefix, so invalidation uses a generation
 * counter: every key is namespaced by the current generation, and bumping the
 * counter renders all prior entries unreachable (they expire naturally via TTL).
 *
 * @param kv - The predicate KV namespace, or undefined to disable caching (no-op).
 */
export function createPredicateCache(kv: KVNamespace | undefined): PredicateCache {
  async function currentGeneration(): Promise<number> {
    if (!kv) return 0;
    const raw = await kv.get(GENERATION_KEY);
    return raw ? Number.parseInt(raw, 10) || 0 : 0;
  }

  async function get(query: string): Promise<PredicateCandidate[] | null> {
    if (!kv) return null;
    const generation = await currentGeneration();
    const raw = await kv.get(searchKey(generation, query));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    return entry.results;
  }

  async function set(query: string, results: PredicateCandidate[]): Promise<void> {
    if (!kv) return;
    const generation = await currentGeneration();
    const entry: CacheEntry = {
      results: results.slice(0, MAX_CACHED_RESULTS),
      timestamp: Date.now(),
      query: normalizeQuery(query),
    };
    await kv.put(searchKey(generation, query), JSON.stringify(entry), {
      expirationTtl: TTL_SECONDS,
    });
  }

  async function invalidateAll(): Promise<void> {
    if (!kv) return;
    const next = (await currentGeneration()) + 1;
    await kv.put(GENERATION_KEY, String(next));
  }

  return { get, set, invalidateAll };
}
