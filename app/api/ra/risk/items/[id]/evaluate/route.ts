// @MX:NOTE [AUTO] POST /api/ra/risk/items/[id]/evaluate — evaluate severity×probability.
// @MX:SPEC SPEC-REGULA-RISK-001 (T2.5, REQ-RISK-011~015)

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { evaluateRiskLevel } from '@/lib/risk/risk-evaluation';

export const POST = withPermission('risk.update', async (req, ctx, session) => {
  const params = await (ctx.params as Promise<Record<string, string>>);
  const id = params?.id as string;
  const { severity, probability } = await req.json() as { severity: number; probability: number };

  const riskLevel = evaluateRiskLevel(severity, probability);

  await writeAudit({
    actor_id: session.user.id,
    action: 'risk.matrix_evaluated',
    resource_type: 'risk_item',
    resource_id: id,
    meta_json: { severity, probability, riskLevel },
  });

  return Response.json({ id, severity, probability, riskLevel });
});
