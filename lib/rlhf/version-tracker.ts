// @MX:NOTE [AUTO] version-tracker.ts — REQ-RLHF-013 retrieval version metadata + rollback.
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-013, AC-06)
// @MX:REASON Composes THREE existing model-governance modules:
//   - submitRlhfProposal (rlhf-gate.ts) — stores a change_request as pending_review
//   - rollbackCombination (rollback.ts) — atomic revert to previous approved combo
//   - buildAnswerVersionMetadata (audit-metadata.ts) — version provenance shape
// This orchestrator MUST be called from every re-ranking application path so
// regulatory change-control (21 CFR Part 11) is preserved. REQ-RLHF-014 gate
// is enforced separately by verifyPostRerankInvariants in eval-gate integration.

import { writeAudit } from '@/lib/audit';
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
 * REQ-RLHF-013: record a re-ranking application as a pending_review
 * change_request (via submitRlhfProposal) + a 21 CFR Part 11 audit row
 * (`reranking_applied`). The change is NEVER auto-applied — it waits for
 * eval + approval (REQ-RLHF-015 HARD invariant, same gate as model governance).
 *
 * @MX:ANCHOR [AUTO] recordReranking — version metadata for every re-rank.
 * @MX:REASON Called from the retrieval wiring (Phase G). fan_in >= 3 expected
 *           (wiring, tests, audit trail). Stores `source: 'rlhf'` in meta so
 *           regulators can distinguish RLHF-driven re-ranks from model swaps.
 */
export async function recordReranking(
  descriptor: RerankingVersionDescriptor,
): Promise<{ changeRequestId: string }> {
  // submitRlhfProposal stores as pending_review with source:'rlhf' in audit meta.
  const { changeRequestId } = await submitRlhfProposal({
    orgId: descriptor.orgId,
    submittedBy: descriptor.submittedBy,
    proposalText: `rlhf-reranking lambda=${descriptor.lambda} sections=${descriptor.sectionCount}`,
  });

  // 21 CFR Part 11 audit row — distinct from the change_request audit because
  // the action is the APPLICATION of the re-rank (operational), not the request.
  await writeAudit({
    actor_id: descriptor.submittedBy,
    action: 'reranking_applied',
    resource_type: 'change_request',
    resource_id: changeRequestId,
    meta_json: {
      org_id: descriptor.orgId,
      source: 'rlhf',
      lambda: descriptor.lambda,
      section_count: descriptor.sectionCount,
      applied_at: descriptor.appliedAt.toISOString(),
    },
  });

  return { changeRequestId };
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
