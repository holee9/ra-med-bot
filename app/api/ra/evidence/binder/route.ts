// @MX:NOTE [AUTO] POST /api/ra/evidence/binder — BFF proxy to hybrid-ra-saas.
// @MX:SPEC issue #168

import { HybridRaClientError, createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';

export const POST = withPermission('evidence.binder', async (req, _ctx, session) => {
  try {
    const body = await req.json();
    const hybridFetch = createHybridRaFetch();
    const res = await hybridFetch('/api/v1/evidence/binder', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    await writeAudit({
      actor_id: session.user.id,
      action: 'workflow.edit',
      resource_type: 'evidence_binder',
      resource_id: data.binder_id ?? 'unknown',
      meta_json: {
        link_count: data.link_count ?? body.link_ids?.length ?? 0,
        status: data.status,
      },
    });
    return Response.json(data, { status: 200 });
  } catch (err) {
    if (err instanceof HybridRaClientError) {
      return Response.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
});
