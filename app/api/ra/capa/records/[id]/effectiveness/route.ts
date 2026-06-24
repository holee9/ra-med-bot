// @MX:NOTE [AUTO] POST /api/ra/capa/records/[id]/effectiveness — schedule effectiveness check (REQ-006).
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-006, AC-02, AC-04)

import { withPermission } from '@/lib/auth/with-permission';
import { auditCapaEffectivenessScheduled } from '@/lib/capa/audit';
import { getCapaRecord } from '@/lib/capa/records';
import { db } from '@/lib/db/client';
import { capaEffectivenessChecks, capaRecords } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const EffectivenessSchema = z.object({
  dueDate: z.string().min(1).max(32),
  // optional: record a completed check result
  result: z.enum(['effective', 'ineffective']).optional(),
  notes: z.string().max(4000).optional(),
});

export const POST = withPermission('capa.effectiveness', async (req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const rawParams = ctx.params;
  const resolvedParams = rawParams && 'then' in rawParams ? await rawParams : rawParams;
  const capaId = resolvedParams?.id ?? '';

  if (!capaId) {
    return Response.json({ error: 'capa id required' }, { status: 400 });
  }

  const parsed = EffectivenessSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const body = parsed.data;

  // IDOR defense: CAPA must belong to the caller's org.
  const capa = await getCapaRecord(capaId, organizationId);
  if (!capa) {
    return Response.json({ error: 'CAPA not found' }, { status: 404 });
  }

  // REQ-006: schedule (or record) the effectiveness check.
  //
  // H-2 fix (Part 11 atomicity): the insert (+ optional CAPA status update) +
  // audit ride the same transaction boundary so a mid-write failure cannot
  // leave an effectiveness check without an audit row. Mirrors the PMS close
  // route pattern.
  let effectivenessCheckId = '';
  try {
    await db.transaction(async (tx) => {
      const [check] = await tx
        .insert(capaEffectivenessChecks)
        .values({
          orgId: organizationId,
          capaId,
          dueDate: body.dueDate,
          result: body.result ?? null,
          notes: body.notes ?? null,
          checkedAt: body.result ? new Date() : null,
        })
        .returning({ id: capaEffectivenessChecks.id });

      effectivenessCheckId = check?.id ?? '';

      // When a result is recorded, update the CAPA's effectiveness_status.
      if (body.result) {
        await tx
          .update(capaRecords)
          .set({
            effectivenessStatus: body.result === 'effective' ? 'passed' : 'failed',
            updatedAt: new Date(),
          })
          .where(and(eq(capaRecords.id, capaId), eq(capaRecords.orgId, organizationId)));
      }

      // REQ-010 / AC-04: audit the effectiveness scheduling.
      await auditCapaEffectivenessScheduled(
        {
          userId: session.user.id,
          capaId,
          dueDate: body.dueDate,
        },
        tx,
      );
    });
  } catch (err) {
    console.error('capa.effectiveness_scheduled failed (transaction rolled back)', err);
    return Response.json({ error: 'effectiveness_check_failed' }, { status: 500 });
  }

  if (!effectivenessCheckId) {
    return Response.json({ error: 'effectiveness_check_failed' }, { status: 500 });
  }

  return Response.json(
    {
      effectivenessCheckId,
      capaId,
      result: body.result ?? null,
    },
    { status: 201 },
  );
});
