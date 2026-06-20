// @MX:NOTE [AUTO] POST /api/ra/checklists/generate — BFF proxy to hybrid-ra-saas.
// @MX:SPEC SPEC-INTEGRATION-001, Issue #170

import { HybridRaClientError, createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';

export const POST = withPermission('checklist.generate', async (req, _ctx, session) => {
  try {
    const body = await req.json();
    await writeAudit({
      actor_id: session.user.id,
      action: 'workflow.start',
      resource_type: 'checklist',
      resource_id:
        body && typeof body === 'object' && 'projectId' in body
          ? String(body.projectId)
          : 'checklist.generate',
      meta_json: {
        workflow: 'checklist.generate',
        requestFields:
          body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body).sort() : [],
      },
    });

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
