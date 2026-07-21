import { writeAudit } from '@/lib/kernel/audit';
// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-018, REQ-PCCP-019)
import { withPermission } from '@/lib/kernel/auth/with-permission';
import type { AuthSession } from '@/lib/kernel/auth/with-permission';
import { db } from '@/lib/kernel/db/client';
import { pccpComponents, pccpVersions } from '@/lib/kernel/db/schema';
import { exportPccpToDocx, getDocxFilename } from '@/lib/pccp/exporters/docx';
import { exportPccpToPdf, getPdfFilename } from '@/lib/pccp/exporters/pdf';
import type { PccpComponentRecord, PccpComponentType, PccpVersion } from '@/lib/pccp/types';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const ExportBodySchema = z.object({
  format: z.enum(['docx', 'pdf']),
  include_draft_watermark: z.boolean().default(true),
  // REQ-SOURCE-GOV-007: optional corpus source UUIDs cited in the PCCP
  // (e.g. predicate device sources). When present the governance freshness
  // gate fires so superseded/stale sources cannot ship in the submission.
  citedSourceIds: z.array(z.string().uuid()).optional(),
});

async function postExport(
  request: Request,
  params: { id: string },
  session: AuthSession,
): Promise<Response> {
  const { id } = params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid input' }, { status: 400 });
  }

  const parsed = ExportBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const [version] = await db.select().from(pccpVersions).where(eq(pccpVersions.id, id)).limit(1);

  if (!version) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const components = await db
    .select()
    .from(pccpComponents)
    .where(eq(pccpComponents.pccpVersionId, id));

  const versionTyped = version as unknown as PccpVersion;
  const componentsTyped: PccpComponentRecord[] = components.map((c) => ({
    componentType: c.componentType as PccpComponentType,
    contentJsonb: (c.contentJsonb as Record<string, unknown>) ?? {},
    completedAt: c.completedAt,
  }));
  const { format, include_draft_watermark } = parsed.data;

  // REQ-SOURCE-GOV-007/AC-03 — governance freshness gate. When the caller
  // supplies citedSourceIds, superseded / sunset-past / not-yet-effective
  // sources MUST NOT ship in the PCCP submission. Forward-compatible: omitted
  // today (PCCP components don't yet carry a source UUID array) → no-op.
  const citedSourceIds = parsed.data.citedSourceIds ?? [];
  if (citedSourceIds.length > 0) {
    const { verifyGovernanceFreshness, auditStaleBlockedBatch } = await import(
      '@/lib/source-governance/stale-check'
    );
    const govGate = await verifyGovernanceFreshness(
      citedSourceIds,
      session.user.organizationId ?? '',
    );
    if (!govGate.allowed) {
      await auditStaleBlockedBatch({
        userId: session.user.id,
        blockedSources: govGate.blockedSources,
      });
      return Response.json(
        { error: 'stale_citation_blocked', blockedCount: govGate.blockedSources.length },
        { status: 403 },
      );
    }
  }

  if (format === 'docx') {
    const buf = await exportPccpToDocx(versionTyped, componentsTyped, {
      includeDraftWatermark: include_draft_watermark,
    });
    await writeAudit({
      actor_id: session.user.id,
      action: 'workflow.download',
      resource_type: 'pccp_version',
      resource_id: id,
      meta_json: { format, includeDraftWatermark: include_draft_watermark },
    });
    const filename = getDocxFilename(versionTyped);
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  const buf = await exportPccpToPdf(versionTyped, componentsTyped, {
    includeDraftWatermark: include_draft_watermark,
  });
  await writeAudit({
    actor_id: session.user.id,
    action: 'workflow.download',
    resource_type: 'pccp_version',
    resource_id: id,
    meta_json: { format, includeDraftWatermark: include_draft_watermark },
  });
  const filename = getPdfFilename(versionTyped);
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export const POST = withPermission('consult.create', async (request, ctx, session) =>
  postExport(request, (await ctx.params) as { id: string }, session),
);
