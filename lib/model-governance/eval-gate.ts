// @MX:NOTE [AUTO] eval-gate.ts — promptfoo eval threshold gate (REQ-MODELGOV-005/010/011).
// @MX:ANCHOR [AUTO] checkEvalThreshold — release gate for prompt/model changes.
// @MX:REASON REQ-MODELGOV-010/011 — promptfoo regression threshold must block approval
//           when the pass rate drops. The eval run itself stays in CI (eval:ci); this
//           function parses the result JSON and enforces the threshold. fan_in >= 3
//           (change-workflow, approve route, CI gate script).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-005/010/011, AC-02/04)

import type { EvalGateResult } from './types';

/**
 * Default pass-rate threshold (fraction in [0,1]). Mirrors the promptfoo config
 * "Pass threshold: >= 80% of scenarios must pass" (SPEC-REGULA-LAUNCH-001,
 * REQ-LAUNCH-002). Kept here so the gate is enforceable without reading the YAML.
 */
export const DEFAULT_EVAL_THRESHOLD = 0.8;

/**
 * Promptfoo result JSON shape (subset). promptfoo eval --output writes:
 *   { results: [{ success: boolean, ... }], ... }
 * The overall pass/fail is derived from the fraction of successful test cases.
 */
interface PromptfooResult {
  results?: Array<{ success?: boolean }>;
}

/**
 * REQ-MODELGOV-010/011: parse a promptfoo result payload and enforce the threshold.
 *
 * - `score` = fraction of test cases with success === true.
 * - `passed` = score >= threshold.
 *
 * Returns a structured result so callers (change-workflow, approve route) can
 * record the threshold + score in the audit row without re-parsing.
 */
export function checkEvalThreshold(
  resultJson: unknown,
  opts: { threshold?: number; evalRunId?: string | null; evalResultRef?: string | null } = {},
): EvalGateResult {
  const threshold = opts.threshold ?? DEFAULT_EVAL_THRESHOLD;
  const payload = (resultJson ?? {}) as PromptfooResult;
  const cases = payload.results ?? [];

  if (cases.length === 0) {
    return {
      passed: false,
      threshold,
      score: 0,
      evalRunId: opts.evalRunId ?? null,
      evalResultRef: opts.evalResultRef ?? null,
      reason: 'no_eval_cases',
    };
  }

  const passed = cases.filter((c) => c.success === true).length;
  const score = passed / cases.length;
  const isPassed = score >= threshold;

  return {
    passed: isPassed,
    threshold,
    score,
    evalRunId: opts.evalRunId ?? null,
    evalResultRef: opts.evalResultRef ?? null,
    reason: isPassed ? 'ok' : `score ${score.toFixed(2)} < threshold ${threshold}`,
  };
}

/**
 * REQ-MODELGOV-005: helper for the common case — eval passed?
 * Used by change-workflow to gate approval on eval_status='passed'.
 */
export function evalGatePassed(resultJson: unknown, threshold?: number): boolean {
  return checkEvalThreshold(resultJson, { threshold }).passed;
}
