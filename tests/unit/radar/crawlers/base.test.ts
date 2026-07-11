// @MX:NOTE [AUTO] Unit tests for radar crawlers _base (REQ-RADAR-004/007/009).
// @MX:SPEC SPEC-REGULA-RADAR-001 / Issue #402 (coverage ratchet-up).
// Mocks fetch (vi.stubGlobal) + env.ROBOTS_KV + writeAudit. Fake timers for retry backoff.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { writeAuditMock } = vi.hoisted(() => ({
  writeAuditMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/audit', () => ({ writeAudit: writeAuditMock }));

import {
  RADAR_USER_AGENT,
  checkRobotsTxt,
  fetchWithRetry,
  runCrawler,
} from '@/lib/radar/crawlers/_base';
import type { CrawlerContext, RawUpdate } from '@/lib/radar/crawlers/_types';

const sampleRec: RawUpdate = {
  external_id: 'r1',
  title: 'Recall Notice',
  published_at: new Date('2026-01-01'),
  source_url: 'https://example.gov/r1',
  raw_content: 'content',
  region: 'US',
  source_crawler: 'fda-fr',
};

// biome-ignore lint/suspicious/noExplicitAny: test env shim
function makeEnv(robotsGet: (k: string) => Promise<string | null> = async () => null): any {
  const store = new Map<string, string>();
  return {
    ROBOTS_KV: {
      get: async (k: string) => (robotsGet === null ? (store.get(k) ?? null) : await robotsGet(k)),
      put: async (k: string, v: string) => {
        store.set(k, v);
      },
    },
  };
}

const ORIGIN = 'https://example.gov';

beforeEach(() => {
  writeAuditMock.mockClear();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('RADAR_USER_AGENT', () => {
  it('exports the Regula-Radar UA string', () => {
    expect(RADAR_USER_AGENT).toContain('Regula-Radar/1.0');
  });
});

describe('checkRobotsTxt (REQ-RADAR-007)', () => {
  it('returns cached "allow" without fetching', async () => {
    const env = makeEnv(async () => 'allow');
    expect(await checkRobotsTxt(`${ORIGIN}/path`, env)).toBe(true);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('returns cached "disallow"', async () => {
    const env = makeEnv(async () => 'disallow');
    expect(await checkRobotsTxt(`${ORIGIN}/path`, env)).toBe(false);
  });

  it('allows when robots.txt is 404 (convention) + caches allow', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 404 }));
    const env = makeEnv();
    expect(await checkRobotsTxt(`${ORIGIN}/x`, env)).toBe(true);
  });

  it('disallows when User-agent: * has Disallow: /', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('User-agent: *\nDisallow: /', { status: 200 }),
    );
    const env = makeEnv();
    expect(await checkRobotsTxt(`${ORIGIN}/x`, env)).toBe(false);
  });

  it('allows when no Disallow: / is present for our agent', async () => {
    // A specific non-root Disallow path (/private) does NOT block crawling —
    // the parser only flags path === '/' or path === '' (empty).
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('User-agent: *\nDisallow: /private\nAllow: /', { status: 200 }),
    );
    const env = makeEnv();
    expect(await checkRobotsTxt(`${ORIGIN}/x`, env)).toBe(true);
  });

  it('fails open (allows) on fetch network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network down'));
    const env = makeEnv();
    expect(await checkRobotsTxt(`${ORIGIN}/x`, env)).toBe(true);
  });
});

describe('fetchWithRetry (REQ-RADAR-009)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns the response on success (no retry)', async () => {
    const ok = new Response('ok', { status: 200 });
    vi.mocked(fetch).mockResolvedValueOnce(ok);
    const resp = await fetchWithRetry(`${ORIGIN}/feed`);
    expect(resp.status).toBe(200);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 then succeeds', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const promise = fetchWithRetry(`${ORIGIN}/feed`, {}, 3);
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    const resp = await promise;
    expect(resp.status).toBe(200);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries on persistent 503', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }));
    const promise = fetchWithRetry(`${ORIGIN}/feed`, {}, 2);
    // Promise.all: the expect(...).rejects handler attaches BEFORE timers drain,
    // so the rejection is never "unhandled" (the vitest fake-timer pitfall).
    await Promise.all([expect(promise).rejects.toThrow('HTTP 503'), vi.runAllTimersAsync()]);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it('retries on network error then throws if all fail', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('connection reset'));
    const promise = fetchWithRetry(`${ORIGIN}/feed`, {}, 2);
    await Promise.all([
      expect(promise).rejects.toThrow('connection reset'),
      vi.runAllTimersAsync(),
    ]);
  });
});

describe('runCrawler (REQ-RADAR-004)', () => {
  it('runs crawlerFn and writes radar.crawler_run audit', async () => {
    const ctx = { env: makeEnv() } as CrawlerContext;
    const result = await runCrawler('fda-fr', ctx, async () => ({
      records: [sampleRec],
      errors: [],
    }));
    expect(result.records).toHaveLength(1);
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'radar.crawler_run', resource_id: 'fda-fr' }),
    );
  });

  it('returns errors array (no throw) when crawlerFn throws', async () => {
    const ctx = { env: makeEnv() } as CrawlerContext;
    const result = await runCrawler('eu-oj', ctx, async () => {
      throw new Error('parse failed');
    });
    expect(result.records).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toBe('parse failed');
  });
});
