// @MX:NOTE [AUTO] GET /api/ra/evidence/links/[reqId] — BFF proxy to hybrid-ra-saas.
// @MX:SPEC issue #168

import { HybridRaClientError, createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { withPermission } from '@/lib/auth/with-permission';

export const GET = withPermission('evidence.link', async (_req, ctx) => {
  try {
    const { reqId } = (await ctx.params) as { reqId: string };
    const hybridFetch = createHybridRaFetch();
    const res = await hybridFetch(`/api/v1/evidence/links/${reqId}`, {
      method: 'GET',
    });
    const data = await res.json();
    return Response.json(data, { status: 200 });
  } catch (err) {
    if (err instanceof HybridRaClientError) {
      return Response.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
});
