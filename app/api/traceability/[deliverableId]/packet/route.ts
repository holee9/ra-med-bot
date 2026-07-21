// @MX:NOTE [AUTO] GET /api/traceability/[deliverableId]/packet — evidence packet.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-006, REQ-TRACEABILITY-007)

import { withPermission } from '@/lib/kernel/auth/with-permission';
import { withTenantScope } from '@/lib/kernel/db/client';
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

  // #239 Phase 2: withTenantScope sets app.current_org_id GUC for RLS enforce.
  // listStaleNodeIds + getEvidencePacket issue org-scoped reads via the passed
  // handle; wrapping them sets the GUC so Phase 3 FORCE RLS will enforce isolation.
  const packet = await withTenantScope(organizationId, async (dbs) => {
    const staleNodeIds = await listStaleNodeIds(dbs, organizationId);
    return getEvidencePacket(dbs, {
      orgId: organizationId,
      deliverableId,
      staleNodeIds,
    });
  });
  if (!packet) {
    // 404 (not 403) — avoid leaking deliverable existence across orgs.
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  // REQ-SOURCE-GOV-007/AC-03 — governance freshness gate on the packet read.
  // The packet is consumed by submission-assembly UIs; a stale (superseded /
  // sunset-past / not-yet-effective) source referenced via a stale_source issue
  // MUST NOT silently propagate into a deliverable. Composed alongside the
  // export route's gate (the packet read is the preview twin of the export).
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const packetSourceIds = Array.from(
    new Set(packet.issues.map((i) => i.detail).flatMap((d) => (UUID_RE.test(d) ? [d] : []))),
  );
  if (packetSourceIds.length > 0) {
    const { verifyGovernanceFreshness, auditStaleBlockedBatch } = await import(
      '@/lib/source-governance/stale-check'
    );
    const govGate = await verifyGovernanceFreshness(packetSourceIds, organizationId);
    if (!govGate.allowed) {
      await auditStaleBlockedBatch({
        userId: session.user.id,
        blockedSources: govGate.blockedSources,
      });
      return Response.json(
        { error: 'stale_citation_blocked', blockedCount: govGate.blockedSources.length },
        { status: 403 },
      );
    }
  }

  return Response.json(packet);
});
