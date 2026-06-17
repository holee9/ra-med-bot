// @MX:NOTE [AUTO] GET /api/ra/checklists/gap — BFF proxy to hybrid-ra-saas gap analysis.
// @MX:SPEC SPEC-INTEGRATION-001, Issue #170

import { HybridRaClientError, createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { withPermission } from '@/lib/auth/with-permission';

export const GET = withPermission('checklist.view', async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const checklistId = searchParams.get('checklist_id') ?? '';

    const hybridFetch = createHybridRaFetch();
    const res = await hybridFetch(`/api/v1/checklists/gap?checklist_id=${checklistId}`);
    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    if (err instanceof HybridRaClientError) {
      return Response.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
});
