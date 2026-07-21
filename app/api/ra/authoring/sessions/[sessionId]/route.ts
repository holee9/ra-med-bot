// @MX:NOTE [AUTO] GET /api/ra/authoring/sessions/[sessionId] — BFF proxy to hybrid-ra-saas.
// @MX:SPEC issue #171

import { HybridRaClientError, createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { withPermission } from '@/lib/kernel/auth/with-permission';

export const GET = withPermission('authoring.view', async (_req, ctx) => {
  try {
    const { sessionId } = (await ctx.params) as { sessionId: string };
    const hybridFetch = createHybridRaFetch();
    const res = await hybridFetch(`/api/v1/authoring/sessions/${sessionId}`, {
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
