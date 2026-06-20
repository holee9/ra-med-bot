// @MX:NOTE [AUTO] POST /api/ra/risk/controls/recommend — 3-tier control recommendations.
// @MX:SPEC SPEC-REGULA-RISK-001 (T2.6, REQ-RISK-021~027)

import { withPermission } from '@/lib/auth/with-permission';
import { createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { recommendControls } from '@/lib/risk/control-recommendation';

export const POST = withPermission('risk.generate', async (req) => {
  const { riskItemId } = await req.json() as { riskItemId: string };
  const hybridFetch = createHybridRaFetch();
  const controls = await recommendControls(riskItemId, hybridFetch);
  return Response.json({ controls });
});
