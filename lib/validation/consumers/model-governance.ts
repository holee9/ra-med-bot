// @MX:NOTE [AUTO] Consumer wrapper for model-governance change_request queries (REQ-MODELGOV-004/005).
// @MX:SPEC SPEC-REGULA-VALIDATION-002 (M0)

import type { Database } from '@/lib/db/client';
import { changeRequest } from '@/lib/db/schema';
import { and, eq, gte, lt } from 'drizzle-orm';

/**
 * Row shape returned by change_request window query.
 */
export interface ChangeRequestRow {
  id: string;
  promptId: string | null;
  modelPinId: string | null;
  evalRunId: string | null;
  evalResultRef: string | null;
  approvalStatus: string;
  approvedAt: Date | null;
  createdAt: Date;
}

/**
 * Fetch change_requests within a time window for an organization.
 *
 * REQ-MODELGOV-005: Window-scoped query for evaluation metrics.
 * Defense-in-depth: Explicit WHERE org_id = $1 AND created_at >= $2 AND created_at < $3
 * (RLS also enforces org scope, but the explicit filter keeps the query planner honest).
 *
 * @param params.orgId - Organization to scope (required)
 * @param params.windowStart - Inclusive start of window (ISO date or Date)
 * @param params.windowEnd - Exclusive end of window (ISO date or Date)
 * @returns Array of change_request rows with selected columns
 */
export async function fetchWindowScopedChangeRequests(params: {
  orgId: string;
  windowStart: Date;
  windowEnd: Date;
}): Promise<ChangeRequestRow[]> {
  const { db } = await import('@/lib/db/client');
  const rows = await db
    .select({
      id: changeRequest.id,
      promptId: changeRequest.promptId,
      modelPinId: changeRequest.modelPinId,
      evalRunId: changeRequest.evalRunId,
      evalResultRef: changeRequest.evalResultRef,
      approvalStatus: changeRequest.approvalStatus,
      approvedAt: changeRequest.approvedAt,
      createdAt: changeRequest.createdAt,
    })
    .from(changeRequest)
    .where(
      and(
        eq(changeRequest.orgId, params.orgId),
        gte(changeRequest.createdAt, params.windowStart),
        lt(changeRequest.createdAt, params.windowEnd),
      ),
    );

  return rows;
}
