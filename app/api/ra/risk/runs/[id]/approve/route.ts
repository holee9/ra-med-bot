// @MX:ANCHOR [AUTO] RA-lead approval gate — RBAC critical invariant.
// @MX:REASON risk.approve requires minRole 'ra-lead'. Only this route enforces risk report sign-off.
// @MX:SPEC SPEC-REGULA-RISK-001 (T2.10, REQ-RISK-037~038)

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';

// CRITICAL: Only withPermission('risk.approve') is acceptable here.
// minRole 'ra-lead' is required by ISO 14971 §10 for final risk report sign-off.
// Using any other permission action would lower the RBAC bar to ra-member, violating the standard.
export const POST = withPermission('risk.approve', async (req, ctx, session) => {
  const params = await (ctx.params as Promise<Record<string, string>>);
  const id = params?.id as string;
  const { comment } = (await req.json()) as { comment?: string };

  const { createHybridRaFetch } = await import('@/lib/api/hybrid-ra-client');
  const hybridFetch = createHybridRaFetch();
  const res = await hybridFetch(`/api/v1/risk/runs/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approvedBy: session.user.id, comment }),
  });
  const data = await res.json();

  await writeAudit({
    userId: session.user.id,
    action: 'risk.report_approved',
    resourceType: 'risk_run',
    resourceId: id,
    organizationId: session.user.organizationId,
    metadata: { comment },
  });

  return Response.json(data);
});
