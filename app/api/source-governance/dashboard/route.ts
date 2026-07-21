// @MX:NOTE [AUTO] GET /api/source-governance/dashboard — governance dashboard data.
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48, REQ-SOURCE-GOV-012/014, AC-06)
//
// RBAC: sourcegov.view (ra-member+). Returns counts (approved/pending/stale/
// superseded), the 30-day review-due list, and stale-citation artifacts.

import { withPermission } from '@/lib/kernel/auth/with-permission';
import { getGovernanceDashboard } from '@/lib/source-governance/dashboard';

export const GET = withPermission('sourcegov.view', async (_req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const dashboard = await getGovernanceDashboard({ orgId: organizationId });
  return Response.json(dashboard, { status: 200 });
});
