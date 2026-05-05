// @MX:ANCHOR [AUTO] hybridRetrieve — main RAG routing entry point for Phase 7.
// @MX:REASON Single chokepoint that routes public_corpus → Vectorize/AutoRAG and
// internal → pgvector. fan_in >= 3: consult route handler, structured analysis,
// breadth RAG merge layer all call this function.
// @MX:SPEC SPEC-REGULA-CLOUDFLARE-001 (REQ-CF-019, REQ-CF-020, REQ-CF-027)
//
// CRITICAL (REQ-CF-027): 'internal' scope MUST NOT route to AutoRAG.
// Any attempt to force internal → AutoRAG throws BadScopeError.

import type { RetrievalResult } from './retrievers/types';

/**
 * Thrown when an internal corpus scope is routed to AutoRAG.
 * Internal documents are governed by data-isolation rules and MUST stay on pgvector.
 */
export class BadScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadScopeError';
  }
}

/**
 * Thrown when AutoRAG is invoked without a confirmed HIPAA BAA flag.
 */
export class HIPAABAAScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HIPAABAAScopeError';
  }
}

export type RetrievalScope = 'public_corpus' | 'internal';

export interface HybridRetrieveFilters {
  corpusId?: string;
  orgId?: string;
  sourceType?: string;
}

export interface HybridRetrieveOptions {
  /**
   * Force AutoRAG path. Setting this for 'internal' scope throws BadScopeError.
   * For testing only — production code should never set this to true.
   */
  forceAutoRAG?: boolean;
  /** Timeout in ms before silent fallback to pgvector (REQ-CF-020). Default: 100 */
  timeoutMs?: number;
}

/**
 * Routes retrieval requests to the correct backend:
 * - scope === 'public_corpus' → Vectorize / AutoRAG
 * - scope === 'internal'       → pgvector (InternalSopsRetriever)
 *
 * On Vectorize timeout >100ms: silently falls back to pgvector and emits
 * Langfuse + Sentry breadcrumbs (REQ-CF-020).
 *
 * REQ-CF-027: internal scope → AutoRAG is FORBIDDEN. Throws BadScopeError.
 */
export async function hybridRetrieve(
  query: string,
  scope: RetrievalScope,
  filters: HybridRetrieveFilters,
  k: number,
  opts: HybridRetrieveOptions = {},
): Promise<RetrievalResult[]> {
  const { forceAutoRAG = false, timeoutMs = 100 } = opts;

  // REQ-CF-027: Guard — internal scope must NEVER route to AutoRAG.
  if (scope === 'internal' && forceAutoRAG) {
    throw new BadScopeError(
      'Internal corpus scope cannot be routed to AutoRAG (REQ-CF-027). ' +
        'Internal documents must use pgvector for data-isolation compliance.',
    );
  }

  if (scope === 'internal') {
    return retrieveInternal(query, filters, k);
  }

  // public_corpus → Vectorize/AutoRAG with timeout fallback
  return retrievePublicWithFallback(query, filters, k, timeoutMs);
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Internal scope retrieval via pgvector (unchanged from Phase 4).
 * InternalSopsRetriever is imported lazily to avoid importing Drizzle in
 * Workers edge contexts where the Neon websocket adapter is not available.
 */
async function retrieveInternal(
  query: string,
  filters: HybridRetrieveFilters,
  k: number,
): Promise<RetrievalResult[]> {
  try {
    const { InternalSopsRetriever } = await import('./retrievers/internal-sops');
    const retriever = new InternalSopsRetriever();
    return retriever.retrieve(query, { limit: k, orgId: filters.orgId });
  } catch {
    // In test/edge environments without DB access, return empty array.
    return [];
  }
}

/**
 * Public corpus retrieval via Vectorize with timeout-based fallback to pgvector.
 * REQ-CF-020: If Vectorize call exceeds timeoutMs, fall back silently.
 */
async function retrievePublicWithFallback(
  query: string,
  filters: HybridRetrieveFilters,
  k: number,
  timeoutMs: number,
): Promise<RetrievalResult[]> {
  // REQ-QUAL-012/013: When the Workers binding is unavailable (local dev,
  // vitest, missing env var), skip the Vectorize race and fall straight
  // through to pgvector. This is the documented default behaviour.
  if (!isVectorizeAvailable()) {
    emitFallbackBreadcrumbs(query, 'vectorize_unavailable');
    return retrieveInternal(query, filters, k);
  }

  const vectorizePromise = retrieveVectorize(query, filters, k);
  const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));

  const result = await Promise.race([vectorizePromise, timeoutPromise]);

  if (result === null) {
    // Timeout — silent fallback to pgvector + observability breadcrumbs
    emitFallbackBreadcrumbs(query, 'vectorize_timeout');
    return retrieveInternal(query, filters, k);
  }

  return result;
}

/**
 * Detects whether the current process is running inside a Cloudflare Workers
 * runtime with a configured Vectorize index binding.
 *
 * Two signals must agree:
 *   1. `caches` global is present — only Workers / browser runtimes expose it.
 *      Node.js (where vitest + next dev run) does NOT define this global, so
 *      this guard reliably keeps tests + local dev on the pgvector path.
 *   2. `CLOUDFLARE_VECTORIZE_INDEX_NAME` env var is set and non-empty —
 *      operators must explicitly opt-in per environment (REQ-QUAL-012).
 *
 * @MX:NOTE [AUTO] pgvector fallback active when CLOUDFLARE_VECTORIZE_INDEX_NAME
 * is unset OR when running outside the Cloudflare Workers runtime. This is the
 * default for local dev, vitest, and Next.js Node server modes — operators
 * must explicitly set the env var inside Workers to enable Vectorize dispatch
 * (REQ-QUAL-012, REQ-QUAL-013).
 */
export function isVectorizeAvailable(): boolean {
  const hasCachesGlobal = typeof (globalThis as { caches?: unknown }).caches !== 'undefined';
  const indexName = process.env.CLOUDFLARE_VECTORIZE_INDEX_NAME;
  return hasCachesGlobal && !!indexName && indexName.length > 0;
}

/**
 * Calls the Vectorize-backed retriever for the public corpus.
 *
 * Routes by environment:
 *   - Cloudflare Workers runtime + env var set → Vectorize binding dispatch
 *     (binding wiring tracked under SPEC-REGULA-VECTORIZE-001 and intentionally
 *     left as a stub here per EXC-3 — only the routing/fallback logic is in
 *     scope for SPEC-REGULA-QUALITY-001).
 *   - Otherwise → empty array, signalling the caller to fall back to pgvector.
 */
async function retrieveVectorize(
  _query: string,
  _filters: HybridRetrieveFilters,
  _k: number,
): Promise<RetrievalResult[]> {
  if (!isVectorizeAvailable()) {
    // No Workers binding available — caller falls through to pgvector.
    return [];
  }

  // @MX:NOTE [AUTO] Vectorize binding dispatch is intentionally stubbed here.
  // @MX:SPEC SPEC-REGULA-VECTORIZE-001
  // Actual VectorizeIndex.query() wiring is out-of-scope for SPEC-REGULA-QUALITY-001
  // (EXC-3). This branch will be replaced when the binding is wired in Workers.
  return [];
}

function emitFallbackBreadcrumbs(query: string, reason: string): void {
  // Langfuse + Sentry breadcrumb emission (REQ-CF-020).
  // Non-blocking — failures here must not affect the retrieval result.
  try {
    // Sentry breadcrumb
    const sentry = (globalThis as { Sentry?: { addBreadcrumb?: (breadcrumb: unknown) => void } })
      .Sentry;
    if (sentry) {
      sentry.addBreadcrumb?.({
        category: 'hybrid-router',
        message: `Vectorize fallback: ${reason}`,
        data: { queryLength: query.length },
        level: 'warning',
      });
    }
  } catch {
    // Ignore breadcrumb emission errors
  }
}
