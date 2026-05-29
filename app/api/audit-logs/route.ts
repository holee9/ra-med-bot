// @MX:ANCHOR [AUTO] GET /api/audit-logs — 21 CFR Part 11 audit log read endpoint
// @MX:REASON Public API boundary for audit log access; requires ra-lead role.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-FND-044, REQ-LAUNCH-020)

export const runtime = 'nodejs';

import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { auditLogs } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export const GET = withPermission('auditLogs.view', async (req, _ctx, _session) => {
  const url = new URL(req.url);
  const limitParam = Math.min(Number(url.searchParams.get('limit') ?? '20'), 100);
  const offsetParam = Number(url.searchParams.get('offset') ?? '0');

  const limit = Number.isNaN(limitParam) || limitParam <= 0 ? 20 : limitParam;
  const offset = Number.isNaN(offsetParam) || offsetParam < 0 ? 0 : offsetParam;

  const rows = await db
    .select({
      id: auditLogs.id,
      userId: auditLogs.actorId,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      conversationId: auditLogs.conversationId,
      metaJson: auditLogs.metaJson,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return Response.json({ data: rows, limit, offset });
});
