// @MX:NOTE [AUTO] Consumer wrapper for traceability matrix aggregation (REQ-TRACEABILITY-004/005/006).
// @MX:SPEC SPEC-REGULA-VALIDATION-002 (M0)

import { buildMatrix } from '@/lib/traceability/matrix';
import type { MatrixFilters, MatrixResult } from '@/lib/traceability/matrix';
import { listStaleNodeIds } from '@/lib/traceability/stale-propagation';

/**
 * Summary statistics from the traceability matrix.
 */
export interface MatrixSummary {
  totalRows: number;
  withGaps: number;
  stale: number;
}

/**
 * Capture a snapshot of the traceability matrix for an organization (optionally scoped to a project).
 *
 * Follows the pattern from app/api/traceability/route.ts:
 * 1. Collect stale node IDs via listStaleNodeIds (org-scoped).
 * 2. Build the matrix with orgId + optional projectId filter.
 * 3. Extract and return the summary statistics.
 *
 * @param params.orgId - Organization to scope (required)
 * @param params.projectId - Optional project filter for narrower scope
 * @returns Matrix summary with totalRows, withGaps, and stale counts
 */
export async function snapshotTraceability(params: {
  orgId: string;
  projectId?: string;
}): Promise<MatrixSummary> {
  const { db } = await import('@/lib/kernel/db/client');

  // Collect stale node IDs (required dependency for buildMatrix).
  const staleNodeIds = await listStaleNodeIds(db, params.orgId);

  // Build matrix with org-scoped filters.
  const filters: MatrixFilters = {
    orgId: params.orgId,
    projectId: params.projectId,
  };
  const result: MatrixResult = await buildMatrix(db, filters, { staleNodeIds });

  // Extract and return summary.
  return result.summary;
}
