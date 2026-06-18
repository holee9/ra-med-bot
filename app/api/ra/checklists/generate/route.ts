// @MX:NOTE [AUTO] POST /api/ra/checklists/generate — BFF proxy to hybrid-ra-saas.
// @MX:SPEC SPEC-INTEGRATION-001, Issue #170

import { HybridRaClientError, createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { withPermission } from '@/lib/auth/with-permission';

export const POST = withPermission('checklist.generate', async (req) => {
  try {
    const body = await req.json();
    const hybridFetch = createHybridRaFetch();
    const res = await hybridFetch('/api/v1/checklists/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return Response.json(data, { status: 201 });
  } catch (err) {
    if (err instanceof HybridRaClientError) {
      return Response.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
});
