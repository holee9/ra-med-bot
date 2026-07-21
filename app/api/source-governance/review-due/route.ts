// @MX:NOTE [AUTO] GET /api/source-governance/review-due — review-due source list.
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48, REQ-SOURCE-GOV-013)
//
// RBAC: sourcegov.view (ra-member+). Returns sources whose review_cycle has
// elapsed or will within 30 days. Optional ?days=N query overrides the window.

import { withPermission } from '@/lib/kernel/auth/with-permission';
import { getReviewDueSources } from '@/lib/source-governance/review-notifier';

export const GET = withPermission('sourcegov.view', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const url = new URL(req.url);
  const daysParam = url.searchParams.get('days');
  const withinDays = daysParam ? Number.parseInt(daysParam, 10) : undefined;

  if (withinDays !== undefined && (!Number.isFinite(withinDays) || withinDays <= 0)) {
    return Response.json({ error: 'invalid_days' }, { status: 400 });
  }

  const reviewDue = await getReviewDueSources({ orgId: organizationId, withinDays });
  return Response.json({ reviewDue }, { status: 200 });
});
