// GET /api/admin/radar/runs — crawler_runs status list (admin only).
// @MX:SPEC SPEC-REGULA-RADAR-001

import { desc } from 'drizzle-orm';
import { withPermission } from '../../../../../lib/auth/with-permission';
import { db } from '../../../../../lib/db/client';
import { crawlerRuns } from '../../../../../lib/db/schema';

export const GET = withPermission(
  'dashboard.view',
  async (_req, _ctx, session) => {
    if (session.user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const rows = await db
      .select({
        id: crawlerRuns.id,
        crawlerName: crawlerRuns.crawlerName,
        startedAt: crawlerRuns.startedAt,
        completedAt: crawlerRuns.completedAt,
        status: crawlerRuns.status,
        recordsAdded: crawlerRuns.recordsAdded,
        errorsJson: crawlerRuns.errorsJson,
      })
      .from(crawlerRuns)
      .orderBy(desc(crawlerRuns.startedAt))
      .limit(100);

    return Response.json({ runs: rows });
  },
);
