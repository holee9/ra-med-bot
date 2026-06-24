// @MX:NOTE [AUTO] POST /api/ra/capa/complaints/[id]/reportability — REQ-002 Vigilance link.
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-002, AC-01, AC-07)
//
// H-2 fix (Part 11 atomicity): the persist + audit ride the same transaction
// boundary so a mid-write failure cannot leave a reportability decision without
// an audit row. Mirrors the PMS close route pattern.
//
// C-1 / H-3 fixes: the authenticated user id is threaded into
// persistComplaintReportability so (1) createdBy records the user (not the org)
// and (2) the adverse_event is anchored to the caller-org-scoped workflow_run.

import { withPermission } from '@/lib/auth/with-permission';
import { auditComplaintReportabilityAssessed } from '@/lib/capa/audit';
import { getComplaint } from '@/lib/capa/intake';
import {
  assessComplaintReportability,
  persistComplaintReportability,
} from '@/lib/capa/reportability';
import { db } from '@/lib/db/client';

export const POST = withPermission('complaint.assess_reportability', async (_req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  // Next.js 15 Promise params.
  const rawParams = ctx.params;
  const resolvedParams = rawParams && 'then' in rawParams ? await rawParams : rawParams;
  const complaintId = resolvedParams?.id ?? '';

  if (!complaintId) {
    return Response.json({ error: 'complaint id required' }, { status: 400 });
  }

  // IDOR defense: fetch scoped by org. getComplaint returns null for
  // absent OR cross-org complaints (same return shape avoids UUID probing).
  const complaint = await getComplaint(complaintId, organizationId);
  if (!complaint) {
    return Response.json({ error: 'Complaint not found' }, { status: 404 });
  }

  // REQ-002 reuse: assessReportability (vigilance engine) is the single
  // source of truth for FDA MDR + EU MDV rules.
  const result = assessComplaintReportability(complaint.intakeData);

  // Persist the decision + link vigilance when reportable. REQ-002:
  // persistComplaintReportability creates adverse_event + vigilance_report
  // and sets complaints.vigilance_ref (REQ-011 close gate depends on this).
  //
  // H-2 fix: wrap persist + audit in a single transaction.
  let vigilanceRef: string | null = null;
  try {
    await db.transaction(async (tx) => {
      const persisted = await persistComplaintReportability(
        {
          complaintId,
          orgId: organizationId,
          userId: session.user.id,
          result,
        },
        tx,
      );
      vigilanceRef = persisted.vigilanceRef;

      // REQ-010 / AC-04: audit the assessment decision.
      await auditComplaintReportabilityAssessed(
        {
          userId: session.user.id,
          complaintId,
          reportable: result.reportabilityStatus === 'reportable',
          vigilanceLinked: Boolean(vigilanceRef),
        },
        tx,
      );
    });
  } catch (err) {
    console.error('complaint.reportability_assessed failed (transaction rolled back)', err);
    return Response.json({ error: 'reportability_failed' }, { status: 500 });
  }

  return Response.json({
    complaintId,
    reportabilityStatus: result.reportabilityStatus,
    fdaMdrRequired: result.fdaMdrRequired,
    fdaMdrDeadlineDays: result.fdaMdrDeadlineDays,
    euMdvRequired: result.euMdvRequired,
    euMdvDeadlineDays: result.euMdvDeadlineDays,
    fscaRequired: result.fscaRequired,
    vigilanceRef,
  });
});
