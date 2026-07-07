// @MX:NOTE [AUTO] GET /api/labeling/documents/[id]/checklist — jurisdiction required-elements checklist.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-002, REQ-011, AC-01)

// @MX:LEGACY archived from app

import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { labelingDocuments, labelingSections } from '@/lib/db/schema';
import { evaluateChecklist } from '@/lib/labeling/jurisdiction-checklist';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const ChecklistQuerySchema = z.object({
  jurisdiction: z.enum(['FDA', 'EU_MDR', 'MFDS', 'NMPA', 'PMDA']).optional(),
});

export const GET = withPermission('label.view', async (req, ctx, session) => {
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
    .select({ id: labelingDocuments.id, jurisdiction: labelingDocuments.jurisdiction })
    .from(labelingDocuments)
    .where(and(eq(labelingDocuments.id, documentId), eq(labelingDocuments.orgId, organizationId)))
    .limit(1);
  if (docs.length === 0) {
    return Response.json({ error: 'Document not found' }, { status: 404 });
  }

  // Parse ?jurisdiction= override (defaults to the document's jurisdiction).
  const url = new URL(req.url);
  const parsed = ChecklistQuerySchema.safeParse({
    jurisdiction: url.searchParams.get('jurisdiction') ?? undefined,
  });
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid jurisdiction', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const jurisdiction = (parsed.data.jurisdiction ?? docs[0]?.jurisdiction ?? 'FDA') as Parameters<
    typeof evaluateChecklist
  >[1];

  const sections = await db
    .select({
      sectionType: labelingSections.sectionType,
      content: labelingSections.content,
    })
    .from(labelingSections)
    .where(
      and(eq(labelingSections.documentId, documentId), eq(labelingSections.orgId, organizationId)),
    );

  // REQ-002/011: evaluate coverage (AC-01 — 100% required for approval).
  // Cast sectionType (string from DB) to the LabelingSectionType union.
  const evaluation = evaluateChecklist(
    sections.map((s) => ({
      sectionType: s.sectionType as Parameters<typeof evaluateChecklist>[0][number]['sectionType'],
      content: s.content,
    })),
    jurisdiction,
  );

  return Response.json(evaluation);
});
