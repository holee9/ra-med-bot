// @MX:NOTE [AUTO] GET /api/ra/dashboard — aggregate dashboard stats.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-019)
// @MX:SPEC SPEC-REGULA-RELEASE-HARDENING-001 (TASK-001)
// Replaces the previous hardcoded stub with real Drizzle aggregates over
// source_sections (corpus size), conversations (RA chat sessions), and
// distinct active users in the last 7 days.

import { countDistinct, gte, sql } from 'drizzle-orm';
import { withPermission } from '../../../../lib/auth/with-permission';
import { db } from '../../../../lib/db/client';
import { conversations, sourceSections } from '../../../../lib/db/schema';

// Drizzle's count() helper returns a numeric/bigint that postgres-js may
// surface as either number or string. This coerces both shapes to a finite
// number, defaulting to 0 when the row or column is missing.
function toCount(rows: Array<{ count: number | string | null }> | undefined): number {
  if (!rows || rows.length === 0) return 0;
  const raw = rows[0]?.count;
  if (raw === null || raw === undefined) return 0;
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export const GET = withPermission('dashboard.view', async (_req, _ctx, session) => {
  // 7-day window for "recent" / "active" metrics.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Issue the four aggregate queries sequentially. They are independent but
  // small, and serial execution keeps the connection-pool footprint minimal.
  const totalDocsRows = await db.select({ count: sql<number>`count(*)` }).from(sourceSections);

  const totalSessionsRows = await db.select({ count: sql<number>`count(*)` }).from(conversations);

  const recentSessionsRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(conversations)
    .where(gte(conversations.createdAt, sevenDaysAgo));

  const activeUsersRows = await db
    .select({ count: countDistinct(conversations.userId) })
    .from(conversations)
    .where(gte(conversations.createdAt, sevenDaysAgo));

  return Response.json({
    orgId: session.user.organizationId,
    stats: {
      total_documents: toCount(totalDocsRows),
      total_sessions: toCount(totalSessionsRows),
      recent_sessions_7d: toCount(recentSessionsRows),
      active_users: toCount(activeUsersRows),
    },
  });
});
