// @MX:NOTE [AUTO] POST /api/clinical-investigation/[id]/protocol — REQ-005, AC-06.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-005, AC-06)

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { assertInvestigationAccess, resolveRouteId } from '@/lib/clinical-investigation/access';
import { buildProtocolDraft } from '@/lib/clinical-investigation/protocol-builder';
import { protocolInputSchema } from '@/lib/clinical-investigation/types';
import { db } from '@/lib/db/client';
import { ciProtocols } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

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

  const parsed = protocolInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const draft = buildProtocolDraft(input);

  try {
    const persisted = await db.transaction(async (tx) => {
      // Upsert: one protocol per investigation (insert-or-update by investigationId).
      const [existing] = await tx
        .select({ id: ciProtocols.id })
        .from(ciProtocols)
        .where(
          and(
            eq(ciProtocols.investigationId, investigationId),
            eq(ciProtocols.orgId, organizationId),
          ),
        )
        .limit(1);

      let protocolId: string;
      if (existing) {
        const [updated] = await tx
          .update(ciProtocols)
          .set({
            synopsis: draft.synopsis,
            endpoints: draft.endpoints,
            inclusionCriteria: draft.inclusionCriteria,
            exclusionCriteria: draft.exclusionCriteria,
            updatedAt: new Date(),
          })
          .where(eq(ciProtocols.id, existing.id))
          .returning({ id: ciProtocols.id });
        protocolId = updated?.id ?? existing.id;
      } else {
        const [inserted] = await tx
          .insert(ciProtocols)
          .values({
            orgId: organizationId,
            investigationId,
            synopsis: draft.synopsis,
            endpoints: draft.endpoints,
            inclusionCriteria: draft.inclusionCriteria,
            exclusionCriteria: draft.exclusionCriteria,
          })
          .returning({ id: ciProtocols.id });
        if (!inserted) throw new Error('ci_protocols insert returned no rows');
        protocolId = inserted.id;
      }

      await writeAudit(
        {
          actor_id: session.user.id,
          action: 'ci.protocol_updated',
          resource_type: 'clinical_investigation',
          resource_id: investigationId,
          meta_json: {
            investigationId,
            protocolId,
            endpointCount: draft.endpoints.length,
            inclusionCount: draft.inclusionCriteria.length,
            exclusionCount: draft.exclusionCriteria.length,
          },
        },
        tx,
      );

      return { protocolId };
    });

    return Response.json({ id: persisted.protocolId, draft });
  } catch (err) {
    console.error('ci.protocol failed (transaction rolled back)', err);
    return Response.json({ error: 'Failed to save protocol' }, { status: 500 });
  }
});
