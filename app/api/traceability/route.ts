// @MX:NOTE [AUTO] GET /api/traceability — per-project evidence matrix.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-004, REQ-TRACEABILITY-005, REQ-TRACEABILITY-006, REQ-TRACEABILITY-012)
//
// Local evidence-graph namespace — STRICTLY separate from Issue #169's
// /api/ra/traceability/* BFF proxy (which delegates to hybrid-ra-saas).

import { writeAudit } from '@/lib/kernel/audit';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { withTenantScope } from '@/lib/kernel/db/client';
import { buildMatrix } from '@/lib/traceability/matrix';
import { listStaleNodeIds } from '@/lib/traceability/stale-propagation';
import { z } from 'zod';

const MatrixQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  jurisdiction: z.string().max(64).optional(),
  product: z.string().max(128).optional(),
  packageId: z.string().uuid().optional(),
  riskLevel: z.enum(['acceptable', 'alarp', 'unacceptable', 'unacc']).optional(),
  stale: z.enum(['only', 'exclude']).optional(),
});

export const GET = withPermission('traceability.view', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const parsed = MatrixQuerySchema.safeParse(params);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid query', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // #239 Phase 2: withTenantScope sets app.current_org_id GUC for RLS enforce.
  // listStaleNodeIds + buildMatrix issue org-scoped reads via the passed handle;
  // wrapping them sets the GUC so Phase 3 FORCE RLS will enforce isolation.
  const result = await withTenantScope(organizationId, async (dbs) => {
    const staleNodeIds = await listStaleNodeIds(dbs, organizationId);
    return buildMatrix(dbs, { ...parsed.data, orgId: organizationId }, { staleNodeIds });
  });

  // Read-only view — no edge mutation, so we audit only at trace.debug granularity.
  // Keep the audit row minimal (non-PII) and scoped to the project.
  await writeAudit({
    actor_id: session.user.id,
    action: 'traceability.matrix_viewed', // matrix-specific read audit — distinct from dashboard.view for Part 11 clarity
    resource_type: 'traceability',
    resource_id: parsed.data.projectId ?? organizationId,
    meta_json: {
      scope: 'matrix',
      totalRows: result.summary.totalRows,
      withGaps: result.summary.withGaps,
      stale: result.summary.stale,
    },
  });

  return Response.json(result);
});
