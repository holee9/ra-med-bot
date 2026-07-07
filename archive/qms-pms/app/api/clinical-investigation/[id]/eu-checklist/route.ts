// @MX:NOTE [AUTO] GET /api/clinical-investigation/[id]/eu-checklist — REQ-003.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69, REQ-CLININV-003, AC-02)

// @MX:LEGACY archived from app

import { withPermission } from '@/lib/auth/with-permission';
import { assertInvestigationAccess, resolveRouteId } from '@/lib/clinical-investigation/access';
import { buildEuMdrChecklist } from '@/lib/clinical-investigation/eu-checklist';

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

  const checklist = buildEuMdrChecklist([]);

  return Response.json({
    investigationId,
    pathway: 'eu_mdr',
    items: checklist.items,
    citations: checklist.citations,
  });
});
