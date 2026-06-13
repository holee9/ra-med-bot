// GET /api/ra/esubmit/[id]/interactions — list regulatory interactions for a package.
// POST /api/ra/esubmit/[id]/interactions — add a new RTA/AI request interaction.
// @MX:SPEC SPEC-REGULA-ESUBMIT-001

import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { submissionPackages, submissionInteractions } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

const CreateInteractionSchema = z.object({
  interaction_type: z.enum(['rta', 'ai_request', 'deficiency', 'approval', 'rejection']),
  reference_number: z.string().max(100).optional(),
  description: z.string().min(1),
  due_date: z.string().date().optional(),
});

export const GET = withPermission('dashboard.view', async (_req, ctx, session) => {
  const orgId = session.user.organizationId;
  if (!orgId) {
    return Response.json({ error: 'Organization context required' }, { status: 400 });
  }

  const params = ctx.params ? await ctx.params : {};
  const id = (params as { id?: string }).id;
  if (!id) {
    return Response.json({ error: 'Missing package ID' }, { status: 400 });
  }

  // Verify package belongs to org
  const [pkg] = await db
    .select({ id: submissionPackages.id })
    .from(submissionPackages)
    .where(and(eq(submissionPackages.id, id), eq(submissionPackages.orgId, orgId)))
    .limit(1);

  if (!pkg) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const interactions = await db
    .select()
    .from(submissionInteractions)
    .where(eq(submissionInteractions.packageId, id))
    .orderBy(desc(submissionInteractions.createdAt));

  return Response.json({ interactions });
});

export const POST = withPermission('dashboard.view', async (req, ctx, session) => {
  const orgId = session.user.organizationId;
  if (!orgId) {
    return Response.json({ error: 'Organization context required' }, { status: 400 });
  }

  const params = ctx.params ? await ctx.params : {};
  const id = (params as { id?: string }).id;
  if (!id) {
    return Response.json({ error: 'Missing package ID' }, { status: 400 });
  }

  // Verify package belongs to org
  const [pkg] = await db
    .select({ id: submissionPackages.id })
    .from(submissionPackages)
    .where(and(eq(submissionPackages.id, id), eq(submissionPackages.orgId, orgId)))
    .limit(1);

  if (!pkg) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = CreateInteractionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const [created] = await db
    .insert(submissionInteractions)
    .values({
      packageId: id,
      interactionType: data.interaction_type,
      referenceNumber: data.reference_number ?? null,
      description: data.description,
      dueDate: data.due_date ?? null,
    })
    .returning();

  // If RTA received, update package status
  if (data.interaction_type === 'rta') {
    await db
      .update(submissionPackages)
      .set({ status: 'rta', updatedAt: new Date() })
      .where(eq(submissionPackages.id, id));
  }

  return Response.json({ interaction: created }, { status: 201 });
});
