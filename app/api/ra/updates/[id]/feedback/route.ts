// POST /api/ra/updates/[id]/feedback — user feedback on regulatory update relevance.
// @MX:SPEC SPEC-REGULA-RADAR-001

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { writeAudit } from '../../../../../../lib/audit';
import { withPermission } from '../../../../../../lib/auth/with-permission';
import { db } from '../../../../../../lib/db/client';
import { orgUpdateRelevance } from '../../../../../../lib/db/schema';

const FeedbackSchema = z.object({
  feedback: z.enum(['not_interested']),
});

export const POST = withPermission('dashboard.view', async (req, ctx, session) => {
  const params = ctx.params ? await ctx.params : {};
  const id = (params as { id?: string }).id;

  if (!id) {
    return Response.json({ error: 'Missing update ID' }, { status: 400 });
  }

  const body = (await req.json()) as unknown;
  const parsed = FeedbackSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: 'Invalid feedback value' }, { status: 422 });
  }

  const orgId = session.user.organizationId;
  if (!orgId) {
    return Response.json({ error: 'No organization context' }, { status: 403 });
  }

  // Upsert feedback into org_update_relevance
  const existing = await db
    .select({ id: orgUpdateRelevance.id })
    .from(orgUpdateRelevance)
    .where(and(eq(orgUpdateRelevance.orgId, orgId), eq(orgUpdateRelevance.updateId, id)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(orgUpdateRelevance)
      .set({ feedback: parsed.data.feedback })
      .where(and(eq(orgUpdateRelevance.orgId, orgId), eq(orgUpdateRelevance.updateId, id)));
  } else {
    await db.insert(orgUpdateRelevance).values({
      orgId,
      updateId: id,
      impactScore: '0',
      feedback: parsed.data.feedback,
    });
  }

  await writeAudit({
    actor_id: session.user.id,
    action: 'message.feedback',
    resource_type: 'regulatory_update',
    resource_id: id,
    meta_json: { feedbackType: parsed.data.feedback },
  });

  return Response.json({ ok: true });
});
