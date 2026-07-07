// @MX:NOTE [AUTO] POST /api/change-control/[assessmentId]/export — PDF report export with provisional gating.
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-007, REQ-011, REQ-012, AC-05, AC-07)

// @MX:LEGACY archived from app
//
// REQ-011 server-side gating: provisional assessments CANNOT be exported
// (mirrors PMS close-route BLOCKING_REVIEW_STATUSES pattern). The UI gates
// this client-side, but this route enforces it server-side so an API-direct
// caller cannot bypass the expert review gate (REQ-009).
//
// REQ-007: exports a PDF report attachable to a DHF or change management system.
// Two formats are supported via the `?format=` search param:
//   - format=pdf-json (default): canonical JSON shape, consumed by the frontend
//     and external QMS integrations. Backward compatible.
//   - format=pdf: real PDF byte stream (Content-Type: application/pdf) rendered
//     from the same canonical shape via @react-pdf/renderer (AC-05).

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import {
  exportChangeAssessmentToPdf,
  getChangePdfFilename,
} from '@/lib/change-control/exporters/pdf';
import { fetchLinkedRiskItems } from '@/lib/change-control/risk-linkage';
import { withTenantScope } from '@/lib/db/client';
import { changeAssessments, changeVerdictCitations, changeVerdicts } from '@/lib/db/schema';
import { sanitizeFilename } from '@/lib/traceability/export-packet';
import { and, eq } from 'drizzle-orm';

type RouteContext = {
  params: Promise<{ assessmentId: string }>;
};

/** REQ-011: statuses that BLOCK export. */
const BLOCKING_STATUSES = new Set(['provisional']);

async function postExport(
  request: Request,
  ctx: RouteContext,
  session: { user: { id: string; organizationId?: string } },
): Promise<Response> {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const { assessmentId } = await ctx.params;

  // #239 Phase 2: withTenantScope sets app.current_org_id GUC for RLS enforce.
  // Each DB cluster below (initial SELECT, block-path audit, verdict/citation
  // reads, export audit, corpus.export_blocked audit) runs inside its own
  // withTenantScope so the GUC is set without holding one long tx across PDF
  // rendering. App-level eq(changeAssessments.orgId, organizationId) retained
  // as defense-in-depth (RLS is inert project-wide until service-role bypass
  // is dropped).

  // Fetch the assessment with org scope (IDOR protection).
  const rows = await withTenantScope(organizationId, async (dbs) =>
    dbs
      .select()
      .from(changeAssessments)
      .where(
        and(eq(changeAssessments.id, assessmentId), eq(changeAssessments.orgId, organizationId)),
      )
      .limit(1),
  );

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
      await withTenantScope(organizationId, async (tx) => {
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
  const verdictsWithCitations = await withTenantScope(organizationId, async (dbs) => {
    const verdictRows = await dbs
      .select()
      .from(changeVerdicts)
      .where(eq(changeVerdicts.assessmentId, assessmentId));

    // Fetch citations per verdict in a single pass.
    return Promise.all(
      verdictRows.map(async (v) => {
        const citations = await dbs
          .select()
          .from(changeVerdictCitations)
          .where(eq(changeVerdictCitations.verdictId, v.id));
        return { ...v, citations };
      }),
    );
  });

  const riskLinks = await fetchLinkedRiskItems(assessmentId, organizationId);

  // REQ-CORPUSLIC-011 — export-rights gate. Every cited corpus source must be
  // licensed for export; blocked sources abort the export with 403 + audit.
  // @MX:NOTE citations[].id is the corpus sourceId when the verdict cited RAG
  // results; non-corpus citations (manual) fall outside the license scope and
  // are skipped (no UUID → fetchPermittedUse returns null → no false block).
  const citedSourceIds = Array.from(
    new Set(
      verdictsWithCitations
        .flatMap((v) => v.citations.map((c) => c.id))
        .filter((s): s is string => typeof s === 'string' && s.length > 0),
    ),
  );
  const { verifyExportRights, auditExportBlockedBatch } = await import(
    '@/lib/corpus-license/export-gate'
  );
  const exportGate = await verifyExportRights({ sourceIds: citedSourceIds, orgId: organizationId });
  if (!exportGate.allowed) {
    await auditExportBlockedBatch({
      userId: session.user.id,
      blockedSources: exportGate.blockedSources,
    });
    await withTenantScope(organizationId, async (tx) => {
      await writeAudit(
        {
          actor_id: session.user.id,
          action: 'corpus.export_blocked',
          resource_type: 'changeAssessment',
          resource_id: assessmentId,
          meta_json: {
            blockedCount: exportGate.blockedSources.length,
            reasons: exportGate.blockedSources.map((b) => b.reason),
          },
        },
        tx,
      );
    });
    return Response.json(
      {
        error: 'export_license_blocked',
        blockedCount: exportGate.blockedSources.length,
      },
      { status: 403 },
    );
  }

  // REQ-SOURCE-GOV-007/AC-03 — governance freshness gate. Compose alongside
  // verifyExportRights: superseded / sunset-past / not-yet-effective sources
  // MUST NOT appear in a regulatory submission export.
  const { verifyGovernanceFreshness, auditStaleBlockedBatch } = await import(
    '@/lib/source-governance/stale-check'
  );
  const govGate = await verifyGovernanceFreshness(citedSourceIds, organizationId);
  if (!govGate.allowed) {
    await auditStaleBlockedBatch({
      userId: session.user.id,
      blockedSources: govGate.blockedSources,
    });
    return Response.json(
      { error: 'export_stale_citation_blocked', blockedCount: govGate.blockedSources.length },
      { status: 403 },
    );
  }

  // REQ-CORPUSLIC-007/011 — attach per-source usage-restriction notices to the
  // exported payload so the PDF/JSON consumer sees redistribution restrictions.
  let usageNotices: Array<{ sourceId: string; notice: string }> = [];
  if (citedSourceIds.length > 0) {
    try {
      const { generateUsageNotice } = await import('@/lib/corpus-license/usage-notice');
      usageNotices = await generateUsageNotice(citedSourceIds, organizationId);
    } catch {
      // License metadata unavailable — export proceeds without notices.
    }
  }

  try {
    await withTenantScope(organizationId, async (tx) => {
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

  // REQ-007 AC-05: format selector. Default `pdf-json` is backward compatible
  // (frontend + QMS already consume the canonical JSON shape). `format=pdf`
  // renders the real PDF byte stream from the same canonical shape.
  const url = new URL(request.url);
  const format = url.searchParams.get('format') === 'pdf' ? 'pdf' : 'pdf-json';

  if (format === 'pdf') {
    // REQ-007: render the canonical shape into a real PDF byte stream.
    // DRAFT watermark for non-final assessments (21 CFR Part 11 record integrity).
    const includeDraftWatermark = assessment.status !== 'final';
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await exportChangeAssessmentToPdf(assessment, verdictsWithCitations, riskLinks, {
        includeDraftWatermark,
        usageNotices,
      });
    } catch (err) {
      console.error('change PDF render failed', err);
      return Response.json({ error: 'Failed to render PDF' }, { status: 500 });
    }

    const rawFilename = getChangePdfFilename(assessment);
    const filename = sanitizeFilename(rawFilename);
    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  // Canonical report shape (default). Frontend / QMS renders the PDF from this.
  return Response.json(
    {
      assessment,
      verdicts: verdictsWithCitations,
      riskLinks,
      usageNotices,
      exportedAt: new Date().toISOString(),
      format: 'pdf-json',
    },
    { status: 200 },
  );
}

export const POST = withPermission('change.export', async (req, ctx, session) =>
  postExport(req, ctx as RouteContext, session),
);
