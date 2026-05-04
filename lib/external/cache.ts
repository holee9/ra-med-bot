// @MX:ANCHOR: [AUTO] Shared cache wrapper — external integration point called by fda-510k, fda-maude, eudamed, and external-enrichment.
// @MX:REASON: All external API callers funnel through withCache for consistent 24h TTL and bypass support.
// @MX:SPEC: SPEC-REGULA-NETWORK-001 (REQ-EXT-009)

import { unstable_cache } from 'next/cache';

const CACHE_TTL_SECONDS = 86400; // 24 hours

/**
 * Wraps an async function with Next.js unstable_cache for 24-hour TTL caching.
 * Bypassed when DISABLE_EXTERNAL_CACHE=true (useful for testing / dev).
 *
 * @param fn       The async function to cache.
 * @param params   Parameters to derive the cache key from.
 * @param fnName   Logical name of the function (used in cache key).
 */
export async function withCache<T>(
  fn: (...args: unknown[]) => Promise<T>,
  params: unknown,
  fnName: string,
): Promise<T> {
  if (process.env.DISABLE_EXTERNAL_CACHE === 'true') {
    return fn(params);
  }

  const cacheKey = `${fnName}:${JSON.stringify(params)}`;
  const cached = unstable_cache(() => fn(params), [cacheKey], {
    revalidate: CACHE_TTL_SECONDS,
    tags: [`external:${fnName}`],
  });

  return cached();
}
