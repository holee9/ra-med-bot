// GET /api/ra/dhf/[id]/verifications — list V&V records for a DHF.
// POST /api/ra/dhf/[id]/verifications — add a verification protocol.
// @MX:SPEC SPEC-REGULA-DHF-001

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { designHistoryFiles, designVerifications } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const CreateVerificationSchema = z.object({
  design_input_id: z.string().optional(),
  verification_type: z.enum(['analysis', 'test', 'inspection', 'demonstration']),
  protocol_title: z.string().min(1).max(500),
  result: z.enum(['pass', 'fail', 'pending', 'not_started']).optional(),
  test_date: z.string().optional(), // ISO date string YYYY-MM-DD
  performed_by: z.string().max(255).optional(),
  notes: z.string().optional(),
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

  const verifications = await db
    .select()
    .from(designVerifications)
    .where(eq(designVerifications.dhfId, id));

  return Response.json({ verifications });
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

  const parsed = CreateVerificationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const [created] = await db
    .insert(designVerifications)
    .values({
      dhfId: id,
      designInputId: data.design_input_id ?? null,
      verificationType: data.verification_type,
      protocolTitle: data.protocol_title,
      result: data.result ?? null,
      testDate: data.test_date ?? null,
      performedBy: data.performed_by ?? null,
      notes: data.notes ?? null,
    })
    .returning();

  if (!created) {
    return Response.json({ error: 'Insert failed' }, { status: 500 });
  }

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
      result: data.result ?? null,
      verificationId: created.id,
      verificationType: data.verification_type,
    },
  });

  return Response.json({ verification: created }, { status: 201 });
});
