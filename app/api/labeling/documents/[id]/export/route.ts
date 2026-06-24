// @MX:NOTE [AUTO] POST /api/labeling/documents/[id]/export — export with unsupported-claim gate.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-006, REQ-010, AC-03)
//
// RBAC: withPermission('label.export') restricts to ra-lead.
// REQ-006: canExportLabelingDocument gate — blocks on unsupported/pending claims.

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { labelingDocuments } from '@/lib/db/schema';
import { canExportLabelingDocument } from '@/lib/labeling/export-gate';
import { and, eq } from 'drizzle-orm';

export const POST = withPermission('label.export', async (_req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const documentId = (ctx.params && 'then' in ctx.params ? await ctx.params : (ctx.params ?? {}))
    .id;
  if (typeof documentId !== 'string') {
    return Response.json({ error: 'Invalid document id' }, { status: 400 });
  }

  // IDOR defense: document must belong to caller's org.
  const docs = await db
    .select({
      id: labelingDocuments.id,
      status: labelingDocuments.status,
      productName: labelingDocuments.productName,
      jurisdiction: labelingDocuments.jurisdiction,
    })
    .from(labelingDocuments)
    .where(and(eq(labelingDocuments.id, documentId), eq(labelingDocuments.orgId, organizationId)))
    .limit(1);
  if (docs.length === 0 || !docs[0]) {
    return Response.json({ error: 'Document not found' }, { status: 404 });
  }
  const doc = docs[0];

  // REQ-006: export gate — blocks when unsupported/pending claims exist.
  const gate = await canExportLabelingDocument(documentId, organizationId);

  if (!gate.allowed) {
    // REQ-010: audit the denial (21 CFR Part 11 — distinguishes from approval).
    try {
      await db.transaction(async (tx) => {
        await writeAudit(
          {
            actor_id: session.user.id,
            action: 'label.export_blocked',
            resource_type: 'labelingDocument',
            resource_id: documentId,
            meta_json: {
              reason: gate.reason ?? 'unknown',
              blockingClaimCount: gate.blockingClaims.length,
              blockingClaimIds: gate.blockingClaims,
            },
          },
          tx,
        );
      });
    } catch {
      // Audit failure is a compliance issue — surface 500.
      return Response.json({ error: 'labeling_export_block_audit_lost' }, { status: 500 });
    }
    return Response.json(
      {
        error: 'Export blocked: unsupported or pending-review claims exist',
        reason: gate.reason,
        blockingClaimCount: gate.blockingClaims.length,
      },
      { status: 403 },
    );
  }

  // Export allowed — return the document payload for the export-hub to format.
  // (The full export-hub LabelingExporter is wired in Phase 3 UI; the route
  // returns structured JSON the hub consumes.)
  return Response.json(
    {
      documentId,
      productName: doc.productName,
      jurisdiction: doc.jurisdiction,
      status: doc.status,
      exportedAt: new Date().toISOString(),
    },
    { status: 200 },
  );
});
