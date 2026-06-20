// @MX:NOTE [AUTO] PATCH /api/ra/risk/controls/[id] — adopt control + residual risk.
// @MX:SPEC SPEC-REGULA-RISK-001 (T2.7, REQ-RISK-021~027)

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { validateControlHierarchy } from '@/lib/risk/control-recommendation';
import type { ControlTier } from '@/lib/risk/control-recommendation';
import { type ResidualRiskResult, evaluateResidualRisk } from '@/lib/risk/residual-risk';

export const PATCH = withPermission('risk.update', async (req, ctx, session) => {
  const params = await (ctx.params as Promise<Record<string, string>>);
  const id = params?.id as string;
  const body = (await req.json()) as {
    tier: ControlTier;
    rationale?: string;
    isAdopted: boolean;
    residualSeverity?: number;
    residualProbability?: number;
    alarpJustification?: string;
  };

  // Validate control tier hierarchy (information requires rationale)
  validateControlHierarchy(body.tier, body.rationale);

  // Evaluate residual risk if provided
  let residualResult: ResidualRiskResult | undefined;
  if (body.residualSeverity !== undefined && body.residualProbability !== undefined) {
    residualResult = evaluateResidualRisk(
      body.residualSeverity,
      body.residualProbability,
      body.alarpJustification,
    );
  }

  await writeAudit({
    actor_id: session.user.id,
    action: 'risk.control_adopted',
    resource_type: 'risk_control',
    resource_id: id,
    meta_json: { tier: body.tier, isAdopted: body.isAdopted },
  });

  return Response.json({ id, ...body, residualResult });
});
