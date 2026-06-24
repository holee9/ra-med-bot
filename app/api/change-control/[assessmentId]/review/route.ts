// @MX:NOTE [AUTO] POST /api/change-control/[assessmentId]/review — expert review gate (REQ-009).
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-009, REQ-012, AC-07)
//
// REQ-009 server-side enforcement: AI verdicts are provisional until an
// RA-lead reviews and confirms. This route transitions status from
// 'provisional' → 'reviewed'. The UI gates this client-side, but this route
// enforces it server-side to prevent API-direct bypass (mirrors PMS close
// pattern in app/api/pms/[projectId]/documents/[documentId]/close/route.ts).

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { changeAssessments } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

type RouteContext = {
  params: Promise<{ assessmentId: string }>;
};

async function postReview(
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
  const rows = await db
    .select({
      id: changeAssessments.id,
      status: changeAssessments.status,
      projectId: changeAssessments.projectId,
      orgId: changeAssessments.orgId,
    })
    .from(changeAssessments)
    .where(and(eq(changeAssessments.id, assessmentId), eq(changeAssessments.orgId, organizationId)))
    .limit(1);

  if (rows.length === 0 || !rows[0]) {
    return Response.json({ error: 'Assessment not found' }, { status: 404 });
  }

  const assessment = rows[0];

  if (assessment.status !== 'provisional') {
    return Response.json(
      { error: 'already_reviewed', currentStatus: assessment.status },
      { status: 409 },
    );
  }

  // Transition provisional → reviewed inside a transaction so the audit
  // row rides the same boundary (21 CFR Part 11 atomicity — H2 pattern).
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(changeAssessments)
        .set({ status: 'reviewed', updatedAt: new Date() })
        .where(eq(changeAssessments.id, assessmentId));

      await writeAudit(
        {
          actor_id: session.user.id,
          action: 'change.assessment_reviewed',
          resource_type: 'changeAssessment',
          resource_id: assessmentId,
          meta_json: {
            projectId: assessment.projectId,
            previousStatus: 'provisional',
            newStatus: 'reviewed',
          },
        },
        tx,
      );
    });
  } catch (err) {
    console.error('change.assessment_reviewed failed (transaction rolled back)', err);
    return Response.json({ error: 'Failed to review assessment' }, { status: 500 });
  }

  return Response.json({ assessmentId, status: 'reviewed' }, { status: 200 });
}

export const POST = withPermission('change.assess', async (req, ctx, session) =>
  postReview(req, ctx as RouteContext, session),
);
