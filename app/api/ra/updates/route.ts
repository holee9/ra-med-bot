// @MX:NOTE [AUTO] GET /api/ra/updates — regulatory updates feed with radar filters.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-019)
// Extended in Phase 10 with: impact_min, region, product_category, impact_type filters.

import { and, eq, gte, sql } from 'drizzle-orm';
import { withPermission } from '../../../../lib/auth/with-permission';
import { db } from '../../../../lib/db/client';
import { regulatoryUpdates } from '../../../../lib/db/schema';

export const GET = withPermission('dashboard.view', async (req) => {
  const { searchParams } = new URL(req.url);

  const impact_min = searchParams.get('impact_min');
  const region = searchParams.get('region');
  const impact_type = searchParams.get('impact_type');

  const conditions = [];

  if (impact_min) {
    const threshold = Number.parseFloat(impact_min);
    if (!Number.isNaN(threshold)) {
      conditions.push(gte(regulatoryUpdates.impactScore, String(threshold)));
    }
  }

  if (region) {
    conditions.push(eq(regulatoryUpdates.region, region));
  }

  if (impact_type) {
    conditions.push(eq(regulatoryUpdates.impactTypeHint, impact_type));
  }

  const rows = await db
    .select({
      id: regulatoryUpdates.id,
      title: regulatoryUpdates.title,
      region: regulatoryUpdates.region,
      severity: regulatoryUpdates.severity,
      publishedAt: regulatoryUpdates.publishedAt,
      sourceUrl: regulatoryUpdates.sourceUrl,
      affectedProductTypes: regulatoryUpdates.affectedProductTypes,
      sourceCrawler: regulatoryUpdates.sourceCrawler,
      externalId: regulatoryUpdates.externalId,
      impactTypeHint: regulatoryUpdates.impactTypeHint,
      impactScore: regulatoryUpdates.impactScore,
      tier1Relevant: regulatoryUpdates.tier1Relevant,
    })
    .from(regulatoryUpdates)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${regulatoryUpdates.publishedAt} DESC`);

  return Response.json({ updates: rows });
});
