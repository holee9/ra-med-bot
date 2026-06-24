// @MX:ANCHOR [AUTO] canCloseCapa — REQ-011 server-side close gate.
// @MX:REASON Called by POST /api/ra/capa/records/[id]/close route + integration
//           tests. fan_in >= 3 expected. This is a SAFETY GATE, not a UX hint.
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-011, AC-07)
//
// REQ-011: IF a complaint is reportable AND has no vigilance_ref, THEN the CAPA
// close MUST be blocked. This gate is enforced server-side so a client cannot
// bypass it. Denials are audited as 'capa.close_blocked_vigilance_missing'
// (21 CFR Part 11). Mirrors the labeling export-gate pattern
// (lib/labeling/export-gate.ts).

import { db } from '@/lib/db/client';
import { capaRecords, complaints } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import type { CloseGateResult } from './types';

/**
 * REQ-011: determine whether a CAPA may be closed.
 *
 * Blocking conditions:
 *   - The parent complaint is reportable (reportability_status='reportable')
 *     AND complaints.vigilance_ref IS NULL.
 *
 * IDOR defense: scoped by orgId + capaId. A missing/cross-org CAPA returns
 * allowed=false with reason='capa_not_found_or_org_mismatch' (callers surface
 * 404). This avoids UUID probing.
 */
export async function canCloseCapa(capaId: string, orgId: string): Promise<CloseGateResult> {
  const [capa] = await db
    .select({
      id: capaRecords.id,
      complaintId: capaRecords.complaintId,
      status: capaRecords.status,
    })
    .from(capaRecords)
    .where(and(eq(capaRecords.id, capaId), eq(capaRecords.orgId, orgId)))
    .limit(1);

  if (!capa) {
    return { allowed: false, reason: 'capa_not_found_or_org_mismatch' };
  }

  const [complaint] = await db
    .select({
      reportabilityStatus: complaints.reportabilityStatus,
      vigilanceRef: complaints.vigilanceRef,
    })
    .from(complaints)
    .where(and(eq(complaints.id, capa.complaintId), eq(complaints.orgId, orgId)))
    .limit(1);

  if (!complaint) {
    return { allowed: false, reason: 'parent_complaint_not_found' };
  }

  // REQ-011 gate: reportable + no vigilance_ref → block.
  if (complaint.reportabilityStatus === 'reportable' && !complaint.vigilanceRef) {
    return { allowed: false, reason: 'vigilance_link_missing' };
  }

  return { allowed: true, reason: 'ok' };
}
