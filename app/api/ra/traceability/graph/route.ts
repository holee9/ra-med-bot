// @MX:NOTE [AUTO] GET /api/ra/traceability/graph — BFF proxy to hybrid-ra-saas.
// @MX:SPEC SPEC-INTEGRATION-001, Issue #169

import { HybridRaClientError, createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { withPermission } from '@/lib/kernel/auth/with-permission';

export const GET = withPermission('traceability.view', async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const scanId = searchParams.get('scan_id');
    const upstreamPath = scanId
      ? `/api/v1/traceability/graph?scan_id=${encodeURIComponent(scanId)}`
      : '/api/v1/traceability/graph';

    const hybridFetch = createHybridRaFetch();
    const res = await hybridFetch(upstreamPath);
    const data = await res.json();
    return Response.json(data, { status: 200 });
  } catch (err) {
    if (err instanceof HybridRaClientError) {
      return Response.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
});
