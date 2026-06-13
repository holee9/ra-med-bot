// GET /api/ra/dhf/[id]/completeness — compute completeness score (0–100).
// @MX:SPEC SPEC-REGULA-DHF-001

import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import {
  designHistoryFiles,
  designInputs,
  designVerifications,
  designReviews,
} from '@/lib/db/schema';
import { computeCompleteness } from '@/lib/dhf/completeness';
import { eq, and } from 'drizzle-orm';

export { type CompletenessResult } from '@/lib/dhf/completeness';

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

  const result = computeCompleteness(dhf, inputs, verifications, reviews);

  // Persist the computed score back to the DHF row
  await db
    .update(designHistoryFiles)
    .set({ completenessScore: result.score, updatedAt: new Date() })
    .where(eq(designHistoryFiles.id, id));

  return Response.json(result);
});
