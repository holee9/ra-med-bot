// @MX:NOTE [AUTO] GET /api/ra/updates — regulatory updates feed.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-019)

import { withPermission } from '../../../../lib/auth/with-permission';
import { db } from '../../../../lib/db/client';
import { regulatoryUpdates } from '../../../../lib/db/schema';

export const GET = withPermission('dashboard.view', async () => {
  const rows = await db
    .select({
      id: regulatoryUpdates.id,
      title: regulatoryUpdates.title,
      region: regulatoryUpdates.region,
      severity: regulatoryUpdates.severity,
      publishedAt: regulatoryUpdates.publishedAt,
      sourceUrl: regulatoryUpdates.sourceUrl,
      affectedProductTypes: regulatoryUpdates.affectedProductTypes,
    })
    .from(regulatoryUpdates)
    .orderBy(regulatoryUpdates.publishedAt);

  return Response.json({ updates: rows });
});
