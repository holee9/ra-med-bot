// @MX:NOTE [AUTO] GET/PATCH/DELETE /api/ra/deadlines/[id] — single deadline CRUD.
// @MX:SPEC SPEC-REGULA-CALENDAR-001 (REQ-CAL-002, 005, 006, Issue #44)
//
// Project membership is resolved from the deadline's projectId, then enforced.

import { writeAudit } from '@/lib/kernel/audit';
import { isProjectMember } from '@/lib/kernel/auth/acl';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { db } from '@/lib/kernel/db/client';
import { regulatoryDeadlines } from '@/lib/kernel/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const PatchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  deadlineType: z
    .enum([
      'fda_510k_clock',
      'eu_mdr_cert_expiry',
      'iso13485_surveillance',
      'pmda_reexam',
      'custom',
    ])
    .optional(),
  jurisdiction: z.enum(['FDA', 'EU_MDR', 'MFDS', 'PMDA', 'NMPA', 'GLOBAL']).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  status: z.enum(['upcoming', 'due_soon', 'overdue', 'completed', 'cancelled']).optional(),
  reference: z.string().max(300).nullable().optional(),
  notes: z.string().max(5000).optional(),
});

async function resolveAndCheck(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(regulatoryDeadlines)
    .where(eq(regulatoryDeadlines.id, id))
    .limit(1);
  if (!row) return { row: null, allowed: false, notFound: true };
  const member = await isProjectMember(userId, row.projectId);
  return { row, allowed: member, notFound: false };
}

// GET /api/ra/deadlines/[id]
export const GET = withPermission('deadline.view', async (_req, ctx, session) => {
  const params = ctx.params && 'then' in ctx.params ? await ctx.params : (ctx.params ?? {});
  const id = params.id ?? '';
  const { row, allowed, notFound } = await resolveAndCheck(id, session.user.id);
  if (notFound) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!allowed)
    return NextResponse.json({ error: 'not_a_member', resource_type: 'project' }, { status: 403 });
  return NextResponse.json({ deadline: row });
});

// PATCH /api/ra/deadlines/[id]
export const PATCH = withPermission('deadline.manage', async (req, ctx, session) => {
  const params = ctx.params && 'then' in ctx.params ? await ctx.params : (ctx.params ?? {});
  const id = params.id ?? '';
  const { allowed, notFound } = await resolveAndCheck(id, session.user.id);
  if (notFound) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!allowed)
    return NextResponse.json({ error: 'not_a_member', resource_type: 'project' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.deadlineType !== undefined) updates.deadlineType = parsed.data.deadlineType;
  if (parsed.data.jurisdiction !== undefined) updates.jurisdiction = parsed.data.jurisdiction;
  if (parsed.data.dueDate !== undefined) updates.dueDate = new Date(parsed.data.dueDate);
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.reference !== undefined) updates.reference = parsed.data.reference;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;

  const updated = await db.transaction(async (tx) => {
    const [result] = await tx
      .update(regulatoryDeadlines)
      .set(updates)
      .where(eq(regulatoryDeadlines.id, id))
      .returning({ id: regulatoryDeadlines.id, updatedAt: regulatoryDeadlines.updatedAt });

    if (!result) return null;

    await writeAudit(
      {
        action: 'deadline.updated',
        actor_id: session.user.id,
        resource_type: 'deadline',
        resource_id: id,
        meta_json: { fields: Object.keys(updates) },
      },
      tx,
    );

    return result;
  });

  if (!updated) return NextResponse.json({ error: 'update_failed' }, { status: 500 });

  return NextResponse.json({ deadline: updated });
});

// DELETE /api/ra/deadlines/[id]
export const DELETE = withPermission('deadline.manage', async (_req, ctx, session) => {
  const params = ctx.params && 'then' in ctx.params ? await ctx.params : (ctx.params ?? {});
  const id = params.id ?? '';
  const { row, allowed, notFound } = await resolveAndCheck(id, session.user.id);
  if (notFound) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!allowed)
    return NextResponse.json({ error: 'not_a_member', resource_type: 'project' }, { status: 403 });

  await db.transaction(async (tx) => {
    await tx.delete(regulatoryDeadlines).where(eq(regulatoryDeadlines.id, id));

    await writeAudit(
      {
        action: 'deadline.deleted',
        actor_id: session.user.id,
        resource_type: 'deadline',
        resource_id: id,
        meta_json: { projectId: row?.projectId },
      },
      tx,
    );
  });

  return NextResponse.json({ ok: true });
});
