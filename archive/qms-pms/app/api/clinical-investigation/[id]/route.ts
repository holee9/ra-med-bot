// @MX:NOTE [AUTO] GET /api/clinical-investigation/[id] — REQ-011 dashboard state.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-011, AC-05)

// @MX:LEGACY archived from app
// @MX:REASON Returns the investigation state + related counts for the dashboard.
//           Read-only — no audit row (view is already covered by dashboard.view).

import { withPermission } from '@/lib/auth/with-permission';
import { assertInvestigationAccess, resolveRouteId } from '@/lib/clinical-investigation/access';
import { db } from '@/lib/db/client';
import {
  ciDocuments,
  ciEvents,
  ciLinks,
  ciProtocols,
  clinicalInvestigations,
} from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export const GET = withPermission('clinical_investigation.view', async (_req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }
  const investigationId = await resolveRouteId(ctx);

  const investigation = await assertInvestigationAccess(investigationId, organizationId);
  if (!investigation) {
    return Response.json({ error: 'Investigation not found' }, { status: 404 });
  }

  const [protocol] = await db
    .select()
    .from(ciProtocols)
    .where(
      and(eq(ciProtocols.investigationId, investigationId), eq(ciProtocols.orgId, organizationId)),
    )
    .limit(1);

  const events = await db
    .select({ id: ciEvents.id, type: ciEvents.type })
    .from(ciEvents)
    .where(and(eq(ciEvents.investigationId, investigationId), eq(ciEvents.orgId, organizationId)));

  const documents = await db
    .select({
      id: ciDocuments.id,
      docType: ciDocuments.docType,
      reviewStatus: ciDocuments.reviewStatus,
    })
    .from(ciDocuments)
    .where(
      and(eq(ciDocuments.investigationId, investigationId), eq(ciDocuments.orgId, organizationId)),
    );

  const links = await db
    .select({ id: ciLinks.id, targetType: ciLinks.targetType, targetId: ciLinks.targetId })
    .from(ciLinks)
    .where(and(eq(ciLinks.investigationId, investigationId), eq(ciLinks.orgId, organizationId)));

  return Response.json({
    investigation: {
      id: investigation.id,
      pathway: investigation.pathway,
      necessityStatus: investigation.necessityStatus,
      approvalStatus: investigation.approvalStatus,
      projectId: investigation.projectId,
    },
    protocol: protocol ?? null,
    events,
    documents,
    links,
    counts: {
      events: events.length,
      documents: documents.length,
      links: links.length,
    },
  });
});
