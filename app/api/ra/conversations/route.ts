// @MX:NOTE [AUTO] GET /api/ra/conversations — list conversations for the authenticated user.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-019)

import { eq } from 'drizzle-orm';
import { withPermission } from '../../../../lib/auth/with-permission';
import { db } from '../../../../lib/db/client';
import { conversations } from '../../../../lib/db/schema';

export const GET = withPermission('conversation.view', async (_req, _ctx, session) => {
  const rows = await db
    .select({
      id: conversations.id,
      projectId: conversations.projectId,
      title: conversations.title,
      status: conversations.status,
      createdAt: conversations.createdAt,
    })
    .from(conversations)
    .where(eq(conversations.userId, session.user.id))
    .orderBy(conversations.createdAt);

  return Response.json({ conversations: rows });
});
