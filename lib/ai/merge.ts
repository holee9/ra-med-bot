// @MX:ANCHOR [AUTO] RAG Merge — parallel retrieval + top-8 result selection.
// @MX:REASON Called by the consult pipeline after classifyAndRoute. fan_in >= 3:
// consult.ts, tests, future batch analysis jobs.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-039, REQ-BREADTH-042)

import { EuMdrRetriever } from './retrievers/eu-mdr';
import { FdaRetriever } from './retrievers/fda';
import { InternalSopsRetriever } from './retrievers/internal-sops';
import { MfdsRetriever } from './retrievers/mfds';
import { NmpaRetriever } from './retrievers/nmpa';
import { PmdaRetriever } from './retrievers/pmda';
import type { IRetriever, RetrievalResult, RetrieverOptions } from './retrievers/types';

/** Maximum number of results to return after merging and reranking. */
const TOP_K = 8;

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
async function rerankOrSort(
  query: string,
  results: RetrievalResult[],
): Promise<RetrievalResult[]> {
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
      console.warn('[merge] Cohere rerank failed, falling back to score sort');
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
    console.warn('[merge] Cohere rerank error, falling back to score sort');
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

  // Flatten all results into a single list.
  const flat = resultSets.flat();

  // Rerank or sort, then cap at TOP_K.
  return rerankOrSort(query, flat);
}
