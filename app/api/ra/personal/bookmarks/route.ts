// @MX:NOTE [AUTO] GET/POST /api/ra/personal/bookmarks — user-scoped bookmark list + create.
// @MX:SPEC SPEC-REGULA-PERSONAL-LIB-001 (REQ-PERSONAL-001..004, Issue #86)
//
// Privacy invariant (REQ-PERSONAL-002): every query filters by session.user.id.
// No user can list, create-for, or infer the existence of another user's bookmarks.

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { personalBookmarks } from '@/lib/db/schema';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const CreateSchema = z.object({
  messageId: z.string().uuid(),
  blockId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500),
  customTitle: z.string().max(500).nullable().optional(),
  note: z.string().max(5000).optional(),
  tags: z.array(z.string().min(1).max(50)).max(10).optional(),
});

// GET /api/ra/personal/bookmarks?tag=foo&q=bar&limit=50
export const GET = withPermission('personal.view', async (req, _ctx, session) => {
  const url = new URL(req.url);
  const tag = url.searchParams.get('tag')?.trim();
  const q = url.searchParams.get('q')?.trim();
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);

  const conditions = [eq(personalBookmarks.userId, session.user.id)];

  if (tag) {
    // Array-overlap (PostgreSQL &&): a bookmark matches if its tags contain the requested tag.
    conditions.push(sql`${personalBookmarks.tags} && ARRAY[${tag}]::text[]`);
  }

  if (q) {
    const pattern = `%${q}%`;
    const searchCond = or(
      ilike(personalBookmarks.title, pattern),
      ilike(personalBookmarks.customTitle, pattern),
      ilike(personalBookmarks.note, pattern),
      // tags array ILIKE: cast to text and match.
      ilike(sql`${personalBookmarks.tags}::text`, pattern),
    );
    if (searchCond) conditions.push(searchCond);
  }

  const rows = await db
    .select({
      id: personalBookmarks.id,
      messageId: personalBookmarks.messageId,
      blockId: personalBookmarks.blockId,
      title: personalBookmarks.title,
      customTitle: personalBookmarks.customTitle,
      note: personalBookmarks.note,
      tags: personalBookmarks.tags,
      createdAt: personalBookmarks.createdAt,
      updatedAt: personalBookmarks.updatedAt,
    })
    .from(personalBookmarks)
    .where(and(...conditions))
    .orderBy(desc(personalBookmarks.createdAt))
    .limit(limit);

  return NextResponse.json({ bookmarks: rows, count: rows.length });
});

// POST /api/ra/personal/bookmarks
export const POST = withPermission('personal.view', async (req, _ctx, session) => {
  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { messageId, blockId, title, customTitle, note, tags } = parsed.data;

  try {
    const [created] = await db
      .insert(personalBookmarks)
      .values({
        userId: session.user.id,
        messageId,
        blockId: blockId ?? null,
        title,
        customTitle: customTitle ?? null,
        note: note ?? '',
        tags: tags ?? [],
      })
      .returning({ id: personalBookmarks.id, createdAt: personalBookmarks.createdAt });

    if (!created) {
      return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
    }

    await writeAudit({
      action: 'personal_bookmark.created',
      actor_id: session.user.id,
      resource_type: 'personalBookmark',
      resource_id: created.id,
      meta_json: { messageId, blockId: blockId ?? null, tagCount: tags?.length ?? 0 },
    });

    return NextResponse.json({ bookmark: created }, { status: 201 });
  } catch (err: unknown) {
    // Unique-index violation: duplicate (user, message, block) bookmark → 409.
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return NextResponse.json({ error: 'duplicate_bookmark' }, { status: 409 });
    }
    throw err;
  }
});
