// @MX:NOTE [AUTO] Trend detection DB layer — repeat complaint signature → PMS link (REQ-007).
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-007, AC-06)
//
// REQ-007: when repeat complaints are detected (same device + outcome within an
// org), the system links the trend to #53 PMS via pms_inputs. The pure signature
// computation lives in trend-signature.ts (no DB dependency, unit-testable).
// This module owns the DB-backed counting + pms_inputs insertion.

import { db } from '@/lib/db/client';
import { complaints, pmsInputs } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import type { ComplaintIntake } from './types';
// Re-export the pure functions so route callers can import from one module.
export { computeTrendSignature, TREND_THRESHOLD } from './trend-signature';
import { TREND_THRESHOLD, computeTrendSignature } from './trend-signature';

/**
 * Count how many complaints share this trend signature within an org.
 */
export async function countComplaintsByTrendSignature(
  orgId: string,
  trendSignature: string,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(complaints)
    .where(and(eq(complaints.orgId, orgId), eq(complaints.trendSignature, trendSignature)));
  return row?.count ?? 0;
}

/**
 * REQ-007: detect a trend and, when the threshold is met, create a pms_inputs
 * row so the #53 PMS pipeline picks it up. Returns the created pms_inputs.id or
 * null when no trend is detected yet.
 *
 * REQ-007 reuse contract: pms_inputs (#53 PMS) is the single ingestion point
 * for post-market signals. We only insert; the PMS report builder owns
 * analysis.
 */
export async function detectAndLinkTrend(params: {
  orgId: string;
  projectId: string;
  complaintId: string;
  intake: ComplaintIntake;
}): Promise<{ trendSignature: string; trendCount: number; pmsInputId: string | null }> {
  const trendSignature = computeTrendSignature(params.intake);
  const trendCount = await countComplaintsByTrendSignature(params.orgId, trendSignature);

  let pmsInputId: string | null = null;

  if (trendCount >= TREND_THRESHOLD) {
    const [row] = await db
      .insert(pmsInputs)
      .values({
        orgId: params.orgId,
        projectId: params.projectId,
        source: 'complaint_trend',
        severity: params.intake.patientOutcome === 'death' ? 'critical' : 'moderate',
        trendCategory: trendSignature,
        payload: {
          complaintId: params.complaintId,
          trendSignature,
          trendCount,
          deviceName: params.intake.deviceName,
          patientOutcome: params.intake.patientOutcome,
        },
      })
      .returning({ id: pmsInputs.id });
    if (row?.id) pmsInputId = row.id;
  }

  return { trendSignature, trendCount, pmsInputId };
}
