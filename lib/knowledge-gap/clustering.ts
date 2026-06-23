// @MX:ANCHOR [AUTO] Knowledge gap clustering — pgvector cosine similarity grouping.
// @MX:REASON Public API boundary called by detector post-capture and by delta-sync
//          gap-replay matching. fan_in will reach 3+ (capture flow, replay flow, queue API).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-KNOWLEDGE-GAP-005, AC-03, Issue #35)
//
// Design reference: design.md §3 (loop flow) and §7.3 (Clustering Algorithm).
//   - Embedding model: text-embedding-3-small (1536-d), same as lib/ingest/embed.ts.
//   - Similarity: cosine similarity = 1 - (<=> cosine distance). pgvector operator `<=>`.
//   - Threshold: >= 0.85 cosine similarity (design.md §7.3).
//   - cluster_id: SHA-256 short hash of the canonical (first) gap's redaction_hash,
//     so the cluster identity is stable and PII-free.
//
// All questions handled here are ALREADY redacted (detector redacts before insert).
// Embeddings are generated from redacted text only — no PII reaches the embedding API.

import { createHash } from 'node:crypto';
import { db } from '@/lib/db/client';
import { unansweredQueue } from '@/lib/db/schema';
import { embedChunks } from '@/lib/ingest/embed';
import { and, eq } from 'drizzle-orm';

/**
 * Cosine similarity threshold for grouping two gaps into the same cluster.
 * design.md §7.3: similarity >= 0.85 → same cluster.
 */
export const CLUSTER_SIMILARITY_THRESHOLD = 0.85;

/** A minimal view of an unanswered_queue row used by the clustering helpers. */
export interface QueueGapRow {
  id: string;
  redactedQuestion: string;
  redactionHash: string;
  clusterId: string | null;
}

/** Result of finding (or creating) a cluster for a newly-captured gap. */
export interface ClusterAssignment {
  /** Existing cluster id if a similar open gap was found, otherwise null (new cluster needed). */
  existingClusterId: string | null;
  /** A fresh cluster id to assign when no existing cluster matches. */
  newClusterId: string;
  /** Whether a similar gap was found above the similarity threshold. */
  matched: boolean;
}

/**
 * Compute a deterministic, PII-free cluster id from a redaction hash.
 * The cluster id is the first 16 hex chars of SHA-256(cluster_seed), making it
 * stable across replays and safe to expose in GitHub Issue bodies.
 */
export function computeClusterId(redactionHash: string): string {
  return createHash('sha256').update(`cluster:${redactionHash}`).digest('hex').slice(0, 16);
}

/**
 * Find an existing open cluster for the given (redacted) question via pgvector
 * cosine similarity against every other open gap's question embedding.
 *
 * Because unanswered_queue does NOT store a per-row embedding (design.md §1.1 has
 * no embedding column), we compute the candidate embedding on the fly and compare
 * against the embeddings of currently-open gaps (also computed on the fly, in a
 * single batched call). This keeps the queue table lean and reuses embedChunks.
 *
 * Returns the clusterId of the most-similar open gap whose similarity >= threshold,
 * or null if none qualify. Throws if embedding generation fails — callers MUST
 * fail-closed so that a gap is never silently dropped.
 */
export async function findSimilarOpenCluster(
  orgId: string,
  redactedQuestion: string,
  excludeGapId?: string,
): Promise<string | null> {
  const openGaps = await db
    .select({
      id: unansweredQueue.id,
      redactedQuestion: unansweredQueue.redactedQuestion,
      redactionHash: unansweredQueue.redactionHash,
      clusterId: unansweredQueue.clusterId,
    })
    .from(unansweredQueue)
    .where(and(eq(unansweredQueue.orgId, orgId), eq(unansweredQueue.status, 'open')));

  const candidateGaps =
    excludeGapId === undefined ? openGaps : openGaps.filter((gap) => gap.id !== excludeGapId);

  if (candidateGaps.length === 0) return null;

  // Batch-embed candidate + all open gap questions together (single API call).
  const texts = [redactedQuestion, ...candidateGaps.map((g) => g.redactedQuestion)];
  const embeddings = await embedChunks(texts);
  const candidateEmb = embeddings[0];
  if (!candidateEmb) return null;

  let bestSim = -1;
  let bestClusterId: string | null = null;

  for (let i = 0; i < candidateGaps.length; i++) {
    const emb = embeddings[i + 1];
    const gap = candidateGaps[i];
    if (!emb || !gap) continue;
    const sim = cosineSimilarity(candidateEmb, emb);
    if (sim > bestSim) {
      bestSim = sim;
      // Prefer a gap that already has a cluster id; fall back to a deterministic one.
      bestClusterId = gap.clusterId ?? computeClusterId(gap.redactionHash);
    }
  }

  return bestSim >= CLUSTER_SIMILARITY_THRESHOLD ? bestClusterId : null;
}

/**
 * Assign a cluster to a newly-captured gap. If a similar open gap exists, reuse
 * its cluster id (REQ-KNOWLEDGE-GAP-005); otherwise compute a new one.
 *
 * The caller is responsible for then deciding whether to create a new GitHub
 * issue (new cluster) or append to an existing one (existing cluster) — see
 * lib/knowledge-gap/github-issue.ts.
 */
export async function assignCluster(
  orgId: string,
  gapId: string,
  redactedQuestion: string,
  redactionHash: string,
): Promise<ClusterAssignment> {
  const newClusterId = computeClusterId(redactionHash);
  const existingClusterId = await findSimilarOpenCluster(orgId, redactedQuestion, gapId);

  const clusterId = existingClusterId ?? newClusterId;
  await db.update(unansweredQueue).set({ clusterId }).where(eq(unansweredQueue.id, gapId));

  return {
    existingClusterId,
    newClusterId,
    matched: existingClusterId !== null,
  };
}

/**
 * Cosine similarity between two equal-length vectors: (a·b)/(|a|·|b|).
 * Returns -1 for empty/degenerate vectors so they never clear the >= 0.85 bar.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return -1;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i];
    const bv = b[i];
    // noUncheckedIndexedAccess: both could be undefined defensively; bail if so.
    if (av === undefined || bv === undefined) return -1;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? -1 : dot / denom;
}
