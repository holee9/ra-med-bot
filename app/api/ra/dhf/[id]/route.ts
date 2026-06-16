// GET /api/ra/dhf/[id] — fetch a single DHF with all related data.
// PATCH /api/ra/dhf/[id] — update DHF fields (including design_freeze).
// @MX:SPEC SPEC-REGULA-DHF-001

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import {
  designHistoryFiles,
  designInputs,
  designReviews,
  designVerifications,
} from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const PatchDHFSchema = z.object({
  device_name: z.string().min(1).max(255).optional(),
  device_model: z.string().max(255).nullable().optional(),
  intended_use: z.string().min(10).optional(),
  jurisdiction: z.enum(['FDA', 'EU', 'MFDS', 'NMPA', 'PMDA']).optional(),
  regulatory_framework: z.enum(['QSR_QMSR', 'ISO_13485', 'EU_MDR']).optional(),
  status: z.enum(['draft', 'in_review', 'design_freeze', 'archived']).optional(),
  // Setting design_freeze = true triggers design_freeze status + date stamp
  design_freeze: z.boolean().optional(),
});

export const GET = withPermission('dashboard.view', async (_req, ctx, session) => {
  const orgId = session.user.organizationId;
  if (!orgId) {
    return Response.json({ error: 'Organization context required' }, { status: 400 });
  }

  const params = ctx.params ? await ctx.params : {};
  const id = (params as { id?: string }).id;
  if (!id) {
    return Response.json({ error: 'Missing DHF ID' }, { status: 400 });
  }

  const [dhf] = await db
    .select()
    .from(designHistoryFiles)
    .where(and(eq(designHistoryFiles.id, id), eq(designHistoryFiles.orgId, orgId)))
    .limit(1);

  if (!dhf) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const [inputs, verifications, reviews] = await Promise.all([
    db.select().from(designInputs).where(eq(designInputs.dhfId, id)),
    db.select().from(designVerifications).where(eq(designVerifications.dhfId, id)),
    db.select().from(designReviews).where(eq(designReviews.dhfId, id)),
  ]);

  return Response.json({ dhf, inputs, verifications, reviews });
});

export const PATCH = withPermission('dashboard.view', async (req, ctx, session) => {
  const orgId = session.user.organizationId;
  if (!orgId) {
    return Response.json({ error: 'Organization context required' }, { status: 400 });
  }

  const params = ctx.params ? await ctx.params : {};
  const id = (params as { id?: string }).id;
  if (!id) {
    return Response.json({ error: 'Missing DHF ID' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PatchDHFSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const isDesignFreeze = data.design_freeze === true;

  const [existing] = await db
    .select()
    .from(designHistoryFiles)
    .where(and(eq(designHistoryFiles.id, id), eq(designHistoryFiles.orgId, orgId)))
    .limit(1);

  if (!existing) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const [updated] = await db
    .update(designHistoryFiles)
    .set({
      ...(data.device_name !== undefined && { deviceName: data.device_name }),
      ...(data.device_model !== undefined && { deviceModel: data.device_model }),
      ...(data.intended_use !== undefined && { intendedUse: data.intended_use }),
      ...(data.jurisdiction !== undefined && { jurisdiction: data.jurisdiction }),
      ...(data.regulatory_framework !== undefined && {
        regulatoryFramework: data.regulatory_framework,
      }),
      ...(data.status !== undefined && { status: data.status }),
      ...(isDesignFreeze && {
        status: 'design_freeze',
        designFreezeDate: new Date().toISOString().split('T')[0],
      }),
      updatedAt: new Date(),
    })
    .where(and(eq(designHistoryFiles.id, id), eq(designHistoryFiles.orgId, orgId)))
    .returning();

  if (!updated) {
    return Response.json({ error: 'Update failed' }, { status: 500 });
  }

  await writeAudit({
    actor_id: session.user.id,
    action: isDesignFreeze ? 'dhf_design_freeze' : 'dhf_updated',
    resource_type: 'design_history_file',
    resource_id: id,
    meta_json: { device_name: updated.deviceName },
  });

  return Response.json({ dhf: updated });
});
