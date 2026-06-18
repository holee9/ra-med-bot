// @MX:NOTE [AUTO] POST /api/ra/evidence/link — BFF proxy to hybrid-ra-saas.
// @MX:SPEC issue #168

import { HybridRaClientError, createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { withPermission } from '@/lib/auth/with-permission';

export const POST = withPermission('evidence.link', async (req) => {
  try {
    const body = await req.json();
    const hybridFetch = createHybridRaFetch();
    const res = await hybridFetch('/api/v1/evidence/link', {
      method: 'POST',
      body: JSON.stringify(body),
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
