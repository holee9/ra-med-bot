// @MX:NOTE [AUTO] POST /api/ra/capa/records — create corrective/preventive CAPA (REQ-004/005).
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-004, REQ-005, REQ-006, REQ-008, REQ-010, AC-03, AC-04)

import { withPermission } from '@/lib/auth/with-permission';
import { auditCapaEffectivenessScheduled, auditCapaRecordCreated } from '@/lib/capa/audit';
import { linkCapaToTargets } from '@/lib/capa/linkage';
import { createCapaRecord } from '@/lib/capa/records';
import { db } from '@/lib/db/client';
import { assertPmsProjectAccess } from '@/lib/pms/project-ownership';
import { z } from 'zod';

const CreateCapaSchema = z.object({
  projectId: z.string().uuid(),
  complaintId: z.string().uuid(),
  type: z.enum(['corrective', 'preventive']),
  description: z.string().min(1).max(8000),
  ownerId: z.string().uuid(),
  dueDate: z.string().min(1).max(32),
  effectivenessDueDate: z.string().min(1).max(32).optional(),
  links: z
    .array(
      z.object({
        targetType: z.enum(['risk', 'change_control', 'dhf', 'pms']),
        targetId: z.string().min(1).max(128),
      }),
    )
    .optional(),
});

export const POST = withPermission('capa.create', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const parsed = CreateCapaSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const body = parsed.data;

  // C-1 IDOR defense: project must belong to the caller's org.
  const projectAccessDenied = await assertPmsProjectAccess(body.projectId, organizationId);
  if (projectAccessDenied) {
    return Response.json({ error: 'Project access denied' }, { status: 403 });
  }

  // REQ-004/005: create the CAPA record (corrective/preventive split).
  // REQ-006: when effectivenessDueDate is set, schedules an effectiveness check.
  //
  // H-2 fix (Part 11 atomicity): the record insert + effectiveness insert +
  // audit writes ride the same transaction boundary so a mid-write failure
  // cannot leave a CAPA record without an audit row. Mirrors the PMS close
  // route pattern. Link creation (REQ-008) happens AFTER the tx commits —
  // links are best-effort and do not block the CAPA creation audit trail.
  let capaId = '';
  let effectivenessCheckId: string | null = null;
  try {
    await db.transaction(async (tx) => {
      const created = await createCapaRecord(
        {
          orgId: organizationId,
          projectId: body.projectId,
          complaintId: body.complaintId,
          type: body.type,
          description: body.description,
          ownerId: body.ownerId,
          dueDate: body.dueDate,
          createdBy: session.user.id,
          effectivenessDueDate: body.effectivenessDueDate,
        },
        tx,
      );
      capaId = created.capaId;
      effectivenessCheckId = created.effectivenessCheckId;

      // REQ-010 / AC-04: audit record creation.
      await auditCapaRecordCreated(
        {
          userId: session.user.id,
          capaId,
          complaintId: body.complaintId,
          type: body.type,
        },
        tx,
      );

      // REQ-006 / AC-02: audit effectiveness scheduling.
      if (effectivenessCheckId && body.effectivenessDueDate) {
        await auditCapaEffectivenessScheduled(
          {
            userId: session.user.id,
            capaId,
            dueDate: body.effectivenessDueDate,
          },
          tx,
        );
      }
    });
  } catch (err) {
    console.error('capa.record_created failed (transaction rolled back)', err);
    return Response.json({ error: 'create_failed' }, { status: 500 });
  }

  // REQ-008 / AC-03: auto-link to risk / change_control / DHF / PMS.
  // Outside the tx — links are best-effort and idempotent.
  let linkCount = 0;
  if (body.links && body.links.length > 0) {
    const result = await linkCapaToTargets({
      capaId,
      orgId: organizationId,
      createdBy: session.user.id,
      links: body.links,
    });
    linkCount = result.created;
  }

  return Response.json(
    {
      capaId,
      effectivenessCheckId,
      linkCount,
    },
    { status: 201 },
  );
});
