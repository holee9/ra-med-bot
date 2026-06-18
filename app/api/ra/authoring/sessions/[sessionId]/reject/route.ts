// @MX:NOTE [AUTO] POST /api/ra/authoring/sessions/[sessionId]/reject — BFF proxy to hybrid-ra-saas.
// @MX:SPEC issue #171

import { HybridRaClientError, createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';

export const POST = withPermission('authoring.approve', async (req, ctx, session) => {
  try {
    const { sessionId } = (await ctx.params) as { sessionId: string };
    const body = await req.json();
    const hybridFetch = createHybridRaFetch();
    const res = await hybridFetch(`/api/v1/authoring/sessions/${sessionId}/reject`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    await writeAudit({
      actor_id: session.user.id,
      action: 'workflow.reject',
      resource_type: 'authoring_session',
      resource_id: sessionId,
      meta_json: {
        decision: body.decision,
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
