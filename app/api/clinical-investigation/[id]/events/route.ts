// @MX:NOTE [AUTO] POST /api/clinical-investigation/[id]/events — REQ-008.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-008)
// @MX:REASON Milestone / deviation tracking. SPEC-REGULA-PHI-REMOVAL-001 removed
//           the adverse_event type + vigilanceRef coupling — Regula does not
//           handle patient outcomes.

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { assertInvestigationAccess, resolveRouteId } from '@/lib/clinical-investigation/access';
import { ciEventInputSchema } from '@/lib/clinical-investigation/types';
import { db } from '@/lib/db/client';
import { ciEvents } from '@/lib/db/schema';

export const POST = withPermission('clinical_investigation.manage', async (req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }
  const investigationId = await resolveRouteId(ctx);

  const investigation = await assertInvestigationAccess(investigationId, organizationId);
  if (!investigation) {
    return Response.json({ error: 'Investigation not found' }, { status: 404 });
  }

  const parsed = ciEventInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  try {
    const inserted = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(ciEvents)
        .values({
          orgId: organizationId,
          investigationId,
          type: input.type,
          data: {
            title: input.title,
            ...(input.description ? { description: input.description } : {}),
          },
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
        })
        .returning({ id: ciEvents.id });

      if (!row) throw new Error('ci_events insert returned no rows');

      await writeAudit(
        {
          actor_id: session.user.id,
          action: 'ci.event_recorded',
          resource_type: 'clinical_investigation',
          resource_id: investigationId,
          meta_json: {
            investigationId,
            eventId: row.id,
            type: input.type,
          },
        },
        tx,
      );

      return row;
    });

    return Response.json(
      {
        id: inserted.id,
        type: input.type,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('ci.events failed (transaction rolled back)', err);
    return Response.json({ error: 'Failed to record event' }, { status: 500 });
  }
});
