// @MX:NOTE [AUTO] GET /api/change-control/[assessmentId] — fetch assessment + verdicts + citations + risk links.
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-004, REQ-006, REQ-008, REQ-011, AC-03, AC-06)
//
// IDOR defense: org_id scope in the WHERE clause (mirrors PMS close route).
// Cross-org lookups return 404 (NOT 403) to avoid leaking existence.

import { withPermission } from '@/lib/auth/with-permission';
import { fetchLinkedRiskItems } from '@/lib/change-control/risk-linkage';
import { db } from '@/lib/db/client';
import { changeAssessments, changeVerdictCitations, changeVerdicts } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

type RouteContext = {
  params: Promise<{ assessmentId: string }>;
};

async function getAssessment(
  _request: Request,
  ctx: RouteContext,
  session: { user: { id: string; organizationId?: string } },
): Promise<Response> {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const { assessmentId } = await ctx.params;

  // Fetch the assessment with org scope (IDOR protection).
  const assessmentRows = await db
    .select()
    .from(changeAssessments)
    .where(and(eq(changeAssessments.id, assessmentId), eq(changeAssessments.orgId, organizationId)))
    .limit(1);

  if (assessmentRows.length === 0 || !assessmentRows[0]) {
    return Response.json({ error: 'Assessment not found' }, { status: 404 });
  }
  const assessment = assessmentRows[0];

  // Fetch verdicts.
  const verdictRows = await db
    .select()
    .from(changeVerdicts)
    .where(eq(changeVerdicts.assessmentId, assessmentId));

  // Fetch citations per verdict in a single pass.
  const verdictsWithCitations = await Promise.all(
    verdictRows.map(async (v) => {
      const citations = await db
        .select()
        .from(changeVerdictCitations)
        .where(eq(changeVerdictCitations.verdictId, v.id));
      return { ...v, citations };
    }),
  );

  // REQ-008: linked risk_items for re-evaluation panel (AC-06).
  const riskLinks = await fetchLinkedRiskItems(assessmentId, organizationId);

  return Response.json(
    {
      assessment,
      verdicts: verdictsWithCitations,
      riskLinks,
      // REQ-011: provisional flag exposed for frontend gating.
      isProvisional: assessment.status === 'provisional',
    },
    { status: 200 },
  );
}

export const GET = withPermission('change.view', async (req, ctx, session) =>
  getAssessment(req, ctx as RouteContext, session),
);
