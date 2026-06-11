// GET /api/ra/impact/[assessmentId] — single assessment with action items.
// @MX:SPEC SPEC-REGULA-IMPACT-001

import { and, eq } from 'drizzle-orm';
import { withPermission } from '../../../../../lib/auth/with-permission';
import { db } from '../../../../../lib/db/client';
import {
  impactActionItems,
  projects,
  regulatoryImpactAssessments,
  regulatoryUpdates,
} from '../../../../../lib/db/schema';

export const GET = withPermission(
  'dashboard.view',
  async (_req, ctx, session) => {
    const params = ctx.params ? await ctx.params : {};
    const assessmentId = (params as { assessmentId?: string }).assessmentId ?? '';
    const orgId = session.user.organizationId;
    if (!orgId) {
      return Response.json({ error: 'Organization context required' }, { status: 400 });
    }

    const [row] = await db
      .select({
        id: regulatoryImpactAssessments.id,
        regulatory_update_id: regulatoryImpactAssessments.regulatoryUpdateId,
        update_title: regulatoryUpdates.title,
        update_region: regulatoryUpdates.region,
        project_id: regulatoryImpactAssessments.projectId,
        project_name: projects.name,
        impact_level: regulatoryImpactAssessments.impactLevel,
        affected_sections: regulatoryImpactAssessments.affectedSections,
        analysis_summary: regulatoryImpactAssessments.analysisSummary,
        confidence: regulatoryImpactAssessments.confidence,
        created_by: regulatoryImpactAssessments.createdBy,
        created_at: regulatoryImpactAssessments.createdAt,
      })
      .from(regulatoryImpactAssessments)
      .innerJoin(projects, eq(projects.id, regulatoryImpactAssessments.projectId))
      .innerJoin(
        regulatoryUpdates,
        eq(regulatoryUpdates.id, regulatoryImpactAssessments.regulatoryUpdateId),
      )
      .where(
        and(eq(regulatoryImpactAssessments.id, assessmentId), eq(projects.organizationId, orgId)),
      )
      .limit(1);

    if (!row) {
      return Response.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const actionItems = await db
      .select({
        id: impactActionItems.id,
        priority: impactActionItems.priority,
        document_type: impactActionItems.documentType,
        section_reference: impactActionItems.sectionReference,
        description: impactActionItems.description,
        status: impactActionItems.status,
        assigned_to: impactActionItems.assignedTo,
        created_at: impactActionItems.createdAt,
        resolved_at: impactActionItems.resolvedAt,
      })
      .from(impactActionItems)
      .where(eq(impactActionItems.assessmentId, assessmentId))
      .orderBy(impactActionItems.createdAt);

    return Response.json({ assessment: { ...row, action_items: actionItems } });
  },
);
