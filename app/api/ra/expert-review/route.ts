// @MX:ANCHOR [AUTO] Expert Review Route — POST (create) + GET (list)
// @MX:REASON Public API boundary for expert review creation and listing.
// Called from T-006 expert review queue, UI badge polling, and gating layer.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-001..005)

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { expertReviews } from '@/lib/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
const CreateSchema = z.object({
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
  reason: z.string().min(1),
});

// POST /api/ra/expert-review — create a new expert review request.
export const POST = withPermission('expertReview.create', async (req, _ctx, session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { conversationId, messageId, reason } = parsed.data;

  const [record] = await db
    .insert(expertReviews)
    .values({
      conversationId,
      messageId,
      requestedBy: session.user.id,
      status: 'pending',
      notes: reason,
    })
    .onConflictDoNothing()
    .returning();

  // If conflict (duplicate), return 201 without re-writing audit
  if (!record) {
    // Idempotent — return empty body with 201
    return Response.json({ message: 'already_exists' }, { status: 201 });
  }

  await writeAudit({
    action: 'expert_review.flag',
    actor_id: session.user.id,
    resource_type: 'message',
    resource_id: messageId,
    meta_json: { reason, trigger: 'manual' },
  });

  return Response.json(record, { status: 201 });
});

// GET /api/ra/expert-review — paginated list.
export const GET = withPermission('expertReview.view', async (req, _ctx, _session) => {
  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status') ?? undefined;
  const limitParam = Math.min(Number(url.searchParams.get('limit') ?? '20'), 100);
  const offsetParam = Number(url.searchParams.get('offset') ?? '0');

  const limit = Number.isNaN(limitParam) || limitParam <= 0 ? 20 : limitParam;
  const offset = Number.isNaN(offsetParam) || offsetParam < 0 ? 0 : offsetParam;

  // Build where clause
  const whereClause = statusParam
    ? eq(expertReviews.status, statusParam as 'pending' | 'in_progress' | 'resolved')
    : undefined;

  const rows = await db
    .select()
    .from(expertReviews)
    .where(whereClause)
    .orderBy(desc(expertReviews.createdAt))
    .limit(limit)
    .offset(offset);

  // Count total
  const [countRow] = await db
    .select({ total: sql<number>`cast(count(*) as integer)` })
    .from(expertReviews)
    .where(whereClause);

  return Response.json({
    data: rows,
    total: countRow?.total ?? 0,
    limit,
    offset,
  });
});
