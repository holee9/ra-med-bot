// @MX:ANCHOR: [AUTO] resolveCerLinkage — auto-link same-project CER data for PMS report.
// @MX:REASON: fan_in >= 3: pms-report run route, cer-linkage unit test, integration test.
//           REQ-PMS-004 requires automatic CER linkage without manual user input.
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-004, AC-04)
// @MX:WARN [AUTO] DB query — injected db/client for testability. Returns null when
//           CER is absent (graceful, not an error).
// @MX:REASON Regulatory: missing CER must not block PMS draft creation (REQ-PMS-004 graceful).
//
// @MX:NOTE [AUTO] AUTO-LINKAGE ACTIVE (AC-04 / REQ-PMS-004):
//   CER runs are persisted to workflow_runs (workflowType='cer', projectId,
//   organizationId) by POST /api/ra/workflows/cer whenever the caller supplies a
//   projectId (CerInputSchema.projectId, SPEC-REGULA-CER-001 cross-SPEC change).
//   The auto-discovery query below therefore resolves in production. The result_json
//   shape persisted by the route is { cerRunId, deviceName, manufacturer,
//   intendedUse, literatureCount } — extractCerLinkageData tolerates this shape.
//
//   Manual cerData override (caller-provided) remains path 1 and skips the DB lookup.
//   When no projectId was supplied at CER creation (ephemeral run), or no CER run
//   exists yet for the project, this branch returns null (graceful — REQ-PMS-004).

import type { CerLinkageData } from '@/lib/workflows/pms-report/executor';

/**
 * Resolve CER linkage data from the same project's latest CER workflow run.
 *
 * REQ-PMS-004: PMS report automatically links CER data from the same project.
 * The caller passes an explicit cerData (manual override) OR null (auto-resolve).
 *
 * Lookup order:
 *   1. Manual override (caller-provided cerData) — returned as-is.
 *   2. workflow_runs WHERE workflow_type='cer' AND project_id=:projectId AND
 *      organization_id=:orgId, ordered by created_at DESC — extract
 *      device/intendedUse/riskProfile from result_json. ACTIVE in production:
 *      the CER route persists this row when a projectId is supplied.
 *   3. No CER found → return null (graceful; PMS draft still created, cerLinked=false).
 *
 * @param projectId - UUID of the PMS project.
 * @param orgId - UUID of the organization (RLS scope).
 * @param manualCerData - Caller-provided override; when non-null, returned without DB lookup.
 * @param dbClient - Drizzle client (injected for testability; defaults to real client).
 * @returns CerLinkageData when CER exists, null when absent.
 */
export async function resolveCerLinkage(
  projectId: string,
  orgId: string,
  manualCerData: CerLinkageData | null,
  dbClient?: {
    select: (fields?: unknown) => {
      from: (table: unknown) => {
        where: (condition: unknown) => {
          orderBy: (...cols: unknown[]) => {
            limit: (n: number) => Promise<Array<Record<string, unknown>>>;
          };
        };
      };
    };
  },
): Promise<CerLinkageData | null> {
  // Manual override — skip DB lookup entirely.
  if (manualCerData !== null) {
    return manualCerData;
  }

  // Lazy import to avoid circular deps in test environments where client is mocked.
  const db = dbClient ?? (await import('@/lib/db/client')).db;
  const { workflowRuns } = await import('@/lib/db/schema');
  const { and, desc, eq } = await import('drizzle-orm');

  try {
    const rows = await db
      .select({ id: workflowRuns.id, resultJson: workflowRuns.resultJson })
      .from(workflowRuns)
      .where(
        and(
          eq(workflowRuns.projectId, projectId),
          eq(workflowRuns.organizationId, orgId),
          eq(workflowRuns.workflowType, 'cer'),
        ),
      )
      .orderBy(desc(workflowRuns.createdAt))
      .limit(1);

    if (rows.length === 0 || !rows[0]) {
      return null;
    }

    const row = rows[0];
    const result = (row.resultJson ?? {}) as Record<string, unknown>;
    return extractCerLinkageData(String(row.id), result);
  } catch {
    // DB unavailable or query error — graceful degradation (REQ-PMS-004).
    return null;
  }
}

/**
 * Extract CerLinkageData fields from a CER workflow run result JSON.
 *
 * CER result shape varies across assembly versions, so we tolerate missing keys
 * by falling back to empty strings. The cerId is always the workflow run UUID.
 */
function extractCerLinkageData(cerId: string, result: Record<string, unknown>): CerLinkageData {
  // CER result may nest device info at top-level or under `device`/`deviceDescription`.
  const deviceBlock = (result.device ?? result.deviceDescription ?? result) as Record<
    string,
    unknown
  >;
  return {
    cerId,
    deviceName: String(deviceBlock.deviceName ?? deviceBlock.name ?? result.deviceName ?? ''),
    intendedUse: String(result.intendedUse ?? deviceBlock.intendedUse ?? ''),
    riskProfile: String(result.riskProfile ?? result.risk ?? deviceBlock.riskProfile ?? ''),
  };
}
