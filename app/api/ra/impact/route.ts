// GET /api/ra/impact — list regulatory impact assessments for the org.
// @MX:SPEC SPEC-REGULA-IMPACT-001

import { eq } from 'drizzle-orm';
import { withPermission } from '../../../../lib/kernel/auth/with-permission';
import { db } from '../../../../lib/kernel/db/client';
import {
  impactActionItems,
  projects,
  regulatoryImpactAssessments,
  regulatoryUpdates,
} from '../../../../lib/kernel/db/schema';

export const GET = withPermission('dashboard.view', async (_req, _ctx, session) => {
  const orgId = session.user.organizationId;
  if (!orgId) {
    return Response.json({ error: 'Organization context required' }, { status: 400 });
  }

  const assessments = await db
    .select({
      id: regulatoryImpactAssessments.id,
      regulatory_update_id: regulatoryImpactAssessments.regulatoryUpdateId,
      update_title: regulatoryUpdates.title,
      update_region: regulatoryUpdates.region,
      project_id: regulatoryImpactAssessments.projectId,
      project_name: projects.name,
      impact_level: regulatoryImpactAssessments.impactLevel,
      analysis_summary: regulatoryImpactAssessments.analysisSummary,
      confidence: regulatoryImpactAssessments.confidence,
      created_at: regulatoryImpactAssessments.createdAt,
    })
    .from(regulatoryImpactAssessments)
    .innerJoin(projects, eq(projects.id, regulatoryImpactAssessments.projectId))
    .innerJoin(
      regulatoryUpdates,
      eq(regulatoryUpdates.id, regulatoryImpactAssessments.regulatoryUpdateId),
    )
    .where(eq(projects.organizationId, orgId))
    .orderBy(regulatoryImpactAssessments.createdAt)
    .limit(200);

  // Attach open action item counts
  const withCounts = await Promise.all(
    assessments.map(async (a) => {
      const items = await db
        .select({ id: impactActionItems.id, status: impactActionItems.status })
        .from(impactActionItems)
        .where(eq(impactActionItems.assessmentId, a.id));
      return {
        ...a,
        action_items_total: items.length,
        action_items_open: items.filter((i) => i.status === 'open').length,
      };
    }),
  );

  return Response.json({ assessments: withCounts });
});
