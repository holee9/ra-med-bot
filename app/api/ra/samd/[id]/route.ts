// GET /api/ra/samd/[id] — fetch single SaMD assessment.
// PATCH /api/ra/samd/[id] — update assessment fields (or approve expert review).
// @MX:SPEC SPEC-REGULA-SAMD-001

import { classifySaMD } from '@/lib/samd/imdrf-matrix';
import type { AiMlType, ImdrfClinicalSituation, ImdrfHealthcareSituation } from '@/lib/samd/imdrf-matrix';
import { withPermission } from '@/lib/auth/with-permission';
import { writeAudit } from '@/lib/audit';
import { db } from '@/lib/db/client';
import { samdAssessments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const PatchSaMDSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  device_description: z.string().min(10).optional(),
  intended_use: z.string().min(10).optional(),
  ai_ml_type: z.enum(['locked', 'adaptive', 'continuously_learning']).optional(),
  imdrf_clinical_situation: z.enum(['critical', 'serious', 'non_serious']).optional(),
  imdrf_healthcare_situation: z.enum(['critical', 'serious', 'non_serious']).optional(),
  project_id: z.string().nullable().optional(),
  status: z.enum(['draft', 'in_review', 'approved', 'archived']).optional(),
  // Expert review approval — requires approved_by
  expert_review_approved_by: z.string().optional(),
});

export const GET = withPermission('dashboard.view', async (_req, ctx, session) => {
  const orgId = session.user.organizationId;
  if (!orgId) {
    return Response.json({ error: 'Organization context required' }, { status: 400 });
  }

  const params = ctx.params ? await ctx.params : {};
  const id = (params as { id?: string }).id;
  if (!id) {
    return Response.json({ error: 'Missing assessment ID' }, { status: 400 });
  }

  const [assessment] = await db
    .select()
    .from(samdAssessments)
    .where(and(eq(samdAssessments.id, id), eq(samdAssessments.orgId, orgId)))
    .limit(1);

  if (!assessment) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json({ assessment });
});

export const PATCH = withPermission('dashboard.view', async (req, ctx, session) => {
  const orgId = session.user.organizationId;
  if (!orgId) {
    return Response.json({ error: 'Organization context required' }, { status: 400 });
  }

  const params = ctx.params ? await ctx.params : {};
  const id = (params as { id?: string }).id;
  if (!id) {
    return Response.json({ error: 'Missing assessment ID' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PatchSaMDSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Re-run classification if IMDRF inputs changed
  const [existing] = await db
    .select()
    .from(samdAssessments)
    .where(and(eq(samdAssessments.id, id), eq(samdAssessments.orgId, orgId)))
    .limit(1);

  if (!existing) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const aiMlType = (data.ai_ml_type ?? existing.aiMlType) as AiMlType;
  const clinicalSituation = (data.imdrf_clinical_situation ?? existing.imdrfClinicalSituation) as ImdrfClinicalSituation;
  const healthcareSituation = (data.imdrf_healthcare_situation ?? existing.imdrfHealthcareSituation) as ImdrfHealthcareSituation;

  const classification = classifySaMD(aiMlType, clinicalSituation, healthcareSituation);

  const isApproval = !!data.expert_review_approved_by;

  const [updated] = await db
    .update(samdAssessments)
    .set({
      ...(data.title !== undefined && { title: data.title }),
      ...(data.device_description !== undefined && { deviceDescription: data.device_description }),
      ...(data.intended_use !== undefined && { intendedUse: data.intended_use }),
      ...(data.ai_ml_type !== undefined && { aiMlType: data.ai_ml_type }),
      ...(data.imdrf_clinical_situation !== undefined && {
        imdrfClinicalSituation: data.imdrf_clinical_situation,
      }),
      ...(data.imdrf_healthcare_situation !== undefined && {
        imdrfHealthcareSituation: data.imdrf_healthcare_situation,
      }),
      ...(data.project_id !== undefined && { projectId: data.project_id }),
      ...(data.status !== undefined && { status: data.status }),
      imdrfCategory: classification.imdrfCategory,
      fdaPathway: classification.fdaPathway,
      euAiRiskLevel: classification.euAiRiskLevel,
      pccpRequired: classification.pccpRequired,
      ...(isApproval && {
        expertReviewApprovedBy: data.expert_review_approved_by,
        expertReviewApprovedAt: new Date(),
        status: 'approved',
      }),
      updatedAt: new Date(),
    })
    .where(and(eq(samdAssessments.id, id), eq(samdAssessments.orgId, orgId)))
    .returning();

  if (!updated) {
    return Response.json({ error: 'Update failed' }, { status: 500 });
  }

  await writeAudit({
    actor_id: session.user.id,
    action: isApproval ? 'samd_review_approved' : 'samd_assessment_updated',
    resource_type: 'samd_assessment',
    resource_id: id,
    meta_json: { imdrf_category: classification.imdrfCategory },
  });

  return Response.json({ assessment: updated });
});
