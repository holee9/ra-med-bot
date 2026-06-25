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
import { withTenantScope } from '@/lib/db/client';
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

  // #239 Phase 2: withTenantScope sets app.current_org_id GUC for RLS enforce.
  // SELECT + both paths (block-audit / close-update+audit) run inside the same
  // tenant scope so every DB op sees the GUC. App-level eq(...orgId, organizationId)
  // retained as defense-in-depth (RLS is inert project-wide until service-role
  // bypass is dropped).
  type Outcome =
    | { kind: 'not_found' }
    | { kind: 'blocked'; reviewStatus: string; workflowType: string }
    | { kind: 'closed' };
  let outcome: Outcome;
  try {
    outcome = await withTenantScope(organizationId, async (tx) => {
      // Fetch the document with org+project RLS scope (IDOR protection).
      const rows = await tx
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
        return { kind: 'not_found' as const };
      }

      const doc = rows[0];

      // REQ-PMS-009 AC-07: server-side expert-review gating.
      if (BLOCKING_REVIEW_STATUSES.has(doc.reviewStatus)) {
        await writeAudit(
          {
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
          },
          tx,
        );
        return {
          kind: 'blocked' as const,
          reviewStatus: doc.reviewStatus,
          workflowType: doc.workflowType,
        };
      }

      // Reviewed — transition to 'closed' and audit the close action.
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
      return { kind: 'closed' as const };
    });
  } catch (err) {
    console.error('pms.report_closed failed (transaction rolled back)', err);
    return Response.json({ error: 'Failed to close document' }, { status: 500 });
  }

  switch (outcome.kind) {
    case 'not_found':
      return Response.json({ error: 'Document not found' }, { status: 404 });
    case 'blocked':
      return Response.json(
        {
          error: 'Expert review required',
          code: 'review_required',
          reviewStatus: outcome.reviewStatus,
          message: '이 문서는 전문가 검토 완료 전까지 close/export할 수 없습니다. (REQ-PMS-009)',
        },
        { status: 403 },
      );
    case 'closed':
      return Response.json(
        { documentId, status: 'closed', reviewStatus: 'closed' },
        { status: 200 },
      );
  }
}

export const POST = withPermission('workflow.execute', async (req, ctx, session) =>
  postClose(req, ctx as RouteContext, session),
);
