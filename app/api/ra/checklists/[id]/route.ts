// @MX:NOTE [AUTO] GET /api/ra/checklists/[id] — BFF proxy to hybrid-ra-saas.
// @MX:SPEC SPEC-INTEGRATION-001, Issue #170

import { HybridRaClientError, createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { withPermission } from '@/lib/kernel/auth/with-permission';

export const GET = withPermission('checklist.view', async (_req, ctx) => {
  try {
    const rawParams = ctx.params;
    const params = rawParams && 'then' in rawParams ? await rawParams : rawParams;
    const id = params?.id ?? '';

    const hybridFetch = createHybridRaFetch();
    const res = await hybridFetch(`/api/v1/checklists/${id}`);
    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    if (err instanceof HybridRaClientError) {
      return Response.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
});
