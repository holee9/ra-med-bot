// @MX:NOTE [AUTO] GET /api/ra/risk/runs/[id] — aggregate: items + controls + mappings.
// @MX:SPEC SPEC-REGULA-RISK-001 (T2.2, REQ-RISK-029)

import { withPermission } from '@/lib/kernel/auth/with-permission';

export const GET = withPermission('risk.view', async (_req, ctx) => {
  const params = await ctx.params;
  const id = params?.id as string;

  try {
    const { createHybridRaFetch } = await import('@/lib/api/hybrid-ra-client');
    const hybridFetch = createHybridRaFetch();
    const res = await hybridFetch(`/api/v1/risk/runs/${id}`, { method: 'GET' });
    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    const { HybridRaClientError } = await import('@/lib/api/hybrid-ra-client');
    if (err instanceof HybridRaClientError) {
      return Response.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
});
