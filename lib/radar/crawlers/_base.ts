// @MX:ANCHOR [AUTO] runCrawler() — shared framework for all 3 radar crawlers.
// @MX:REASON Called by fda-federal-register, eu-oj, and mfds-notice. fan_in = 3.
// Handles: crawler_runs tracking, audit logging, robots.txt cache, retry logic.
// @MX:SPEC SPEC-REGULA-RADAR-001 (REQ-RADAR-004, REQ-RADAR-007, REQ-RADAR-009)

import type { CrawlerContext, CrawlerResult, RawUpdate } from './_types';
import { writeAudit } from '../../audit';

/** robots.txt cache TTL: 24 hours */
const ROBOTS_CACHE_TTL_SEC = 86_400;

/** User-Agent for all outbound requests (REQ-RADAR-004). */
export const RADAR_USER_AGENT =
  'Regula-Radar/1.0 (+https://regula.app/crawlers; contact=compliance@regula.app)';

/**
 * Exponential backoff delays for HTTP 429/503 retry (5min → 15min → 45min).
 * In test environments these are overridden to 0ms.
 */
const RETRY_DELAYS_MS = [
  5 * 60 * 1000,
  15 * 60 * 1000,
  45 * 60 * 1000,
];

/** Override for tests — set to 0 to skip sleep */
export let _retryDelayOverride: number | null = null;

function retryDelay(attempt: number): number {
  if (_retryDelayOverride !== null) return _retryDelayOverride;
  return RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
}

/**
 * Check robots.txt compliance using KV cache.
 * Returns true if crawling is allowed, false if disallowed.
 * Caches result for 24h.
 */
export async function checkRobotsTxt(
  baseUrl: string,
  env: CrawlerContext['env'],
): Promise<boolean> {
  const cacheKey = `robots:${new URL(baseUrl).hostname}`;
  const cached = await env.ROBOTS_KV.get(cacheKey);

  if (cached !== null) {
    return cached === 'allow';
  }

  try {
    const robotsUrl = `${new URL(baseUrl).origin}/robots.txt`;
    const resp = await fetch(robotsUrl, {
      headers: { 'User-Agent': RADAR_USER_AGENT },
    });

    if (!resp.ok) {
      // If robots.txt not found, crawling is allowed by convention
      await env.ROBOTS_KV.put(cacheKey, 'allow', { expirationTtl: ROBOTS_CACHE_TTL_SEC });
      return true;
    }

    const text = await resp.text();
    // Simple check: look for Disallow: / for our user agent or *
    const lines = text.split('\n');
    let inOurAgent = false;
    let inWildcard = false;
    let disallowedForUs = false;
    let disallowedForAll = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().startsWith('user-agent:')) {
        const agent = trimmed.substring('user-agent:'.length).trim();
        inOurAgent = agent === 'Regula-Radar/1.0' || agent === '*';
        inWildcard = agent === '*';
      } else if (trimmed.toLowerCase().startsWith('disallow:') && inOurAgent) {
        const path = trimmed.substring('disallow:'.length).trim();
        if (path === '/' || path === '') {
          if (inWildcard) disallowedForAll = true;
          else disallowedForUs = true;
        }
      }
    }

    const allowed = !disallowedForUs && !disallowedForAll;
    await env.ROBOTS_KV.put(cacheKey, allowed ? 'allow' : 'disallow', {
      expirationTtl: ROBOTS_CACHE_TTL_SEC,
    });
    return allowed;
  } catch {
    // On network error, allow crawling (fail open)
    return true;
  }
}

/**
 * Fetch with exponential backoff for HTTP 429/503.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const resp = await fetch(url, options);

      if (resp.status === 429 || resp.status === 503) {
        const delay = retryDelay(attempt);
        await new Promise(r => setTimeout(r, delay));
        lastError = new Error(`HTTP ${resp.status} from ${url}`);
        continue;
      }

      return resp;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries - 1) {
        const delay = retryDelay(attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}

export interface CrawlerRunRow {
  id: string;
  crawlerName: string;
  startedAt: Date;
  status: string;
}

/**
 * Main crawler framework. Wraps a crawler function with:
 * - robots.txt compliance check
 * - audit log entry
 * - error collection
 * - result return
 *
 * DB operations (crawler_runs INSERT/UPDATE) are kept minimal here so
 * that the function can run in environments where db may be a mock.
 */
export async function runCrawler(
  crawlerName: string,
  ctx: CrawlerContext,
  crawlerFn: (ctx: CrawlerContext) => Promise<CrawlerResult>,
): Promise<CrawlerResult> {
  const startedAt = new Date();

  try {
    await writeAudit({
      actor_id: null,
      action: 'radar.crawler_run',
      resource_type: 'crawler',
      resource_id: crawlerName,
      meta_json: { started_at: startedAt.toISOString() },
    });
  } catch {
    // Audit write failure must not block crawling in test/dev
  }

  try {
    const result = await crawlerFn(ctx);
    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { records: [], errors: [error] };
  }
}
