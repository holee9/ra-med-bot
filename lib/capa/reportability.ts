// @MX:ANCHOR [AUTO] persistComplaintReportability — complaint → vigilance DB persistence.
// @MX:REASON Called by POST /api/ra/capa/complaints/[id]/reportability route.
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-002)
//
// REQ-002: assesses complaint reportability by DIRECTLY REUSING the #61 Vigilance
// decision engine (assessReportability). The pure mapping + assessment functions
// live in reportability-mapping.ts (no DB dependency, unit-testable). This module
// owns the DB persistence: stores the result on complaints + links
// vigilance_reports when reportable. The decision logic itself is NOT duplicated
// — assessReportability is the single source of truth.
//
// C-1 fix (cross-org data isolation): adverse_events / vigilance_reports have no
// org_id column — they are scoped via workflow_runs.org_id (the #61 Vigilance
// structure). To guarantee CAPA-created vigilance data belongs to the caller's
// org, we (1) thread userId into createdBy (H-3 fix — was orgId, now userId),
// and (2) resolve the complaint's workflow_run_id and pass it when creating the
// adverse_event so the workflow_runs.org_id linkage is established. The complaint
// is fetched with an org_id scope, so the workflow_run resolved here is already
// guaranteed to belong to the caller's org. Callers MUST pass the authenticated
// user's id — not the org id.

import { db } from '@/lib/db/client';
import { adverseEvents, complaints, vigilanceReports } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import type { ComplaintIntake, ComplaintReportabilityResult } from './types';

/** Minimal transaction-handle type compatible with both the db singleton and a tx-scoped clone. */
type DbHandle = {
  select: (typeof db)['select'];
  insert: (typeof db)['insert'];
  update: (typeof db)['update'];
};

// Re-export the pure functions so route callers can import everything from one
// module (preserves the original public API of reportability.ts).
export { assessComplaintReportability, mapComplaintToAdverseEvent } from './reportability-mapping';

/**
 * Persist the reportability decision on a complaint, and when reportable create
 * an adverse_event + vigilance_report row then set complaints.vigilance_ref.
 *
 * IDOR defense: scoped by orgId + complaintId. Returns null when the complaint
 * is absent or cross-org (callers surface 404).
 *
 * C-1 / H-3 fixes:
 *   - createdBy is the authenticated USER id (H-3 — was orgId).
 *   - adverse_event.workflow_run_id is set to the complaint's workflow_run_id
 *     so the vigilance data is anchored to a workflow_run owned by the caller's
 *     org (C-1). The complaint row was fetched with an org_id filter, so its
 *     workflow_run_id is guaranteed org-scoped.
 *
 * @MX:WARN [AUTO] Performs multiple writes; callers MUST wrap in a transaction.
 * @MX:REASON 21 CFR Part 11 — the reportability decision + vigilance link must
 *            be atomic so a mid-write failure cannot leave a reportable
 *            complaint without a vigilance_ref (REQ-011 close gate depends on it).
 */
export async function persistComplaintReportability(
  params: {
    complaintId: string;
    orgId: string;
    userId: string;
    result: ComplaintReportabilityResult;
  },
  tx?: DbHandle,
): Promise<{ vigilanceRef: string | null }> {
  const { complaintId, orgId, userId, result } = params;
  const client = tx ?? db;

  const [complaint] = await client
    .select({
      id: complaints.id,
      intakeData: complaints.intakeData,
      workflowRunId: complaints.workflowRunId,
    })
    .from(complaints)
    .where(and(eq(complaints.id, complaintId), eq(complaints.orgId, orgId)))
    .limit(1);

  if (!complaint) return { vigilanceRef: null };

  let vigilanceRef: string | null = null;

  if (result.reportabilityStatus === 'reportable') {
    // REQ-002: create an adverse_event + vigilance_report and link.
    const intake = complaint.intakeData as ComplaintIntake;
    const [ae] = await client
      .insert(adverseEvents)
      .values({
        // C-1: anchor the adverse event to the complaint's workflow_run so the
        // vigilance data is org-scoped via workflow_runs.org_id. The complaint
        // was fetched with an org_id filter, so this workflow_run is already
        // guaranteed to belong to the caller's org.
        workflowRunId: complaint.workflowRunId ?? null,
        eventDate: intake.eventDate,
        deviceName: intake.deviceName,
        deviceModel: intake.deviceModel ?? null,
        lotNumber: intake.lotNumber ?? null,
        eventDescription: intake.eventDescription,
        patientOutcome: intake.patientOutcome,
        awarenessDate: intake.awarenessDate,
        reporterName: intake.reporterName,
        reporterRole: intake.reporterRole,
        // H-3 fix: createdBy is the authenticated user id, NOT the org id.
        // The previous value (orgId) corrupted the audit provenance — the
        // column records WHO created the row, not which tenant.
        createdBy: userId,
      })
      .returning({ id: adverseEvents.id });

    const reportType = result.fdaMdrRequired ? 'fda_mdr' : result.euMdvRequired ? 'eu_mdv' : 'fsca';
    const adverseEventId = ae?.id;
    if (!adverseEventId) return { vigilanceRef: null };
    const [vr] = await client
      .insert(vigilanceReports)
      .values({
        adverseEventId,
        reportType,
        reportFormat: reportType === 'fda_mdr' ? 'mdr_3500a' : 'eu_mdv_initial',
      })
      .returning({ id: vigilanceReports.id });

    if (vr?.id) vigilanceRef = vr.id;
  }

  await client
    .update(complaints)
    .set({ reportabilityStatus: result.reportabilityStatus, vigilanceRef })
    .where(and(eq(complaints.id, complaintId), eq(complaints.orgId, orgId)));

  return { vigilanceRef };
}
