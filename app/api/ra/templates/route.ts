// @MX:NOTE [AUTO] GET /api/ra/templates — list available templates.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-019)

import { withPermission } from '../../../../lib/kernel/auth/with-permission';
import { db } from '../../../../lib/kernel/db/client';
import { templates } from '../../../../lib/kernel/db/schema';

export const GET = withPermission('dashboard.view', async () => {
  const rows = await db
    .select({
      id: templates.id,
      title: templates.title,
      description: templates.description,
      region: templates.region,
      category: templates.category,
      usageCount: templates.usageCount,
      createdAt: templates.createdAt,
    })
    .from(templates)
    .orderBy(templates.title);

  return Response.json({ templates: rows });
});
