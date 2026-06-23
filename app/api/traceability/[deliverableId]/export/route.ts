// @MX:NOTE [AUTO] GET /api/traceability/[deliverableId]/export — PDF/Markdown export.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-008)

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
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

  const staleNodeIds = await listStaleNodeIds(db, organizationId);
  const packet = await getEvidencePacket(db, {
    orgId: organizationId,
    deliverableId,
    staleNodeIds,
  });
  if (!packet) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  const result = await exportPacket(packet, format);
  if (!result.success || !result.content) {
    return Response.json(
      { error: 'export_failed', detail: result.error?.message ?? 'unknown' },
      { status: 502 },
    );
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
