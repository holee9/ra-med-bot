// @MX:NOTE [AUTO] POST /api/ra/risk/identify — RAG-based hazard identification.
// @MX:SPEC SPEC-REGULA-RISK-001 (T2.3, REQ-RISK-001~010)

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { identifyHazards } from '@/lib/risk/hazard-identification';

export const POST = withPermission('risk.generate', async (req, _ctx, session) => {
  try {
    const { deviceDescription, deviceClass, workflowRunId } = await req.json() as {
      deviceDescription: string;
      deviceClass: string;
      workflowRunId: string;
    };

    const hybridFetch = createHybridRaFetch();
    const result = await identifyHazards(deviceDescription, deviceClass, hybridFetch);

    await writeAudit({
      actor_id: session.user.id,
      action: 'risk.hazard_identified',
      resource_type: 'risk_run',
      resource_id: workflowRunId,
      meta_json: { itemCount: result.items.length, lowConfidenceCount: result.lowConfidenceCount },
    });

    return Response.json(result, { status: 201 });
  } catch (err) {
    const { HybridRaClientError } = await import('@/lib/api/hybrid-ra-client');
    if (err instanceof HybridRaClientError) {
      return Response.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
});
