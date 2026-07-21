// @MX:NOTE [AUTO] PATCH /api/ra/checklists/[id]/items/[itemId] — BFF proxy to hybrid-ra-saas.
// @MX:SPEC SPEC-INTEGRATION-001, Issue #170

import { HybridRaClientError, createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { writeAudit } from '@/lib/kernel/audit';
import { withPermission } from '@/lib/kernel/auth/with-permission';

export const PATCH = withPermission('checklist.update', async (req, ctx, session) => {
  try {
    const rawParams = ctx.params;
    const params = rawParams && 'then' in rawParams ? await rawParams : rawParams;
    const id = params?.id ?? '';
    const itemId = params?.itemId ?? '';

    const body = await req.json();
    await writeAudit({
      actor_id: session.user.id,
      action: 'checklist.toggle',
      resource_type: 'checklist_item',
      resource_id: itemId,
      meta_json: {
        checklistId: id,
        updatedFields:
          body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body).sort() : [],
      },
    });

    const hybridFetch = createHybridRaFetch();
    const res = await hybridFetch(`/api/v1/checklists/${id}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    if (err instanceof HybridRaClientError) {
      return Response.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
});
