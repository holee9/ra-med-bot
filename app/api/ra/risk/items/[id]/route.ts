// @MX:NOTE [AUTO] PATCH/DELETE /api/ra/risk/items/[id] — edit or delete hazard item.
// @MX:SPEC SPEC-REGULA-RISK-001 (T2.4, REQ-RISK-011~015)

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';

async function handlePatch(req: Request, ctx: { params?: unknown }, session: { user: { id: string; organizationId?: string } }) {
  const params = await (ctx.params as Promise<Record<string, string>>);
  const id = params?.id as string;
  const body = await req.json();

  const { createHybridRaFetch } = await import('@/lib/api/hybrid-ra-client');
  const hybridFetch = createHybridRaFetch();
  const res = await hybridFetch(`/api/v1/risk/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  const data = await res.json();

  await writeAudit({
    actor_id: session.user.id,
    action: 'risk.matrix_evaluated',
    resource_type: 'risk_item',
    resource_id: id,
  });

  return Response.json(data);
}

export const PATCH = withPermission('risk.update', handlePatch);

export const DELETE = withPermission('risk.update', async (_req, ctx, session) => {
  const params = await (ctx.params as Promise<Record<string, string>>);
  const id = params?.id as string;

  const { createHybridRaFetch } = await import('@/lib/api/hybrid-ra-client');
  const hybridFetch = createHybridRaFetch();
  await hybridFetch(`/api/v1/risk/items/${id}`, { method: 'DELETE' });

  await writeAudit({
    actor_id: session.user.id,
    action: 'risk.matrix_evaluated',
    resource_type: 'risk_item',
    resource_id: id,
  });

  return new Response(null, { status: 204 });
});
