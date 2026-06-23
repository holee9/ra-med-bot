// @MX:NOTE [AUTO] GET /api/traceability/[deliverableId]/packet — evidence packet.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-006, REQ-TRACEABILITY-007)

import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { getEvidencePacket } from '@/lib/traceability/evidence-packet';
import { listStaleNodeIds } from '@/lib/traceability/stale-propagation';

export const GET = withPermission('traceability.view', async (_req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const params = ctx.params && 'then' in ctx.params ? await ctx.params : (ctx.params ?? {});
  const deliverableId = params.deliverableId;
  if (!deliverableId || typeof deliverableId !== 'string') {
    return Response.json({ error: 'deliverableId required' }, { status: 400 });
  }

  const staleNodeIds = await listStaleNodeIds(db, organizationId);
  const packet = await getEvidencePacket(db, {
    orgId: organizationId,
    deliverableId,
    staleNodeIds,
  });
  if (!packet) {
    // 404 (not 403) — avoid leaking deliverable existence across orgs.
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  return Response.json(packet);
});
