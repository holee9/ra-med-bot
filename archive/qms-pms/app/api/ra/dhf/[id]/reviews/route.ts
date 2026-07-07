// GET /api/ra/dhf/[id]/reviews — list design reviews for a DHF.
// POST /api/ra/dhf/[id]/reviews — add a design review record.

// @MX:LEGACY archived from app
// @MX:SPEC SPEC-REGULA-DHF-001

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { designHistoryFiles, designReviews } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const CreateReviewSchema = z.object({
  review_stage: z.enum(['concept', 'preliminary', 'critical', 'final', 'design_freeze']),
  review_date: z.string(), // ISO date string YYYY-MM-DD
  attendees: z.array(z.string()).default([]),
  decisions: z.string().optional(),
  open_actions: z.string().optional(),
  approved_by: z.string().max(255).optional(),
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
    .select({ id: designHistoryFiles.id })
    .from(designHistoryFiles)
    .where(and(eq(designHistoryFiles.id, id), eq(designHistoryFiles.orgId, orgId)))
    .limit(1);

  if (!dhf) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const reviews = await db.select().from(designReviews).where(eq(designReviews.dhfId, id));

  return Response.json({ reviews });
});

export const POST = withPermission('dashboard.view', async (req, ctx, session) => {
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
    .select({ id: designHistoryFiles.id, deviceName: designHistoryFiles.deviceName })
    .from(designHistoryFiles)
    .where(and(eq(designHistoryFiles.id, id), eq(designHistoryFiles.orgId, orgId)))
    .limit(1);

  if (!dhf) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = CreateReviewSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const isApproval = !!data.approved_by;

  const [created] = await db
    .insert(designReviews)
    .values({
      dhfId: id,
      reviewStage: data.review_stage,
      reviewDate: data.review_date,
      attendees: data.attendees,
      decisions: data.decisions ?? null,
      openActions: data.open_actions ?? null,
      approvedBy: data.approved_by ?? null,
      approvedAt: isApproval ? new Date() : null,
    })
    .returning();

  if (!created) {
    return Response.json({ error: 'Insert failed' }, { status: 500 });
  }

  if (isApproval) {
    await writeAudit({
      actor_id: session.user.id,
      action: 'dhf_review_approved',
      resource_type: 'design_history_file',
      resource_id: id,
      meta_json: {
        review_stage: data.review_stage,
        approved_by: data.approved_by,
        device_name: dhf.deviceName,
      },
    });
  }

  await db
    .update(designHistoryFiles)
    .set({ updatedAt: new Date() })
    .where(eq(designHistoryFiles.id, id));

  return Response.json({ review: created }, { status: 201 });
});
