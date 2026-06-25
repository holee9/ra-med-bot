// @MX:ANCHOR [AUTO] RAG Merge — parallel retrieval + top-8 result selection.
// @MX:REASON Called by the consult pipeline after classifyAndRoute. fan_in >= 3:
// consult.ts, tests, future batch analysis jobs.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-039, REQ-BREADTH-042)

import { logger } from '@/lib/observability/logger';
import { applyRlhfReranking } from '@/lib/rlhf/retrieval-hook';
import { EuMdrRetriever } from './retrievers/eu-mdr';
import { FdaRetriever } from './retrievers/fda';
import { InternalSopsRetriever } from './retrievers/internal-sops';
import { MfdsRetriever } from './retrievers/mfds';
import { NmpaRetriever } from './retrievers/nmpa';
import { PmdaRetriever } from './retrievers/pmda';
import type { IRetriever, RetrievalResult, RetrieverOptions } from './retrievers/types';

/** Indicates whether a result came from public regulatory corpora or org-internal documents. */
export type CorpusType = 'public' | 'org';

/** RetrievalResult extended with corpus type for Phase 8E (REQ-DOC-069). */
export interface MergedRetrievalResult extends RetrievalResult {
  corpusType: CorpusType;
}

/** Maximum number of results to return after merging and reranking. */
const TOP_K = 8;

/** Corpus names that are org-internal (Phase 8E). Public corpora are everything else. */
const ORG_CORPUS_PREFIX = 'org_';

/** Registry mapping corpus names to their IRetriever factory functions. */
const RETRIEVER_REGISTRY: Record<string, () => IRetriever> = {
  fda: () => new FdaRetriever(),
  'eu-mdr': () => new EuMdrRetriever(),
  mfds: () => new MfdsRetriever(),
  nmpa: () => new NmpaRetriever(),
  pmda: () => new PmdaRetriever(),
  'internal-sops': () => new InternalSopsRetriever(),
};

/**
 * Rerank results using Cohere Rerank API if COHERE_API_KEY is available.
 * Falls back to sorting by score when the key is absent (e.g. in tests).
 */
async function rerankOrSort(query: string, results: RetrievalResult[]): Promise<RetrievalResult[]> {
  if (!process.env.COHERE_API_KEY || results.length === 0) {
    // Fallback: sort by combined score descending.
    return [...results].sort((a, b) => b.score - a.score).slice(0, TOP_K);
  }

  // Cohere Rerank v3 integration.
  try {
    const response = await fetch('https://api.cohere.com/v2/rerank', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'rerank-v3.5',
        query,
        documents: results.map((r) => r.content),
        top_n: TOP_K,
      }),
    });

    if (!response.ok) {
      // Graceful degradation on Cohere API errors.
      logger.warn('[merge] Cohere rerank failed, falling back to score sort');
      return [...results].sort((a, b) => b.score - a.score).slice(0, TOP_K);
    }

    const data = (await response.json()) as {
      results: Array<{ index: number; relevance_score: number }>;
    };

    return data.results
      .filter((r) => results[r.index] !== undefined)
      .map((r) => ({
        ...(results[r.index] as RetrievalResult),
        score: r.relevance_score,
      }));
  } catch {
    logger.warn('[merge] Cohere rerank error, falling back to score sort');
    return [...results].sort((a, b) => b.score - a.score).slice(0, TOP_K);
  }
}

/**
 * Retrieve chunks from multiple corpora in parallel, flatten results, then
 * return top-8 after Cohere Rerank (or score-sort fallback).
 *
 * @param query - The (possibly rewritten) user query.
 * @param corpora - List of corpus names to search (from classifyAndRoute).
 * @param opts - Options forwarded to each retriever (limit, projectId, orgId).
 * @returns Up to 8 RetrievalResult items ranked by relevance.
 */
export async function parallelRetrieveAndMerge(
  query: string,
  corpora: string[],
  opts: RetrieverOptions,
): Promise<RetrievalResult[]> {
  if (corpora.length === 0) return [];

  // Instantiate only the retrievers that correspond to known corpora.
  const retrievers = corpora
    .map((name) => RETRIEVER_REGISTRY[name]?.())
    .filter((r): r is IRetriever => r !== undefined);

  if (retrievers.length === 0) return [];

  // Fire all retrievers in parallel.
  const resultSets = await Promise.all(retrievers.map((r) => r.retrieve(query, opts)));

  // Flatten all results into a single list with corpus type annotation.
  const flat: MergedRetrievalResult[] = resultSets.flatMap((results, idx) => {
    const corpusName = corpora[idx] ?? '';
    const corpusType: CorpusType = corpusName.startsWith(ORG_CORPUS_PREFIX) ? 'org' : 'public';
    return results.map((r) => ({ ...r, corpusType }));
  });

  // Rerank or sort, then cap at TOP_K.
  const sorted = await rerankOrSort(query, flat);

  // SPEC-REGULA-RLHF-001 (REQ-RLHF-010, AC-05): apply feedback-driven re-ranking
  // AFTER the semantic Cohere step. This is the SINGLE wiring point — the
  // integration test (tests/integration/rlhf-reranking-flow.test.ts) asserts
  // retrieval output changes when feedback_score changes.
  //
  // `id` on each RetrievalResult is the source_sections.id, so it maps directly
  // to the feedback_score lookup. We apply RLHF re-ranking to derive the ORDER,
  // then re-order the full Cohere-sorted list (preserving corpusType + content).
  // Best-effort: if RLHF re-ranking fails, fall back to Cohere ordering.
  let ordered = sorted;
  try {
    const rlhfResult = await applyRlhfReranking(
      sorted.map((r) => ({ id: r.id, sourceSectionId: r.id, score: r.score })),
      {
        orgId: opts.orgId ?? 'unknown',
        // M-3: thread the real actor through so the audit row attributes to a
        // user, not null. merge.ts now accepts actorId on RetrieverOptions.
        actorId: opts.actorId ?? null,
        // H-1 fix: the post-rerank invariant gate moved OUT of merge.ts (where
        // it ran with placeholder confidence=1.0 / citationCount=chunk count /
        // expertReview=false and could NEVER fail). The authoritative gate now
        // fires in lib/ai/consult.ts after the answer is composed, where the
        // real confidence, real citation count, and real expert-review flag
        // are known. See consult.ts `verifyPostRerankInvariants` call.
        // The retrieval-hook still accepts a postRerank field for API
        // stability; we pass neutral values that always pass so the dead-code
        // path here is a no-op, and the REAL gate runs downstream.
        postRerank: {
          confidenceScore: 1.0,
          citationCount: sorted.length,
          expertReviewRequired: true,
        },
      },
    );
    // Reorder the full `sorted` list by the RLHF-derived id order.
    const orderById = new Map(rlhfResult.results.map((r, i) => [r.id, i] as const));
    ordered = [...sorted].sort((a, b) => {
      const ai = orderById.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bi = orderById.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  } catch (err) {
    logger.warn('[merge] RLHF re-ranking failed, falling back to Cohere ordering', {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // Preserve corpusType after reranking
  return ordered.map((r) => ({
    ...r,
    corpusType: (r as MergedRetrievalResult).corpusType ?? 'public',
  })) as MergedRetrievalResult[];
}
