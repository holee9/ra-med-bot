// @MX:ANCHOR [AUTO] openFDA 510(k) API client — rate limiting, retry, pagination.
// @MX:REASON fan_in >= 3 expected: cascade search, cache warm-up, and comparison
//   builder (Tasks 2-4) all depend on createOpenFDAClient as the single API gateway.
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-001/002/003/004/008)

import type { OpenFDADevice, OpenFDASearchParams } from './types';

/** openFDA 510(k) endpoint. */
const OPENFDA_510K_ENDPOINT = 'https://api.fda.gov/device/510k.json';

/** Per-minute request budget without an API key (REQ-PRE-002). */
const RATE_LIMIT_NO_KEY = 240;
/** Per-minute request budget with an API key (REQ-PRE-002, REQ-PRE-008). */
const RATE_LIMIT_WITH_KEY = 1000;

/** Page size and total cap for pagination (REQ-PRE-004). */
const PAGE_SIZE = 100;
const MAX_RESULTS = 1000;

/** Retry budget and base backoff for 5xx errors (REQ-PRE-003). */
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

/** Shape of a parsed openFDA results page. */
export interface OpenFDAPage {
  total: number;
  results: OpenFDADevice[];
}

/** An HTTP error carrying the upstream status code. */
export class OpenFDAError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'OpenFDAError';
    this.status = status;
  }
}

export interface OpenFDAClient {
  /** Effective per-minute request budget for this client. */
  readonly requestsPerMinute: number;
  /** Run a single search request (one page). */
  search(params: OpenFDASearchParams): Promise<OpenFDAPage>;
  /** Async generator yielding individual device records across pages. */
  paginate(params: OpenFDASearchParams): AsyncGenerator<OpenFDADevice, void, unknown>;
}

export interface CreateOpenFDAClientEnv {
  KV_PREDICATE_CACHE?: KVNamespace;
  OPENFDA_API_KEY?: string;
  /** Injectable sleep — overridden in tests to avoid real backoff delays. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Build the openFDA `search` query string for the supported strategies. */
function buildSearchExpression(params: OpenFDASearchParams): string {
  const clauses: string[] = [];
  if (params.device_name) clauses.push(`device_name:"${params.device_name}"`);
  if (params.product_code) clauses.push(`product_code:"${params.product_code}"`);
  if (params.panel) clauses.push(`openfda.device_class:"${params.panel}"`);
  if (params.applicant) clauses.push(`applicant:"${params.applicant}"`);
  return clauses.join('+AND+');
}

/** Construct the fully-qualified request URL for a single page. */
function buildUrl(params: OpenFDASearchParams, apiKey: string | undefined): string {
  const url = new URL(OPENFDA_510K_ENDPOINT);
  const search = buildSearchExpression(params);
  // openFDA expects the unencoded `+AND+` operator, so append `search` raw.
  const query: string[] = [];
  if (search) query.push(`search=${search}`);
  query.push(`limit=${params.limit ?? PAGE_SIZE}`);
  query.push(`skip=${params.skip ?? 0}`);
  if (apiKey) query.push(`api_key=${apiKey}`);
  return `${url.toString()}?${query.join('&')}`;
}

/**
 * KV-backed token bucket: increments a per-minute counter and throws 429 when
 * the budget is exhausted. Degrades to a no-op when no KV namespace is bound.
 */
async function consumeToken(kv: KVNamespace | undefined, limit: number): Promise<void> {
  if (!kv) return;
  const minute = Math.floor(Date.now() / 60000);
  const key = `predicate:ratelimit:${minute}`;
  const raw = await kv.get(key);
  const current = raw ? Number.parseInt(raw, 10) : 0;
  if (current >= limit) {
    throw new OpenFDAError(429, 'openFDA rate limit exceeded');
  }
  // TTL of 120s safely outlives the 60s window.
  await kv.put(key, String(current + 1), { expirationTtl: 120 });
}

/** Fetch one page with exponential-backoff retry on 5xx (REQ-PRE-003). */
async function fetchPageWithRetry(
  url: string,
  sleep: (ms: number) => Promise<void>,
): Promise<OpenFDAPage> {
  let attempt = 0;
  // 1 initial attempt + MAX_RETRIES retries.
  // 4xx (incl. 429) are never retried — they throw immediately.
  for (;;) {
    const response = await fetch(url);
    if (response.ok) {
      const body = (await response.json()) as {
        meta?: { results?: { total?: number } };
        results?: OpenFDADevice[];
      };
      return {
        total: body.meta?.results?.total ?? body.results?.length ?? 0,
        results: body.results ?? [],
      };
    }

    if (response.status < 500) {
      throw new OpenFDAError(response.status, `openFDA request failed: ${response.status}`);
    }

    // 5xx — retry with exponential backoff until the budget is exhausted.
    if (attempt >= MAX_RETRIES) {
      throw new OpenFDAError(
        response.status,
        `openFDA request failed after retries: ${response.status}`,
      );
    }
    await sleep(BASE_BACKOFF_MS * 2 ** attempt);
    attempt += 1;
  }
}

/**
 * Create an openFDA 510(k) API client.
 *
 * @param env - Cloudflare bindings: KV cache for rate limiting and optional API key.
 * @returns A client exposing single-page `search` and a `paginate` generator.
 */
export function createOpenFDAClient(env: CreateOpenFDAClientEnv): OpenFDAClient {
  const apiKey = env.OPENFDA_API_KEY;
  const requestsPerMinute = apiKey ? RATE_LIMIT_WITH_KEY : RATE_LIMIT_NO_KEY;
  const kv = env.KV_PREDICATE_CACHE;
  const sleep = env.sleep ?? defaultSleep;

  async function search(params: OpenFDASearchParams): Promise<OpenFDAPage> {
    await consumeToken(kv, requestsPerMinute);
    const url = buildUrl(params, apiKey);
    return fetchPageWithRetry(url, sleep);
  }

  async function* paginate(
    params: OpenFDASearchParams,
  ): AsyncGenerator<OpenFDADevice, void, unknown> {
    let skip = 0;
    let yielded = 0;

    while (yielded < MAX_RESULTS) {
      const page = await search({ ...params, skip, limit: PAGE_SIZE });
      if (page.results.length === 0) return;

      for (const item of page.results) {
        if (yielded >= MAX_RESULTS) return;
        yield item;
        yielded += 1;
      }

      // A short page means there are no more results upstream.
      if (page.results.length < PAGE_SIZE) return;
      skip += PAGE_SIZE;
    }
  }

  return { requestsPerMinute, search, paginate };
}
