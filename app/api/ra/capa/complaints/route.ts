// @MX:NOTE [AUTO] POST /api/ra/capa/complaints — structured complaint intake (REQ-001).
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-001, AC-01, AC-04)

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { auditComplaintIntakeCreated } from '@/lib/capa/audit';
import { createComplaint } from '@/lib/capa/intake';
import { computeTrendSignature } from '@/lib/capa/trend-detector';
import { db } from '@/lib/db/client';
import { complaints } from '@/lib/db/schema';
import { assertPmsProjectAccess } from '@/lib/pms/project-ownership';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const ComplaintIntakeSchema = z.object({
  projectId: z.string().uuid(),
  deviceName: z.string().min(1).max(256),
  deviceModel: z.string().max(256).optional(),
  lotNumber: z.string().max(128).optional(),
  eventDescription: z.string().min(1).max(8000),
  patientOutcome: z.enum(['death', 'serious_injury', 'malfunction', 'no_injury', 'other']),
  deviceCategory: z.enum(['class_I', 'class_II', 'class_III', 'IIa', 'IIb', 'III']),
  eventDate: z.string().min(1).max(32),
  awarenessDate: z.string().min(1).max(32),
  isManufacturerAware: z.boolean(),
  reporterName: z.string().min(1).max(256),
  reporterRole: z.string().min(1).max(256),
});

export const POST = withPermission('complaint.create', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const parsed = ComplaintIntakeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const body = parsed.data;

  // C-1 IDOR defense: prove the project belongs to the caller's org BEFORE any
  // write. Mirrors CC run route pattern (lib/pms/project-ownership.ts).
  const projectAccessDenied = await assertPmsProjectAccess(body.projectId, organizationId);
  if (projectAccessDenied) {
    return Response.json({ error: 'Project access denied' }, { status: 403 });
  }

  // REQ-001: create the complaint. The trend signature is computed up-front
  // so trend detection (REQ-007) is O(1) at insert time.
  //
  // H-2 fix (Part 11 atomicity): the insert + audit ride the same transaction
  // boundary so a mid-write failure cannot leave a complaint without an audit
  // row. Mirrors the PMS close route pattern.
  let complaintId = '';
  let trendSignature = '';
  try {
    await db.transaction(async (tx) => {
      const created = await createComplaint(
        {
          orgId: organizationId,
          projectId: body.projectId,
          intake: body,
          createdBy: session.user.id,
        },
        tx,
      );
      complaintId = created.id;
      trendSignature = created.trendSignature;

      // REQ-010 / AC-04: audit the intake creation (21 CFR Part 11).
      await auditComplaintIntakeCreated(
        {
          userId: session.user.id,
          complaintId,
          projectId: body.projectId,
          deviceName: body.deviceName,
        },
        tx,
      );
    });
  } catch (err) {
    console.error('complaint.intake_created failed (transaction rolled back)', err);
    return Response.json({ error: 'intake_failed' }, { status: 500 });
  }

  return Response.json(
    {
      complaintId,
      reportabilityStatus: 'pending',
      trendSignature,
    },
    { status: 201 },
  );
});
