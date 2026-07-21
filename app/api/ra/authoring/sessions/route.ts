// @MX:NOTE [AUTO] POST /api/ra/authoring/sessions — BFF proxy to hybrid-ra-saas.
// @MX:SPEC issue #171

import { HybridRaClientError, createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { writeAudit } from '@/lib/kernel/audit';
import { withPermission } from '@/lib/kernel/auth/with-permission';

export const POST = withPermission('authoring.create', async (req, _ctx, session) => {
  try {
    const body = await req.json();
    const hybridFetch = createHybridRaFetch();
    const res = await hybridFetch('/api/v1/authoring/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    await writeAudit({
      actor_id: session.user.id,
      action: 'workflow.start',
      resource_type: 'authoring_session',
      resource_id: data.session_id ?? 'unknown',
      meta_json: {
        section_id: body.section_id,
        device_id: body.device_id,
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
