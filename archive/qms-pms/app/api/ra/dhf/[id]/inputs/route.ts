// GET /api/ra/dhf/[id]/inputs — list design inputs for a DHF.
// POST /api/ra/dhf/[id]/inputs — add a new design input.

// @MX:LEGACY archived from app
// @MX:SPEC SPEC-REGULA-DHF-001

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { designHistoryFiles, designInputs } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const CreateInputSchema = z.object({
  input_type: z.enum(['user_need', 'regulatory', 'standards', 'risk']),
  requirement_id: z.string().max(50).optional(),
  description: z.string().min(1),
  source: z.string().max(255).optional(),
  priority: z.enum(['must', 'should', 'nice_to_have']).default('must'),
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

  // Verify DHF belongs to org
  const [dhf] = await db
    .select({ id: designHistoryFiles.id })
    .from(designHistoryFiles)
    .where(and(eq(designHistoryFiles.id, id), eq(designHistoryFiles.orgId, orgId)))
    .limit(1);

  if (!dhf) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const inputs = await db.select().from(designInputs).where(eq(designInputs.dhfId, id));

  return Response.json({ inputs });
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
    .select({ id: designHistoryFiles.id })
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

  const parsed = CreateInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const [created] = await db
    .insert(designInputs)
    .values({
      dhfId: id,
      inputType: data.input_type,
      requirementId: data.requirement_id ?? null,
      description: data.description,
      source: data.source ?? null,
      priority: data.priority,
    })
    .returning();

  if (!created) {
    return Response.json({ error: 'Insert failed' }, { status: 500 });
  }

  // Update DHF updatedAt so completeness recalculation picks it up
  await db
    .update(designHistoryFiles)
    .set({ updatedAt: new Date() })
    .where(eq(designHistoryFiles.id, id));
  await writeAudit({
    actor_id: session.user.id,
    action: 'dhf_updated',
    resource_type: 'dhf',
    resource_id: id,
    meta_json: {
      inputId: created.id,
      inputType: data.input_type,
      priority: data.priority,
    },
  });

  return Response.json({ input: created }, { status: 201 });
});
