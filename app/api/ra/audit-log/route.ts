// @MX:ANCHOR [AUTO] Audit log route — GET /api/ra/audit-log (auditor read-only).
// @MX:REASON External inspector entry point to the audit trail. Paginated + filterable
//            per AC #7. Read-only by RBAC (audit.read permission; auditor role is
//            write-blocked centrally in withPermission).
// @MX:SPEC SPEC-REGULA-AUDITOR-VIEW-001 (AC #1, #7)

export const runtime = 'nodejs';

import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { auditLogs, users } from '@/lib/db/schema';
import { and, desc, eq, gte, lte } from 'drizzle-orm';

const PAGE_SIZE = 50;

interface ListQuery {
  page: number;
  pageSize: number;
  fromDate: string | null;
  toDate: string | null;
  action: string | null;
  actorId: string | null;
}

function parseQuery(url: URL): ListQuery | null {
  const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
  const pageSizeRaw = Number.parseInt(url.searchParams.get('pageSize') ?? String(PAGE_SIZE), 10);

  if (!Number.isFinite(pageRaw) || pageRaw < 1) return null;
  // Cap pageSize so an auditor cannot demand unbounded result sets.
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(pageSizeRaw, PAGE_SIZE) : PAGE_SIZE;

  return {
    page: pageRaw,
    pageSize,
    fromDate: url.searchParams.get('fromDate'),
    toDate: url.searchParams.get('toDate'),
    action: url.searchParams.get('action'),
    actorId: url.searchParams.get('actorId'),
  };
}

export const GET = withPermission('audit.read', async (req) => {
  const url = new URL(req.url);
  const query = parseQuery(url);
  if (!query) {
    return Response.json({ error: 'invalid_pagination' }, { status: 400 });
  }

  const filters = [];
  if (query.fromDate) filters.push(gte(auditLogs.createdAt, new Date(query.fromDate)));
  if (query.toDate) filters.push(lte(auditLogs.createdAt, new Date(query.toDate)));
  if (query.action) filters.push(eq(auditLogs.action, query.action as never));
  if (query.actorId) filters.push(eq(auditLogs.actorId, query.actorId));

  const rows = await db
    .select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      action: auditLogs.action,
      actorId: auditLogs.actorId,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      metaJson: auditLogs.metaJson,
      actorEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  const out = rows.map((r) => {
    const meta = (r.metaJson ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      timestamp: r.createdAt.toISOString(),
      action: r.action,
      actorId: r.actorId,
      actorEmail: r.actorEmail ?? null,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      outcome: typeof meta.outcome === 'string' ? meta.outcome : 'success',
    };
  });

  return Response.json({
    rows: out,
    page: query.page,
    pageSize: query.pageSize,
  });
});
