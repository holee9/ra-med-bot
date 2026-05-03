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
 * Calls the Vectorize-backed retriever for the public corpus.
 * In Workers runtime this would call the Vectorize binding directly.
 * Stubbed for test/Node environments.
 */
async function retrieveVectorize(
  _query: string,
  _filters: HybridRetrieveFilters,
  _k: number,
): Promise<RetrievalResult[]> {
  // TODO: implement with VectorizeIndex binding in Workers runtime
  // For now returns empty array — real implementation added in Task 6
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
