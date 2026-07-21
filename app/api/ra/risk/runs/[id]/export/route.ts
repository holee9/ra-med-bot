// @MX:ANCHOR [AUTO] buildRiskReport export route — DOCX generation entry point.
// @MX:REASON Called by UI download button and E2E test. Fan_in >= 3.
// @MX:WARN [AUTO] DOCX binary generation inside export route.
// @MX:REASON Binary file generation — large memory allocation for complex reports.
// @MX:SPEC SPEC-REGULA-RISK-001 (T2.9, T3.1~T3.4, REQ-RISK-034~036)

import { writeAudit } from '@/lib/kernel/audit';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { buildRiskReport } from '@/lib/risk/report-builder';

export const POST = withPermission('risk.generate', async (_req, ctx, session) => {
  const params = await (ctx.params as Promise<Record<string, string>>);
  const id = params?.id as string;

  try {
    const { createHybridRaFetch } = await import('@/lib/api/hybrid-ra-client');
    const hybridFetch = createHybridRaFetch();

    // Fetch run aggregate (items + controls + GSPR mappings)
    const runRes = await hybridFetch(`/api/v1/risk/runs/${id}`, { method: 'GET' });
    const runData = (await runRes.json()) as Parameters<typeof buildRiskReport>[0];

    const docxBuffer = await buildRiskReport(runData);

    await writeAudit({
      actor_id: session.user.id,
      action: 'workflow.download',
      resource_type: 'risk_run',
      resource_id: id,
    });

    return new Response(docxBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="risk-management-report-${id}.docx"`,
      },
    });
  } catch (err) {
    const { HybridRaClientError } = await import('@/lib/api/hybrid-ra-client');
    if (err instanceof HybridRaClientError) {
      return Response.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
});
