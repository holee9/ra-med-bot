// @MX:NOTE [AUTO] POST /api/pms/[projectId]/documents/[documentId]/close — finalize PMS/PMCF document.
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-009, REQ-PMS-010, AC-07)
//
// AC-07 / REQ-PMS-009 server-side expert-review gating:
//   Documents with review_status='draft' or 'pending_review' CANNOT be closed
//   (finalized for export). The UI (CompliancePanel/PmsReportWizard) already
//   gates this client-side, but this route enforces it server-side to prevent
//   API-direct bypass. Returns 403 when unreviewed.
//
// YAGNI: This is the minimal close mechanism. A full export system is Phase 6+.

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { pmsDocuments } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

type RouteContext = {
  params: Promise<{ projectId: string; documentId: string }>;
};

/** Review statuses that BLOCK document close/export (REQ-PMS-009). */
const BLOCKING_REVIEW_STATUSES = new Set(['draft', 'pending_review']);

async function postClose(
  _request: Request,
  ctx: RouteContext,
  session: { user: { id: string; organizationId?: string } },
): Promise<Response> {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const { projectId, documentId } = await ctx.params;

  // Fetch the document with org+project RLS scope (IDOR protection).
  const rows = await db
    .select({
      id: pmsDocuments.id,
      reviewStatus: pmsDocuments.reviewStatus,
      workflowType: pmsDocuments.workflowType,
      orgId: pmsDocuments.orgId,
      projectId: pmsDocuments.projectId,
    })
    .from(pmsDocuments)
    .where(
      and(
        eq(pmsDocuments.id, documentId),
        eq(pmsDocuments.projectId, projectId),
        eq(pmsDocuments.orgId, organizationId),
      ),
    )
    .limit(1);

  if (rows.length === 0 || !rows[0]) {
    // Not found OR cross-org (RLS-scoped query returns empty). 404, not 403,
    // to avoid leaking existence of cross-org documents.
    return Response.json({ error: 'Document not found' }, { status: 404 });
  }

  const doc = rows[0];

  // REQ-PMS-009 AC-07: server-side expert-review gating.
  if (BLOCKING_REVIEW_STATUSES.has(doc.reviewStatus)) {
    await writeAudit({
      actor_id: session.user.id,
      action: 'pms.report_export_denied',
      resource_type: 'pms_document',
      resource_id: documentId,
      meta_json: {
        projectId,
        workflowType: doc.workflowType,
        reviewStatus: doc.reviewStatus,
        reason: 'expert_review_required',
      },
    });
    return Response.json(
      {
        error: 'Expert review required',
        code: 'review_required',
        reviewStatus: doc.reviewStatus,
        message: '이 문서는 전문가 검토 완료 전까지 close/export할 수 없습니다. (REQ-PMS-009)',
      },
      { status: 403 },
    );
  }

  // Reviewed — transition to 'closed' and audit the close action.
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(pmsDocuments)
        .set({ reviewStatus: 'closed', updatedAt: new Date() })
        .where(eq(pmsDocuments.id, documentId));

      await writeAudit(
        {
          actor_id: session.user.id,
          action: 'pms.report_closed',
          resource_type: 'pms_document',
          resource_id: documentId,
          meta_json: {
            projectId,
            workflowType: doc.workflowType,
            previousReviewStatus: doc.reviewStatus,
          },
        },
        tx,
      );
    });
  } catch (err) {
    console.error('pms.report_closed failed (transaction rolled back)', err);
    return Response.json({ error: 'Failed to close document' }, { status: 500 });
  }

  return Response.json({ documentId, status: 'closed', reviewStatus: 'closed' }, { status: 200 });
}

export const POST = withPermission('workflow.execute', async (req, ctx, session) =>
  postClose(req, ctx as RouteContext, session),
);
