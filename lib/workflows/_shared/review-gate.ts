// @MX:ANCHOR [AUTO] Review gate — block export unless expert review approved.
// @MX:REASON fan_in >= 3: M4 export routes (3 workflow types) call
//          assertExportAllowed; the runner calls markExpertFlagged on
//          coverage/review failures; tests assert the gate logic.
//          REQ-WFLLM-007 (export block) + REQ-WFLLM-008 (expert_flagged audit).
// @MX:SPEC SPEC-REGULA-WORKFLOWS-LLM-002 (REQ-WFLLM-007/008, AC-06)

/**
 * Export gate outcome. `allowed` = proceed; `blocked` = 403 + audit.
 *
 * The gate checks `workflow_runs.status` (the lifecycle enum) rather than a
 * separate review_status column — the existing `workflow_status` pgEnum
 * already encodes `pending_review` / `approved` / `rejected`, and
 * `review_required` boolean gates whether the review is needed at all.
 */
export interface ReviewGateResult {
  allowed: boolean;
  runId: string;
  status: string;
  reviewRequired: boolean;
  reason?: string;
}

/**
 * Decide whether a workflow run may be exported.
 *
 * REQ-WFLLM-007: IF expert review not completed THEN export blocked.
 * - status === 'approved' → allowed (review passed)
 * - status in pending_review/rejected OR reviewRequired && not yet approved → blocked
 * - reviewRequired === false → allowed (gate not applicable for this run)
 *
 * The route handler (M4) is responsible for emitting the 403 response and the
 * `workflow.export_blocked` / `workflow.expert_flagged` audit row using the
 * reason string from this result. This module is pure logic — no DB writes —
 * so it composes cleanly with the caller's transaction boundary (21 CFR
 * Part 11 §11.10(e) atomicity).
 */
export function assertExportAllowed(params: {
  runId: string;
  status: string;
  reviewRequired: boolean;
}): ReviewGateResult {
  const { runId, status, reviewRequired } = params;

  // Gate not applicable — run does not require expert review (e.g. an
  // internal-only workflow). Export proceeds.
  if (!reviewRequired) {
    return { allowed: true, runId, status, reviewRequired };
  }

  if (status === 'approved') {
    return { allowed: true, runId, status, reviewRequired };
  }

  // All other states (queued, running, paused, pending_review, rejected,
  // failed) block export when review is required.
  const reason =
    status === 'pending_review'
      ? 'Expert review pending — export blocked until approved'
      : status === 'rejected'
        ? 'Expert review rejected — export blocked'
        : `Run status "${status}" is not approved — export blocked`;

  return {
    allowed: false,
    runId,
    status,
    reviewRequired,
    reason,
  };
}

/**
 * True when the run is in a state that should fire `workflow.expert_flagged`
 * (coverage low, confidence low, or review-required gate tripped). The runner
 * calls this after each step to decide whether to flag the run for expert
 * review in the audit trail (REQ-WFLLM-008).
 */
export function shouldFlagForExpertReview(params: {
  citationCoveragePasses: boolean;
  reviewRequired: boolean;
}): boolean {
  if (!params.citationCoveragePasses) return true;
  return params.reviewRequired;
}
