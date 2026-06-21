// @MX:NOTE [AUTO] GET /api/ra/personal/tags — distinct tags for the current user.
// @MX:SPEC SPEC-REGULA-PERSONAL-LIB-001 (REQ-PERSONAL-003, Issue #86)
//
// Returns the set of distinct tags the session user has applied to any bookmark.
// Used by the library view to render filter chips.

import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { personalBookmarks } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const GET = withPermission('personal.view', async (_req, _ctx, session) => {
  const rows = await db
    .select({
      tag: sql<string>`unnest(${personalBookmarks.tags})`.as('tag'),
    })
    .from(personalBookmarks)
    .where(eq(personalBookmarks.userId, session.user.id));

  const tagSet = new Set<string>();
  for (const r of rows) {
    if (r.tag) tagSet.add(r.tag);
  }

  const tags = [...tagSet].sort((a, b) => a.localeCompare(b));
  return NextResponse.json({ tags });
});
