// @MX:NOTE [AUTO] GET/PATCH/DELETE /api/ra/personal/bookmarks/[id] — single bookmark CRUD.
// @MX:SPEC SPEC-REGULA-PERSONAL-LIB-001 (REQ-PERSONAL-002, 005, 006, 008, Issue #86)
//
// Privacy invariant (REQ-PERSONAL-002): every query is scoped to session.user.id.
// A bookmark owned by another user is reported as 404 (not 403) to avoid leaking existence.

import { writeAudit } from '@/lib/kernel/audit';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { db } from '@/lib/kernel/db/client';
import { personalBookmarks } from '@/lib/kernel/db/schema';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const PatchSchema = z.object({
  customTitle: z.string().max(500).nullable().optional(),
  note: z.string().max(5000).optional(),
  tags: z.array(z.string().min(1).max(50)).max(10).optional(),
});

// GET /api/ra/personal/bookmarks/[id]
export const GET = withPermission('personal.view', async (_req, ctx, session) => {
  const { id } = await (ctx.params ?? Promise.resolve({ id: '' }));
  const [row] = await db
    .select()
    .from(personalBookmarks)
    .where(and(eq(personalBookmarks.id, id), eq(personalBookmarks.userId, session.user.id)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ bookmark: row });
});

// PATCH /api/ra/personal/bookmarks/[id]
export const PATCH = withPermission('personal.view', async (req, ctx, session) => {
  const { id } = await (ctx.params ?? Promise.resolve({ id: '' }));
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.customTitle !== undefined) updates.customTitle = parsed.data.customTitle;
  if (parsed.data.note !== undefined) updates.note = parsed.data.note;
  if (parsed.data.tags !== undefined) updates.tags = parsed.data.tags;

  const [updated] = await db
    .update(personalBookmarks)
    .set(updates)
    .where(and(eq(personalBookmarks.id, id), eq(personalBookmarks.userId, session.user.id)))
    .returning({ id: personalBookmarks.id, updatedAt: personalBookmarks.updatedAt });

  if (!updated) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ bookmark: updated });
});

// DELETE /api/ra/personal/bookmarks/[id]
export const DELETE = withPermission('personal.view', async (_req, ctx, session) => {
  const { id } = await (ctx.params ?? Promise.resolve({ id: '' }));

  // 21 CFR Part 11 §11.10(e) — mutation + audit in same db.transaction (Issue #378)
  const deleted = await db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(personalBookmarks)
      .where(and(eq(personalBookmarks.id, id), eq(personalBookmarks.userId, session.user.id)))
      .returning({ id: personalBookmarks.id });

    // Nothing matched (wrong id or not owned by this user) — skip audit and
    // let the caller return 404. We must NOT throw here: unlike POST, DELETE has
    // no try/catch, so a throw would surface as an unhandled 500 instead of 404.
    if (!removed) return null;

    await writeAudit(
      {
        action: 'personal_bookmark.deleted',
        actor_id: session.user.id,
        resource_type: 'personalBookmark',
        resource_id: removed.id,
        meta_json: {},
      },
      tx,
    );

    return removed;
  });

  if (!deleted) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
});
