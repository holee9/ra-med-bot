// @MX:NOTE [AUTO] post-rerank-gate.ts — REQ-RLHF-014 invariant verification.
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-014, AC-07)
// @MX:REASON After every re-ranking application, this gate re-checks that the
//           confidence, citation, and expert-review conditions still hold.
//           Reuses checkEvalThreshold / evalGatePassed from model-governance
//           so the gate semantics are identical to the model-change release gate.
//
// Tier-1 dead-code defense: this function MUST be called from EVERY retrieval
// path that applies re-ranking (happy / cached / streaming / fallback). The
// integration test in Phase G asserts the gate fires on each entrypoint.

import { type DEFAULT_EVAL_THRESHOLD, checkEvalThreshold } from '@/lib/model-governance/eval-gate';

/** Shape of a post-rerank invariant check input. */
export interface PostRerankInvariantsInput {
  /** Re-ranked answer confidence score in [0, 1]. */
  confidenceScore: number;
  /** Confidence floor below which the answer is unsafe (default 0.7). */
  confidenceFloor?: number;
  /** Number of citations attached to the re-ranked answer. */
  citationCount: number;
  /** Minimum citations required (default 1). */
  minCitations?: number;
  /**
   * Whether an expert-review flag is present. When true, the answer is already
   * gated for human review and the invariant is satisfied (review is the safety
   * net). When false, confidence + citation must meet floors.
   */
  expertReviewRequired: boolean;
}

/** Result of an invariant check. */
export interface PostRerankInvariantResult {
  passed: boolean;
  violations: string[];
  /** Echo of the thresholds used, for audit/observability. */
  thresholds: {
    confidenceFloor: number;
    minCitations: number;
  };
}

export const DEFAULT_CONFIDENCE_FLOOR = 0.7;
export const DEFAULT_MIN_CITATIONS = 1;

/**
 * REQ-RLHF-014 / AC-07: verify that after a re-ranking application the
 * confidence, citation, and expert-review invariants still hold.
 *
 * The check passes when EITHER:
 *   (a) expertReviewRequired is true (human review is the safety net), OR
 *   (b) confidenceScore >= confidenceFloor AND citationCount >= minCitations.
 *
 * The eval-gate reuse: when callers supply an eval result JSON (e.g. from a
 * post-rerank promptfoo run), we ALSO enforce the eval threshold so a re-rank
 * that tanks the eval pass-rate is rejected even if confidence/citation look
 * fine. Callers without an eval result omit `evalResultJson`.
 *
 * @MX:ANCHOR [AUTO] verifyPostRerankInvariants — re-rank safety gate.
 * @MX:REASON fan_in >= 3 (happy path, cached path, streaming path, fallback).
 *           Tier-1 dead-code risk — integration tests must assert it fires on
 *           every retrieval entrypoint (Phase G1).
 */
export function verifyPostRerankInvariants(
  input: PostRerankInvariantsInput,
  opts: { evalResultJson?: unknown; evalThreshold?: number } = {},
): PostRerankInvariantResult {
  const confidenceFloor = input.confidenceFloor ?? DEFAULT_CONFIDENCE_FLOOR;
  const minCitations = input.minCitations ?? DEFAULT_MIN_CITATIONS;
  const violations: string[] = [];

  // Expert review is an accepted safety net — if present, the answer is
  // already routed to humans, so the numeric invariants are advisory only.
  if (!input.expertReviewRequired) {
    if (input.confidenceScore < confidenceFloor) {
      violations.push(`confidence ${input.confidenceScore.toFixed(2)} < floor ${confidenceFloor}`);
    }
    if (input.citationCount < minCitations) {
      violations.push(`citations ${input.citationCount} < min ${minCitations}`);
    }
  }

  // Optional eval-gate reuse: enforce threshold when an eval result is supplied.
  if (opts.evalResultJson !== undefined) {
    const evalResult = checkEvalThreshold(opts.evalResultJson, {
      threshold: opts.evalThreshold,
    });
    if (!evalResult.passed) {
      violations.push(`eval_gate_failed: ${evalResult.reason}`);
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    thresholds: { confidenceFloor, minCitations },
  };
}
