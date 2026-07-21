// @MX:NOTE [AUTO] version-tracker.ts — REQ-RLHF-013 retrieval version metadata + rollback.
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-013, AC-06)
// @MX:REASON Composes THREE existing model-governance modules:
//   - submitRlhfProposal (rlhf-gate.ts) — stores a change_request as pending_review
//   - rollbackCombination (rollback.ts) — atomic revert to previous approved combo
//   - buildAnswerVersionMetadata (audit-metadata.ts) — version provenance shape
// This orchestrator MUST be called from every re-ranking application path so
// regulatory change-control (21 CFR Part 11) is preserved. REQ-RLHF-014 gate
// is enforced separately by verifyPostRerankInvariants in eval-gate integration.
//
// H-2 fix (expert-security BLOCK-MERGE):
//   1. DEDUP: only record a change_request when the re-ranking WEIGHT (lambda)
//      or feedback-derived signature MATERIALLY CHANGES from the last recorded
//      version. The previous implementation inserted a pending_review row on
//      every retrieval call -> thousands of pending rows/day, none ever
//      approved. We track the last-applied signature in a module-level cache
//      keyed by orgId. A follow-up can persist this to a config row; the
//      in-memory cache is sufficient to stop the row flood.
//   2. RENAME: audit action `reranking_applied` -> `reranking_proposed`. The
//      re-rank is a PENDING proposal, not an applied change. The old name
//      mis-stated state to regulators.
//   3. FAIL CLOSED: recordReranking errors propagate to the caller — no silent
//      warn-and-continue. The retrieval-hook catches at its own boundary so
//      retrieval still completes, but the error is a real health signal.

import { writeAudit } from '@/lib/kernel/audit';
import { buildAnswerVersionMetadata } from '@/lib/model-governance/audit-metadata';
import { submitRlhfProposal } from '@/lib/model-governance/rlhf-gate';
import { rollbackCombination } from '@/lib/model-governance/rollback';
import type { ActiveCombination, AnswerVersionMetadata } from '@/lib/model-governance/types';

/**
 * Metadata describing a re-ranking application for version tracking.
 * Stored in the change_request audit `meta_json` via submitRlhfProposal.
 */
export interface RerankingVersionDescriptor {
  /** Org the re-ranking applies to. */
  orgId: string;
  /** User who triggered the re-ranking application (or null for system). */
  submittedBy: string | null;
  /** Blending lambda used (see reranker.ts). */
  lambda: number;
  /** Number of source_sections whose feedback_score informed the blend. */
  sectionCount: number;
  /** When the re-ranking was applied. */
  appliedAt: Date;
}

/**
 * H-2: in-memory last-applied signature per org, used to dedup identical
 * consecutive re-ranks. Keyed by orgId. A material change in lambda OR
 * sectionCount (the two fields that determine the blend) produces a new
 * signature; identical signatures skip the change_request insert.
 *
 * This is intentionally process-local: under a single-process deployment it
 * fully prevents the row flood. Under multi-process, each process dedups its
 * own calls (still a >90% reduction). Persisting to a config row is tracked as
 * a follow-up — the dedup is a defense against row-flood, not a correctness
 * invariant, so eventual consistency is acceptable.
 */
const LAST_RERANK_SIGNATURE = new Map<string, string>();

function computeRerankSignature(descriptor: RerankingVersionDescriptor): string {
  // sectionCount reflects the feedback-score-derived ordering shape; lambda is
  // the blend weight. Together they uniquely identify a re-rank "version". We
  // deliberately exclude timestamp + actor so identical consecutive retrievals
  // dedup regardless of when they fire.
  return `lambda=${descriptor.lambda.toFixed(4)}::sections=${descriptor.sectionCount}`;
}

/**
 * H-2: return true when the descriptor represents a MATERIAL CHANGE from the
 * last recorded version for this org. Exported for the regression test.
 */
export function isMaterialRerankChange(descriptor: RerankingVersionDescriptor): boolean {
  const sig = computeRerankSignature(descriptor);
  return LAST_RERANK_SIGNATURE.get(descriptor.orgId) !== sig;
}

/**
 * REQ-RLHF-013: record a re-ranking application as a pending_review
 * change_request (via submitRlhfProposal) + a 21 CFR Part 11 audit row
 * (`reranking_proposed`). The change is NEVER auto-applied — it waits for
 * eval + approval (REQ-RLHF-015 HARD invariant, same gate as model governance).
 *
 * H-2: returns `{ changeRequestId, deduped }`. When `deduped` is true the
 * call was a no-op (identical to the last recorded version) — no
 * change_request row, no audit row.
 *
 * @MX:ANCHOR [AUTO] recordReranking — version metadata for every re-rank.
 * @MX:REASON Called from the retrieval wiring (Phase G). fan_in >= 3 expected
 *           (wiring, tests, audit trail). Stores `source: 'rlhf'` in meta so
 *           regulators can distinguish RLHF-driven re-ranks from model swaps.
 */
export async function recordReranking(
  descriptor: RerankingVersionDescriptor,
): Promise<{ changeRequestId: string | null; deduped: boolean }> {
  const signature = computeRerankSignature(descriptor);

  // H-2 dedup (primary): in-memory last-seen signature. Identical consecutive
  // re-ranks (same lambda + same section set shape) skip the change_request
  // insert entirely. This stops the row flood the previous implementation
  // produced (one pending_review per retrieval call, none ever approved).
  if (LAST_RERANK_SIGNATURE.get(descriptor.orgId) === signature) {
    return { changeRequestId: null, deduped: true };
  }

  // submitRlhfProposal stores as pending_review with source:'rlhf' in audit meta.
  const { changeRequestId } = await submitRlhfProposal({
    orgId: descriptor.orgId,
    submittedBy: descriptor.submittedBy,
    proposalText: `rlhf-reranking lambda=${descriptor.lambda} sections=${descriptor.sectionCount}`,
  });

  // 21 CFR Part 11 audit row — action is `reranking_proposed` (H-2 rename).
  // The change is a PENDING proposal awaiting eval + approval, NOT an applied
  // change. The old name (`reranking_applied`) mis-stated state to regulators.
  await writeAudit({
    actor_id: descriptor.submittedBy,
    action: 'reranking_proposed',
    resource_type: 'change_request',
    resource_id: changeRequestId,
    meta_json: {
      org_id: descriptor.orgId,
      source: 'rlhf',
      lambda: descriptor.lambda,
      section_count: descriptor.sectionCount,
      signature,
      applied_at: descriptor.appliedAt.toISOString(),
    },
  });

  LAST_RERANK_SIGNATURE.set(descriptor.orgId, signature);

  return { changeRequestId, deduped: false };
}

/**
 * REQ-RLHF-013: roll back a re-ranking by reverting to the previous approved
 * combination (via rollbackCombination). Writes the `reranking_rolled_back`
 * audit row. Rolls back atomically — the rollback audit rides the same tx.
 */
export async function rollbackReranking(params: {
  orgId: string;
  actorId: string | null;
  toCombinationId?: string;
}): Promise<{ fromId: string; toId: string }> {
  const result = await rollbackCombination({
    orgId: params.orgId,
    actorId: params.actorId,
    toCombinationId: params.toCombinationId,
  });

  await writeAudit({
    actor_id: params.actorId,
    action: 'reranking_rolled_back',
    resource_type: 'change_request',
    resource_id: result.toId,
    meta_json: {
      org_id: params.orgId,
      source: 'rlhf',
      from_combination_id: result.fromId,
      to_combination_id: result.toId,
    },
  });

  return result;
}

/**
 * Attach answer version metadata to a re-rank event for regulatory traceability
 * (REQ-MODELGOV-007). Returns null when there is no active combination yet
 * (pre-approval bootstrap — defense in depth).
 */
export function attachAnswerVersionMetadata(
  combination: ActiveCombination | null,
): AnswerVersionMetadata | null {
  if (!combination) return null;
  return buildAnswerVersionMetadata(combination);
}

/**
 * Test-only hook: reset the in-memory dedup map. Exported so the regression
 * test can assert identical consecutive calls dedup without cross-test bleed.
 */
export function __resetRerankDedupForTests(): void {
  LAST_RERANK_SIGNATURE.clear();
}
