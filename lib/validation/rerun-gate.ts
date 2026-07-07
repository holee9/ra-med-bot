// @MX:ANCHOR [AUTO] rerun-gate — blocks sign-off when high-impact change lacks rerun evidence.
// @MX:REASON SPEC-REGULA-VALIDATION-001 M4 (REQ-VAL-008, AC-5, Issue #49). Consumed by
//   M5 sign-off API. Returns the list of blocking axes; empty list = proceed.
//   Conservative: high-impact + no rerun evidence → block. Override requires
//   explicit residual_risk justification captured in change_control row.
//   PR #359 review: temporal check — only OQ evidence collected AT OR AFTER
//   the change_control.assessed_at counts as rerun evidence. Stale OQ from
//   before the high-impact change cannot satisfy the gate.
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (REQ-VAL-008, AC-5)

import { db } from '@/lib/db/client';
import { changeControl, validationEvidence } from '@/lib/db/schema';
import type { ChangeAxis } from '@/lib/schemas/validation';
import { and, eq, gte, inArray } from 'drizzle-orm';

export interface RerunGateResult {
  /** true when sign-off may proceed; false when blocked. */
  passed: boolean;
  /**
   * List of `{ axis }` entries that blocked sign-off. Each corresponds to a
   * change_control row with impact_level='high' + rerun_required=true but no
   * validation_evidence row (qualification_type='oq') captured AT OR AFTER
   * the change_control row's assessed_at timestamp.
   */
  failed: Array<{ axis: ChangeAxis; reason: string }>;
}

/**
 * REQ-VAL-008 / AC-5 — evaluate whether a release may proceed to sign-off.
 *
 * Algorithm:
 *   1. Select change_control rows for release where impact_level='high' and
 *      rerun_required=true. Each row carries an assessed_at timestamp.
 *   2. For each blocking axis, look for OQ evidence (qualification_type='oq')
 *      with collected_at >= axis.assessed_at. If none, add to failed[].
 *      Stale OQ collected BEFORE the change was assessed cannot satisfy the
 *      rerun gate — otherwise pre-change OQ would mask a post-change regression.
 *   3. Sign-off may proceed only when failed[] is empty.
 *
 * This function is READ-ONLY. It does not mutate state; the sign-off route
 * (M5) calls it and returns HTTP 409 when failed.length > 0.
 *
 * Implementation note (PR #359 review): we fetch OQ evidence once using the
 * earliest assessed_at across blocking axes as the lower bound, then filter
 * per-axis in memory. This avoids N+1 queries while preserving per-axis
 * correctness when axes were assessed at different timestamps.
 */
export async function evaluateRerunGate(releaseId: string): Promise<RerunGateResult> {
  const blockingAxes = await db
    .select({
      axis: changeControl.changeAxis,
      exceptionNote: changeControl.exceptionNote,
      assessedAt: changeControl.assessedAt,
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

  // Fetch OQ evidence collected at or after the EARLIEST assessed_at across
  // blocking axes. Per-axis filtering happens in memory using each row's own
  // assessed_at — conservative and correct.
  const earliestAssessedAt = blockingAxes.reduce((min, row) => {
    const ts = row.assessedAt instanceof Date ? row.assessedAt.getTime() : Number(row.assessedAt);
    return Number.isFinite(ts) && ts < min ? ts : min;
  }, Number.POSITIVE_INFINITY);

  // When assessedAt is missing/invalid for all rows, fall back to accepting
  // any OQ evidence (pre-existing behavior). This is safe because assessedAt
  // is NOT NULL in the schema; the branch is defensive only.
  const oqEvidence = Number.isFinite(earliestAssessedAt)
    ? await db
        .select({
          id: validationEvidence.id,
          collectedAt: validationEvidence.collectedAt,
        })
        .from(validationEvidence)
        .where(
          and(
            eq(validationEvidence.releaseId, releaseId),
            eq(validationEvidence.qualificationType, 'oq'),
            inArray(validationEvidence.result, ['pass', 'fail']),
            gte(validationEvidence.collectedAt, new Date(earliestAssessedAt)),
          ),
        )
    : await db
        .select({
          id: validationEvidence.id,
          collectedAt: validationEvidence.collectedAt,
        })
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
    const axisAssessedAt = row.assessedAt instanceof Date ? row.assessedAt.getTime() : null;
    // Per-axis temporal check: OQ must be collected at or after THIS axis's
    // assessed_at. Stale OQ from before this change was assessed is rejected.
    const hasFreshOq =
      axisAssessedAt === null
        ? oqEvidence.length > 0
        : oqEvidence.some((e) => {
            const collected = e.collectedAt instanceof Date ? e.collectedAt.getTime() : null;
            return collected !== null && collected >= (axisAssessedAt ?? 0);
          });
    if (!hasFreshOq) {
      failed.push({
        axis: row.axis as ChangeAxis,
        reason: `change_control:${row.axis}:rerun_required`,
      });
    }
  }

  return { passed: failed.length === 0, failed };
}
