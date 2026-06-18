// @MX:NOTE [AUTO] POST /api/ra/evidence/link — BFF proxy to hybrid-ra-saas.
// @MX:SPEC issue #168

import { HybridRaClientError, createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';

export const POST = withPermission('evidence.link', async (req, _ctx, session) => {
  try {
    const body = await req.json();
    const hybridFetch = createHybridRaFetch();
    const res = await hybridFetch('/api/v1/evidence/link', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    await writeAudit({
      actor_id: session.user.id,
      action: 'workflow.edit',
      resource_type: 'evidence_link',
      resource_id: data.req_id ?? body.requirement_id ?? 'unknown',
      meta_json: {
        requirement_id: body.requirement_id,
        evidence_type: body.evidence_type,
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
