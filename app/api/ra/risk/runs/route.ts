// @MX:NOTE [AUTO] POST /api/ra/risk/runs — create a new risk management workflow run.
// @MX:SPEC SPEC-REGULA-RISK-001 (T2.1, REQ-RISK-028)

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';

export const POST = withPermission('risk.generate', async (req, _ctx, session) => {
  try {
    const body = await req.json();
    const { createHybridRaFetch } = await import('@/lib/api/hybrid-ra-client');
    const hybridFetch = createHybridRaFetch();
    const res = await hybridFetch('/api/v1/risk/runs', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const data = await res.json();

    await writeAudit({
      actor_id: session.user.id,
      action: 'workflow.start',
      resource_type: 'risk_run',
      resource_id: ((data as Record<string, unknown>).id as string | undefined) ?? 'unknown',
    });

    return Response.json(data, { status: 201 });
  } catch (err) {
    const { HybridRaClientError } = await import('@/lib/api/hybrid-ra-client');
    if (err instanceof HybridRaClientError) {
      return Response.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
});
