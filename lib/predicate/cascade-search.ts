// @MX:ANCHOR [AUTO] 3-tier cascade predicate search with Vectorize rerank.
// @MX:REASON fan_in >= 3 expected: the search API route, cache-warming job, and
//   comparison builder (Tasks 3-4) all enter predicate discovery through search().
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-005, REQ-PRE-006, REQ-PRE-007)

import type { CascadeSearchResult, OpenFDADevice, PredicateCandidate } from './types';

/** Minimum candidates before tier-3 panel fallback is skipped (REQ-PRE-005). */
const MIN_CANDIDATES = 5;
/** Number of most-frequent product codes re-searched in tier 2. */
const TOP_PRODUCT_CODES = 3;
/** Final number of reranked candidates returned (REQ-PRE-006). */
const RESULT_LIMIT = 5;
/** Coverage-gap thresholds (REQ-PRE-007). */
const COVERAGE_CUTOFF = '2004-01-01';
const MIN_RESULTS_FOR_COVERAGE = 10;

/** One page of openFDA results, as produced by the openFDA client. */
interface OpenFDAPage {
  total: number;
  results: OpenFDADevice[];
}

/** The subset of the openFDA client this module depends on. */
export interface CascadeOpenFDAClient {
  search(params: {
    device_name?: string;
    product_code?: string;
    panel?: string;
  }): Promise<OpenFDAPage>;
}

/** A single rerank hit returned by the Vectorize retriever. */
interface RetrievalHit {
  id: string;
  score: number;
}

/** The subset of the Vectorize retriever this module depends on. */
export interface CascadeVectorizeRetriever {
  retrieve(query: string, opts?: { limit?: number }): Promise<RetrievalHit[]>;
}

/** Runtime env placeholder — reserved for future binding access (panel lookup). */
export type CascadeEnv = Record<string, unknown>;

export interface CascadeSearch {
  search(deviceName: string, env: CascadeEnv): Promise<CascadeSearchResult>;
}

/** Tally product codes and return the most frequent ones, descending. */
function topProductCodes(devices: OpenFDADevice[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const d of devices) {
    if (d.product_code) counts.set(d.product_code, (counts.get(d.product_code) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([code]) => code);
}

/** Deduplicate devices by k_number, preserving first-seen order. */
function dedupe(devices: OpenFDADevice[]): OpenFDADevice[] {
  const seen = new Set<string>();
  const out: OpenFDADevice[] = [];
  for (const d of devices) {
    if (seen.has(d.k_number)) continue;
    seen.add(d.k_number);
    out.push(d);
  }
  return out;
}

/** Sort candidates by decision_date descending (most recent first). */
function byRecency(candidates: PredicateCandidate[]): PredicateCandidate[] {
  return [...candidates].sort((a, b) => b.decision_date.localeCompare(a.decision_date));
}

/**
 * Rerank candidates via Vectorize, returning the top-N by score. Falls back to
 * recency sort when the retriever is absent, throws, or returns no hits.
 */
async function rerank(
  candidates: PredicateCandidate[],
  deviceName: string,
  retriever: CascadeVectorizeRetriever | undefined,
): Promise<PredicateCandidate[]> {
  if (retriever) {
    try {
      const hits = await retriever.retrieve(deviceName, { limit: candidates.length });
      if (hits.length > 0) {
        const scoreById = new Map(hits.map((h) => [h.id, h.score]));
        const scored = candidates
          .filter((c) => scoreById.has(c.k_number))
          .map((c) => ({ ...c, rerank_score: scoreById.get(c.k_number) }))
          .sort((a, b) => (b.rerank_score ?? 0) - (a.rerank_score ?? 0));
        if (scored.length > 0) return scored.slice(0, RESULT_LIMIT);
      }
    } catch {
      // Vectorize unavailable — fall through to recency sort.
    }
  }
  return byRecency(candidates).slice(0, RESULT_LIMIT);
}

/** True when the result set may have incomplete openFDA coverage (REQ-PRE-007). */
function hasCoverageGap(devices: OpenFDADevice[], total: number): boolean {
  if (total < MIN_RESULTS_FOR_COVERAGE) return true;
  return devices.some((d) => d.decision_date < COVERAGE_CUTOFF);
}

/**
 * Create a 3-tier cascade predicate search.
 *
 * Tier 1 searches by device name. Tier 2 re-searches the most frequent product
 * codes discovered in tier 1. Tier 3 falls back to a panel search when too few
 * candidates surface. Results are reranked via Vectorize (recency fallback).
 *
 * @param openfdaClient - openFDA 510(k) client (single-page search).
 * @param vectorizeRetriever - optional Vectorize reranker; omitted in test/dev.
 */
export function createCascadeSearch(
  openfdaClient: CascadeOpenFDAClient,
  vectorizeRetriever?: CascadeVectorizeRetriever,
): CascadeSearch {
  async function search(deviceName: string, _env: CascadeEnv): Promise<CascadeSearchResult> {
    let strategy: CascadeSearchResult['search_strategy'] = 'device_name';

    // Tier 1 — device name.
    const tier1 = await openfdaClient.search({ device_name: deviceName });
    let collected = [...tier1.results];
    let total = tier1.total;

    // Tier 2 — re-search the most frequent product codes.
    const codes = topProductCodes(tier1.results, TOP_PRODUCT_CODES);
    if (codes.length > 0) {
      strategy = 'product_code';
      for (const code of codes) {
        const page = await openfdaClient.search({ product_code: code });
        collected = collected.concat(page.results);
        total += page.total;
      }
    }

    collected = dedupe(collected);

    // Tier 3 — panel fallback when still insufficient.
    if (collected.length < MIN_CANDIDATES) {
      const panel = topProductCodes(collected, 1)[0];
      const page = await openfdaClient.search({ panel: panel ?? deviceName });
      collected = dedupe(collected.concat(page.results));
      total += page.total;
      strategy = 'panel';
    }

    const candidates = await rerank(collected, deviceName, vectorizeRetriever);

    return {
      candidates,
      total,
      search_strategy: strategy,
      cached: false,
      has_coverage_gap: hasCoverageGap(collected, total),
    };
  }

  return { search };
}
