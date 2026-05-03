// @MX:NOTE [AUTO] GET /api/ra/dashboard — dashboard stats stub.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-019)

import { withPermission } from '../../../../lib/auth/with-permission';

export const GET = withPermission('dashboard.view', async (_req, _ctx, session) => {
  // Stub: return basic org context. Full stats query will be added in a later phase.
  return Response.json({ orgId: session.user.organizationId, stats: {} });
});
