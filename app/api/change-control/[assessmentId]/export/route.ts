// @MX:NOTE [AUTO] POST /api/change-control/[assessmentId]/export — PDF report export with provisional gating.
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-007, REQ-011, REQ-012, AC-05, AC-07)
//
// REQ-011 server-side gating: provisional assessments CANNOT be exported
// (mirrors PMS close-route BLOCKING_REVIEW_STATUSES pattern). The UI gates
// this client-side, but this route enforces it server-side so an API-direct
// caller cannot bypass the expert review gate (REQ-009).
//
// REQ-007: exports a PDF report attachable to a DHF or change management system.
// MVP returns a structured JSON report (full PDF rendering is Phase 6+ — the
// frontend / external QMS can render from this canonical shape).

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { fetchLinkedRiskItems } from '@/lib/change-control/risk-linkage';
import { db } from '@/lib/db/client';
import { changeAssessments, changeVerdictCitations, changeVerdicts } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

type RouteContext = {
  params: Promise<{ assessmentId: string }>;
};

/** REQ-011: statuses that BLOCK export. */
const BLOCKING_STATUSES = new Set(['provisional']);

async function postExport(
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
    .select()
    .from(changeAssessments)
    .where(and(eq(changeAssessments.id, assessmentId), eq(changeAssessments.orgId, organizationId)))
    .limit(1);

  if (rows.length === 0 || !rows[0]) {
    return Response.json({ error: 'Assessment not found' }, { status: 404 });
  }

  const assessment = rows[0];

  // REQ-011 AC-07: server-side expert-review gating.
  // H-4: the denial uses change.export_blocked (NOT change.verdict_citation_rejected)
  // so audit consumers can distinguish REQ-009/011 provisional-export denial
  // from REQ-006 citation rejection.
  if (BLOCKING_STATUSES.has(assessment.status)) {
    try {
      await db.transaction(async (tx) => {
        await writeAudit(
          {
            actor_id: session.user.id,
            action: 'change.export_blocked',
            resource_type: 'changeAssessment',
            resource_id: assessmentId,
            meta_json: {
              projectId: assessment.projectId,
              status: assessment.status,
              reason: 'provisional_export_blocked',
            },
          },
          tx,
        );
      });
    } catch (err) {
      console.error('change.export_blocked audit failed', err);
      return Response.json({ error: 'Failed to record export-block audit' }, { status: 500 });
    }
    return Response.json(
      {
        error: 'Expert review required',
        code: 'review_required',
        status: assessment.status,
        message: '이 평가는 전문가 검토 완료 전까지 export할 수 없습니다. (REQ-009/REQ-011)',
      },
      { status: 403 },
    );
  }

  // Reviewed/final — assemble the canonical report shape and audit the export.
  const verdictRows = await db
    .select()
    .from(changeVerdicts)
    .where(eq(changeVerdicts.assessmentId, assessmentId));

  const verdictsWithCitations = await Promise.all(
    verdictRows.map(async (v) => {
      const citations = await db
        .select()
        .from(changeVerdictCitations)
        .where(eq(changeVerdictCitations.verdictId, v.id));
      return { ...v, citations };
    }),
  );

  const riskLinks = await fetchLinkedRiskItems(assessmentId, organizationId);

  try {
    await db.transaction(async (tx) => {
      await writeAudit(
        {
          actor_id: session.user.id,
          action: 'change.report_exported',
          resource_type: 'changeAssessment',
          resource_id: assessmentId,
          meta_json: {
            projectId: assessment.projectId,
            status: assessment.status,
            verdictCount: verdictsWithCitations.length,
            riskLinkCount: riskLinks.length,
            modelVersion: assessment.modelVersion,
            promptVersion: assessment.promptVersion,
            templateVersion: assessment.templateVersion,
          },
        },
        tx,
      );
    });
  } catch (err) {
    console.error('change.report_exported audit failed', err);
    return Response.json({ error: 'Failed to record export audit' }, { status: 500 });
  }

  // Canonical report shape. Frontend / QMS renders the PDF from this.
  return Response.json(
    {
      assessment,
      verdicts: verdictsWithCitations,
      riskLinks,
      exportedAt: new Date().toISOString(),
      format: 'pdf-json',
      // @MX:TODO full PDF byte stream wiring (puppeteer/pdf-lib) — Phase 6+.
      // The JSON shape above is the single source of truth for the renderer.
    },
    { status: 200 },
  );
}

export const POST = withPermission('change.export', async (req, ctx, session) =>
  postExport(req, ctx as RouteContext, session),
);
