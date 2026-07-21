// @MX:NOTE [AUTO] POST /api/ra/risk/controls/recommend — 3-tier control recommendations.
// @MX:SPEC SPEC-REGULA-RISK-001 (T2.6, REQ-RISK-021~027)

import { createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { writeAudit } from '@/lib/kernel/audit';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { recommendControls } from '@/lib/risk/control-recommendation';

export const POST = withPermission('risk.generate', async (req, _ctx, session) => {
  const { riskItemId } = (await req.json()) as { riskItemId: string };
  await writeAudit({
    actor_id: session.user.id,
    action: 'workflow.start',
    resource_type: 'risk_control_recommendation',
    resource_id: riskItemId,
    meta_json: {
      workflow: 'risk.controls.recommend',
    },
  });

  const hybridFetch = createHybridRaFetch();
  const controls = await recommendControls(riskItemId, hybridFetch);
  return Response.json({ controls });
});
