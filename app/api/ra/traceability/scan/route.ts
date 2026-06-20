// @MX:NOTE [AUTO] POST /api/ra/traceability/scan — BFF proxy to hybrid-ra-saas.
// @MX:SPEC SPEC-INTEGRATION-001, Issue #169

import { HybridRaClientError, createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';

export const POST = withPermission('traceability.scan', async (req, _ctx, session) => {
  try {
    const body = await req.json();
    await writeAudit({
      actor_id: session.user.id,
      action: 'workflow.start',
      resource_type: 'traceability',
      resource_id:
        body && typeof body === 'object' && 'projectId' in body
          ? String(body.projectId)
          : 'traceability.scan',
      meta_json: {
        workflow: 'traceability.scan',
        requestFields:
          body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body).sort() : [],
      },
    });

    const hybridFetch = createHybridRaFetch();
    const res = await hybridFetch('/api/v1/traceability/scan', {
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
