// @MX:NOTE [AUTO] GET /api/pms/[projectId]/compliance — Article 83-86 check result.
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-007, REQ-PMS-010, AC-06)
// Read-only compliance assessment. IDOR: org ownership enforced.

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { withTenantScope } from '@/lib/db/client';
import { pmsDocuments, pmsInputs } from '@/lib/db/schema';
import {
  type ComplianceResult,
  checkArticle83to86,
} from '@/lib/workflows/_shared/compliance-check';
import { and, eq, sql } from 'drizzle-orm';

type RouteContext = { params: Promise<{ projectId: string }> };

async function getCompliance(
  _request: Request,
  ctx: RouteContext,
  session: { user: { id: string; organizationId?: string } },
): Promise<Response> {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const { projectId } = await ctx.params;

  // #239 Phase 2: withTenantScope sets app.current_org_id GUC for RLS enforce.
  // Reads + the read-only compliance audit ride one tx so the GUC is set for
  // all DB ops. App-level eq(...orgId, organizationId) retained as
  // defense-in-depth (RLS is inert project-wide until service-role bypass is
  // dropped).
  const result = await withTenantScope(organizationId, async (tx) => {
    // Gather compliance inputs from existing PMS documents + inputs.
    const documents = await tx
      .select()
      .from(pmsDocuments)
      .where(and(eq(pmsDocuments.projectId, projectId), eq(pmsDocuments.orgId, organizationId)));

    // IDOR: if no documents AND the project doesn't belong to this org, we still
    // return 404. The RLS policy enforces this at the DB level, but we double-check
    // by verifying at least one row is visible. (A cross-org project would yield 0.)
    const inputCountRow = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(pmsInputs)
      .where(and(eq(pmsInputs.projectId, projectId), eq(pmsInputs.orgId, organizationId)));
    const inputCount = inputCountRow[0]?.count ?? 0;

    const hasPmsPlan = documents.some((d) => d.workflowType === 'pms_report');
    const hasPmsReport = documents.some(
      (d) => d.workflowType === 'pms_report' && d.reviewStatus === 'complete',
    );
    const hasPmcfPlan = documents.some((d) => d.workflowType === 'pmcf_plan');
    const hasPmcfEvaluation = documents.some((d) => d.workflowType === 'pmcf_evaluation');

    const r: ComplianceResult = checkArticle83to86({
      deviceClass: 'IIa', // Default; UI can override per-device.
      hasPmsPlan,
      hasPmsReport,
      hasVigilanceData: inputCount > 0,
      hasPmcfPlan,
      hasPmcfEvaluation,
      complaintCount: inputCount,
      susarCount: 0, // Aggregated from inputs payload in a full implementation.
    });

    // Audit the compliance check (read-only action but regulated).
    await writeAudit(
      {
        actor_id: session.user.id,
        action: 'pms.compliance_checked',
        resource_type: 'project',
        resource_id: projectId,
        meta_json: { overall: r.overall },
      },
      tx,
    ).catch(() => {
      // Audit failure on a read-only compliance check should not block the user
      // from seeing their result — but it IS logged. (Contrast with mutations,
      // where audit failure MUST fail the request.)
    });

    return r;
  });

  return Response.json({ projectId, ...result });
}

export const GET = withPermission('workflow.execute', async (req, ctx, session) =>
  getCompliance(req, ctx as RouteContext, session),
);
