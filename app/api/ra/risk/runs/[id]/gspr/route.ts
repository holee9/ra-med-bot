// @MX:NOTE [AUTO] POST /api/ra/risk/runs/[id]/gspr — EU MDR GSPR mapping.
// @MX:SPEC SPEC-REGULA-RISK-001 (T2.8, REQ-RISK-030~033)

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';

export const POST = withPermission('risk.update', async (req, ctx, session) => {
  const params = await (ctx.params as Promise<Record<string, string>>);
  const id = params?.id as string;
  const body = await req.json();

  const { createHybridRaFetch } = await import('@/lib/api/hybrid-ra-client');
  const hybridFetch = createHybridRaFetch();
  const res = await hybridFetch(`/api/v1/risk/runs/${id}/gspr`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const data = await res.json();

  await writeAudit({
    actor_id: session.user.id,
    action: 'risk.gspr_mapped',
    resource_type: 'risk_run',
    resource_id: id,
  });

  return Response.json(data, { status: 201 });
});
