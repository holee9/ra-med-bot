// GET /api/admin/radar/health — public health check for radar pipeline.
// @MX:SPEC SPEC-REGULA-RADAR-001
// This endpoint is intentionally unauthenticated for uptime monitoring.

import { desc, gte, sql } from 'drizzle-orm';
import { withPermission } from '../../../../../lib/auth/with-permission';
import { db } from '../../../../../lib/db/client';
import { crawlerRuns, regulatoryUpdates } from '../../../../../lib/db/schema';

export const GET = withPermission('rbac.manage', async (): Promise<Response> => {
  try {
    const [lastRun] = await db
      .select({
        crawlerName: crawlerRuns.crawlerName,
        startedAt: crawlerRuns.startedAt,
        status: crawlerRuns.status,
      })
      .from(crawlerRuns)
      .orderBy(desc(crawlerRuns.startedAt))
      .limit(1);

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(regulatoryUpdates)
      .where(gte(regulatoryUpdates.publishedAt, cutoff));

    const count = countRows[0]?.count ?? 0;

    return Response.json({
      status: 'ok',
      last_crawler_run: lastRun ?? null,
      updates_last_24h: Number(count),
    });
  } catch (err) {
    return Response.json({ status: 'error', error: String(err) }, { status: 500 });
  }
});
