// @MX:ANCHOR [AUTO] rerun-gate — blocks sign-off when high-impact change lacks rerun evidence.
// @MX:REASON SPEC-REGULA-VALIDATION-001 M4 (REQ-VAL-008, AC-5, Issue #49). Consumed by
//   M5 sign-off API. Returns the list of blocking axes; empty list = proceed.
//   Conservative: high-impact + no rerun evidence → block. Override requires
//   explicit residual_risk justification captured in change_control row.
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (REQ-VAL-008, AC-5)

import { db } from '@/lib/db/client';
import { changeControl, validationEvidence } from '@/lib/db/schema';
import type { ChangeAxis } from '@/lib/schemas/validation';
import { and, eq, inArray } from 'drizzle-orm';

export interface RerunGateResult {
  /** true when sign-off may proceed; false when blocked. */
  passed: boolean;
  /**
   * List of `{ axis }` entries that blocked sign-off. Each corresponds to a
   * change_control row with impact_level='high' + rerun_required=true but no
   * validation_evidence row (qualification_type='oq') captured AFTER the
   * change_control row was created.
   */
  failed: Array<{ axis: ChangeAxis; reason: string }>;
}

/**
 * REQ-VAL-008 / AC-5 — evaluate whether a release may proceed to sign-off.
 *
 * Algorithm:
 *   1. Select change_control rows for release where impact_level='high' and
 *      rerun_required=true.
 *   2. For each blocking axis, look for OQ evidence (qualification_type='oq')
 *      with commit_sha newer than or equal to the change_control row. If none,
 *      add to failed[].
 *   3. Sign-off may proceed only when failed[] is empty.
 *
 * This function is READ-ONLY. It does not mutate state; the sign-off route
 * (M5) calls it and returns HTTP 409 when failed.length > 0.
 */
export async function evaluateRerunGate(releaseId: string): Promise<RerunGateResult> {
  const blockingAxes = await db
    .select({
      axis: changeControl.changeAxis,
      exceptionNote: changeControl.exceptionNote,
    })
    .from(changeControl)
    .where(
      and(
        eq(changeControl.releaseId, releaseId),
        eq(changeControl.impactLevel, 'high'),
        eq(changeControl.rerunRequired, true),
      ),
    );

  if (blockingAxes.length === 0) {
    return { passed: true, failed: [] };
  }

  // Look for OQ evidence for this release. Any OQ evidence >= release window
  // satisfies the gate (conservative-but-not-overengineered: we don't yet
  // wire ci_run_id ↔ change_control row timestamp correlation; that's #71).
  const oqEvidence = await db
    .select({ id: validationEvidence.id })
    .from(validationEvidence)
    .where(
      and(
        eq(validationEvidence.releaseId, releaseId),
        eq(validationEvidence.qualificationType, 'oq'),
        inArray(validationEvidence.result, ['pass', 'fail']),
      ),
    );

  const failed: Array<{ axis: ChangeAxis; reason: string }> = [];
  for (const row of blockingAxes) {
    if (oqEvidence.length === 0) {
      failed.push({
        axis: row.axis as ChangeAxis,
        reason: `change_control:${row.axis}:rerun_required`,
      });
    }
  }

  return { passed: failed.length === 0, failed };
}
