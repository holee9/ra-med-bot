// @vitest-environment node
// Unit tests for the openFDA API client — SPEC-REGULA-PREDICATE-001
// (REQ-PRE-001 query builder, REQ-PRE-002 rate limiting, REQ-PRE-003 retry,
//  REQ-PRE-004 pagination, REQ-PRE-008 API key support).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOpenFDAClient } from '../openfda-client';

/** Minimal in-memory KVNamespace stub matching the project KV interface. */
function makeKV() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
}

/** Build a Response-like object that openFDA would return for a results page. */
function fdaResponse(results: unknown[], total = results.length): Response {
  return new Response(JSON.stringify({ meta: { results: { total } }, results }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** Extract the URL passed to the first fetch call in a strict-safe way. */
function firstFetchUrl(mock: { mock: { calls: unknown[][] } }): string {
  return String(mock.mock.calls[0]?.[0]);
}

function device(k: string): Record<string, unknown> {
  return {
    k_number: k,
    applicant_name: 'Acme',
    device_name: 'Device',
    decision_date: '2023-01-01',
    decision: 'SESE',
    product_code: 'ABC',
    statement_or_summary: 'S',
    device_description: 'D',
  };
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('createOpenFDAClient — rate limiting (REQ-PRE-002)', () => {
  it('returns 429 once the per-minute token budget is exhausted', async () => {
    const kv = makeKV();
    globalThis.fetch = vi.fn(async () => fdaResponse([device('K1')]));

    const client = createOpenFDAClient({ KV_PREDICATE_CACHE: kv as unknown as KVNamespace });

    // Default budget without API key is 240/min. The 250th call must be rejected.
    let lastError: unknown;
    let rejectedAt = -1;
    for (let i = 1; i <= 250; i++) {
      try {
        await client.search({ device_name: 'catheter' });
      } catch (err) {
        lastError = err;
        rejectedAt = i;
        break;
      }
    }

    expect(rejectedAt).toBeGreaterThan(240);
    expect((lastError as { status?: number })?.status).toBe(429);
  });
});

describe('createOpenFDAClient — exponential backoff retry (REQ-PRE-003)', () => {
  it('retries 5xx errors and succeeds on the third attempt', async () => {
    const kv = makeKV();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('err', { status: 503 }))
      .mockResolvedValueOnce(new Response('err', { status: 503 }))
      .mockResolvedValueOnce(fdaResponse([device('K1')]));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = createOpenFDAClient({
      KV_PREDICATE_CACHE: kv as unknown as KVNamespace,
      // Skip real sleeps in tests.
      sleep: async () => {},
    } as never);

    const result = await client.search({ device_name: 'catheter' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.results).toHaveLength(1);
  });

  it('throws after exceeding the max retry budget on persistent 5xx', async () => {
    const kv = makeKV();
    const fetchMock = vi.fn(async () => new Response('err', { status: 503 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = createOpenFDAClient({
      KV_PREDICATE_CACHE: kv as unknown as KVNamespace,
      sleep: async () => {},
    } as never);

    await expect(client.search({ device_name: 'catheter' })).rejects.toMatchObject({
      status: 503,
    });
    // 1 initial + 3 retries = 4 total calls.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does NOT retry a 429 response — returns immediately', async () => {
    const kv = makeKV();
    const fetchMock = vi.fn(async () => new Response('rate limited', { status: 429 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = createOpenFDAClient({
      KV_PREDICATE_CACHE: kv as unknown as KVNamespace,
      sleep: async () => {},
    } as never);

    await expect(client.search({ device_name: 'catheter' })).rejects.toMatchObject({
      status: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry a 4xx (400) response', async () => {
    const kv = makeKV();
    const fetchMock = vi.fn(async () => new Response('bad request', { status: 400 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = createOpenFDAClient({
      KV_PREDICATE_CACHE: kv as unknown as KVNamespace,
      sleep: async () => {},
    } as never);

    await expect(client.search({ device_name: 'catheter' })).rejects.toMatchObject({
      status: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('createOpenFDAClient — pagination generator (REQ-PRE-004)', () => {
  it('yields three pages (100 + 100 + 50 = 250) then stops on a short page', async () => {
    const kv = makeKV();
    const page1 = Array.from({ length: 100 }, (_, i) => device(`A${i}`));
    const page2 = Array.from({ length: 100 }, (_, i) => device(`B${i}`));
    const page3 = Array.from({ length: 50 }, (_, i) => device(`C${i}`));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fdaResponse(page1, 250))
      .mockResolvedValueOnce(fdaResponse(page2, 250))
      .mockResolvedValueOnce(fdaResponse(page3, 250));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = createOpenFDAClient({
      KV_PREDICATE_CACHE: kv as unknown as KVNamespace,
      sleep: async () => {},
    } as never);

    const collected: unknown[] = [];
    for await (const item of client.paginate({ device_name: 'catheter' })) {
      collected.push(item);
    }

    expect(collected).toHaveLength(250);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('stops at 1000 items even when more are available', async () => {
    const kv = makeKV();
    const fullPage = Array.from({ length: 100 }, (_, i) => device(`X${i}`));
    const fetchMock = vi.fn(async () => fdaResponse(fullPage, 5000));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = createOpenFDAClient({
      KV_PREDICATE_CACHE: kv as unknown as KVNamespace,
      sleep: async () => {},
    } as never);

    const collected: unknown[] = [];
    for await (const item of client.paginate({ device_name: 'catheter' })) {
      collected.push(item);
    }

    expect(collected).toHaveLength(1000);
    // 1000 items / 100 per page = 10 fetches, no more.
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });
});

describe('createOpenFDAClient — API key support (REQ-PRE-008)', () => {
  it('uses the 1000 req/min budget when OPENFDA_API_KEY is present', async () => {
    const kv = makeKV();
    globalThis.fetch = vi.fn(async () => fdaResponse([device('K1')]));

    const client = createOpenFDAClient({
      KV_PREDICATE_CACHE: kv as unknown as KVNamespace,
      OPENFDA_API_KEY: 'secret-key',
    });

    expect(client.requestsPerMinute).toBe(1000);
  });

  it('falls back to the 240 req/min budget without an API key', async () => {
    const kv = makeKV();
    globalThis.fetch = vi.fn(async () => fdaResponse([device('K1')]));

    const client = createOpenFDAClient({ KV_PREDICATE_CACHE: kv as unknown as KVNamespace });
    expect(client.requestsPerMinute).toBe(240);
  });

  it('appends the api_key query parameter to outgoing requests', async () => {
    const kv = makeKV();
    const fetchMock = vi.fn(async () => fdaResponse([device('K1')]));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = createOpenFDAClient({
      KV_PREDICATE_CACHE: kv as unknown as KVNamespace,
      OPENFDA_API_KEY: 'secret-key',
    });

    await client.search({ device_name: 'catheter' });
    const calledUrl = firstFetchUrl(fetchMock);
    expect(calledUrl).toContain('api_key=secret-key');
  });
});

describe('createOpenFDAClient — query builder (REQ-PRE-001)', () => {
  it('builds a device_name search query against the 510k endpoint', async () => {
    const kv = makeKV();
    const fetchMock = vi.fn(async () => fdaResponse([device('K1')]));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = createOpenFDAClient({ KV_PREDICATE_CACHE: kv as unknown as KVNamespace });
    await client.search({ device_name: 'catheter' });

    const calledUrl = firstFetchUrl(fetchMock);
    expect(calledUrl).toContain('https://api.fda.gov/device/510k.json');
    expect(calledUrl).toContain('device_name');
    expect(decodeURIComponent(calledUrl)).toContain('catheter');
  });

  it('builds a product_code search query', async () => {
    const kv = makeKV();
    const fetchMock = vi.fn(async () => fdaResponse([device('K1')]));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = createOpenFDAClient({ KV_PREDICATE_CACHE: kv as unknown as KVNamespace });
    await client.search({ product_code: 'DXY' });

    const calledUrl = decodeURIComponent(firstFetchUrl(fetchMock));
    expect(calledUrl).toContain('product_code');
    expect(calledUrl).toContain('DXY');
  });
});
