// @MX:NOTE [AUTO] GET /api/labeling/documents/[id] — fetch a labeling document with sections.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-001, REQ-012, AC-01)

// @MX:LEGACY archived from app
//
// IDOR defense: org_id scope enforced (404 on cross-org access — never 403,
// to avoid leaking the existence of foreign-org document UUIDs).

import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { labelingDocuments, labelingSections } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export const GET = withPermission('label.view', async (_req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  // Next.js 15: params is a Promise. Await before reading (mirrors CC [assessmentId] route).
  const resolvedParams = ctx.params && 'then' in ctx.params ? await ctx.params : (ctx.params ?? {});
  const documentId = resolvedParams.id;
  if (typeof documentId !== 'string') {
    return Response.json({ error: 'Invalid document id' }, { status: 400 });
  }

  // IDOR defense: org_id scope (returns 404 to avoid existence leak).
  const docs = await db
    .select()
    .from(labelingDocuments)
    .where(and(eq(labelingDocuments.id, documentId), eq(labelingDocuments.orgId, organizationId)))
    .limit(1);

  if (docs.length === 0) {
    return Response.json({ error: 'Document not found' }, { status: 404 });
  }

  const sections = await db
    .select()
    .from(labelingSections)
    .where(
      and(eq(labelingSections.documentId, documentId), eq(labelingSections.orgId, organizationId)),
    );

  return Response.json({ document: docs[0], sections });
});
