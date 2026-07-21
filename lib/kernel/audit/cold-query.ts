// @MX:NOTE [AUTO] Audit cold storage query — reads from R2 cold archive.
// @MX:SPEC SPEC-REGULA-CLOUDFLARE-001 (REQ-CF-049, REQ-CF-051)
//
// Admin-only (RBAC via with-permission.ts at the API layer).
// Writes meta-audit entry on every cold query (REQ-CF-051).

import type { R2Client } from '../storage/r2';

export interface ColdQueryFilters {
  dateRange: { from: Date; to: Date };
  action?: string;
  actorId?: string;
}

// Minimal audit row shape returned from cold storage
export interface ColdAuditRow {
  id: string;
  action: string;
  actor_id?: string | null;
  org_id?: string | null;
  conversation_id?: string | null;
  request_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  archived_at: string;
}

// Minimal writeAudit signature (matches lib/audit.ts writeAudit)
export interface WriteAuditParams {
  action: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Queries audit logs from R2 cold storage.
 *
 * REQ-CF-049: Results have same shape as Neon audit_logs rows.
 * REQ-CF-051: Every cold query MUST emit a meta-audit entry.
 *
 * @param r2Client - R2Client wrapping AUDIT_COLD bucket
 * @param filters - Date range and optional field filters
 * @param writeAudit - writeAudit function from lib/audit.ts (injected to avoid circular dep)
 */
export async function queryColdAudit(
  r2Client: R2Client,
  filters: Partial<ColdQueryFilters> & { dateRange?: { from: Date; to: Date } },
  writeAudit: (params: WriteAuditParams) => Promise<void>,
): Promise<ColdAuditRow[]> {
  const { dateRange, action, actorId } = {
    action: undefined,
    actorId: undefined,
    ...filters,
  };

  // REQ-CF-051: write meta-audit BEFORE accessing data (fail-open logging).
  await writeAudit({
    action: 'audit.cold_query',
    metadata: {
      dateRange: dateRange
        ? { from: dateRange.from.toISOString(), to: dateRange.to.toISOString() }
        : undefined,
      filterAction: action,
      filterActorId: actorId,
    },
  });

  // List R2 objects matching the date range prefix
  const prefix = 'audit-cold/';
  const listResult = await r2Client.list({ prefix });

  const rows: ColdAuditRow[] = [];

  for (const obj of listResult.objects) {
    // Skip checksum files
    if (obj.key.endsWith('.sha256')) continue;

    const body = await r2Client.get(obj.key);
    if (!body) continue;

    const text = await (body as { text: () => Promise<string> }).text();
    const batch: ColdAuditRow[] = JSON.parse(text);

    for (const row of batch) {
      // Apply date range filter
      if (dateRange) {
        const ts = new Date(row.created_at);
        if (ts < dateRange.from || ts > dateRange.to) continue;
      }

      // Apply action filter
      if (action && row.action !== action) continue;

      // Apply actorId filter
      if (actorId && row.actor_id !== actorId) continue;

      rows.push(row);
    }
  }

  return rows;
}
