// @MX:NOTE [AUTO] GET /api/traceability/[deliverableId]/export — PDF/Markdown export.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-008)

import { writeAudit } from '@/lib/kernel/audit';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { withTenantScope } from '@/lib/kernel/db/client';
import { getEvidencePacket } from '@/lib/traceability/evidence-packet';
import { exportPacket, sanitizeFilename } from '@/lib/traceability/export-packet';
import { listStaleNodeIds } from '@/lib/traceability/stale-propagation';
import { z } from 'zod';

const ExportQuerySchema = z.object({
  format: z.enum(['pdf', 'md']).default('md'),
});

export const GET = withPermission('traceability.view', async (req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const params = ctx.params && 'then' in ctx.params ? await ctx.params : (ctx.params ?? {});
  const deliverableId = params.deliverableId;
  if (!deliverableId || typeof deliverableId !== 'string') {
    return Response.json({ error: 'deliverableId required' }, { status: 400 });
  }

  const url = new URL(req.url);
  const parsed = ExportQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid query', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const format = parsed.data.format;

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
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  // REQ-CORPUSLIC-007/011 — collect corpus sourceIds referenced by the packet
  // (stale_source issues may reference source nodes). Run the export-rights
  // gate; if any cited source is not export-entitled, abort with 403 + audit.
  // Today the packet tree references deliverables (CER/DHF/risk), not corpus
  // sources, so this is typically a no-op — but the gate is wired so a future
  // source-cited packet cannot leak unentitled content.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const packetSourceIds = Array.from(
    new Set(packet.issues.map((i) => i.detail).flatMap((d) => (UUID_RE.test(d) ? [d] : []))),
  );

  if (packetSourceIds.length > 0) {
    const { verifyExportRights, auditExportBlockedBatch } = await import(
      '@/lib/corpus-license/export-gate'
    );
    const exportGate = await verifyExportRights({
      sourceIds: packetSourceIds,
      orgId: organizationId,
    });
    if (!exportGate.allowed) {
      await auditExportBlockedBatch({
        userId: session.user.id,
        blockedSources: exportGate.blockedSources,
      });
      return Response.json(
        { error: 'export_license_blocked', blockedCount: exportGate.blockedSources.length },
        { status: 403 },
      );
    }

    // REQ-SOURCE-GOV-007/AC-03 — governance freshness gate. Compose alongside
    // verifyExportRights: superseded / sunset-past / not-yet-effective sources
    // MUST NOT appear in a regulatory submission export.
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
        { error: 'export_stale_citation_blocked', blockedCount: govGate.blockedSources.length },
        { status: 403 },
      );
    }
  }

  // REQ-CORPUSLIC-007 — usage-restriction notices for any cited corpus sources.
  let usageNotices: Array<{ sourceId: string; notice: string }> = [];
  if (packetSourceIds.length > 0) {
    try {
      const { generateUsageNotice } = await import('@/lib/corpus-license/usage-notice');
      usageNotices = await generateUsageNotice(packetSourceIds, organizationId);
    } catch {
      // License metadata unavailable — export proceeds without notices.
    }
  }

  const result = await exportPacket(packet, format, usageNotices);
  if (!result.success || !result.content) {
    // L2 (#241): do NOT forward exporter internals to the client — log server-side only.
    // MEDIUM-1 (#241): strip CRLF/control chars + cap length to prevent log-injection
    // (exporter errors may carry DB-sourced chars); protects Part 11 log integrity.
    const safeError = (result.error?.message ?? 'unknown').replace(/[\p{Cc}]/gu, ' ').slice(0, 500);
    console.error('[traceability.export] packet export failed', {
      deliverableId,
      format,
      error: safeError,
    });
    return Response.json({ error: 'export_failed' }, { status: 502 });
  }

  // 21 CFR Part 11 — every packet export is audited.
  await writeAudit({
    actor_id: session.user.id,
    action: 'traceability.packet_exported',
    resource_type: 'evidence_packet',
    resource_id: deliverableId,
    meta_json: {
      format,
      size: result.size ?? result.content.length,
      issueCount: packet.issues.length,
    },
  });

  const contentType = format === 'pdf' ? 'application/pdf' : 'text/markdown; charset=utf-8';
  // L3 fix: sanitize the filename (DB-sourced refId may carry header-breaking chars).
  const rawFilename =
    result.filename ?? `evidence-packet-${deliverableId}.${format === 'pdf' ? 'pdf' : 'md'}`;
  const filename = sanitizeFilename(rawFilename);
  return new Response(result.content, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
});
