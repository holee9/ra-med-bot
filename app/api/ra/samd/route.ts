// GET /api/ra/samd — list SaMD assessments for org.
// POST /api/ra/samd — create new SaMD assessment with IMDRF N12 classification.
// @MX:SPEC SPEC-REGULA-SAMD-001

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { samdAssessments } from '@/lib/db/schema';
import { classifySaMD } from '@/lib/samd/imdrf-matrix';
import type {
  AiMlType,
  ImdrfClinicalSituation,
  ImdrfHealthcareSituation,
} from '@/lib/samd/imdrf-matrix';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

const CreateSaMDSchema = z.object({
  title: z.string().min(1).max(255),
  device_description: z.string().min(10),
  intended_use: z.string().min(10),
  ai_ml_type: z.enum(['locked', 'adaptive', 'continuously_learning']),
  imdrf_clinical_situation: z.enum(['critical', 'serious', 'non_serious']),
  imdrf_healthcare_situation: z.enum(['critical', 'serious', 'non_serious']),
  project_id: z.string().optional(),
});

export const GET = withPermission('dashboard.view', async (_req, _ctx, session) => {
  const orgId = session.user.organizationId;
  if (!orgId) {
    return Response.json({ error: 'Organization context required' }, { status: 400 });
  }

  const assessments = await db
    .select()
    .from(samdAssessments)
    .where(eq(samdAssessments.orgId, orgId))
    .orderBy(desc(samdAssessments.createdAt))
    .limit(200);

  return Response.json({ assessments });
});

export const POST = withPermission('dashboard.view', async (req, _ctx, session) => {
  const orgId = session.user.organizationId;
  if (!orgId) {
    return Response.json({ error: 'Organization context required' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = CreateSaMDSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const classification = classifySaMD(
    data.ai_ml_type as AiMlType,
    data.imdrf_clinical_situation as ImdrfClinicalSituation,
    data.imdrf_healthcare_situation as ImdrfHealthcareSituation,
  );

  const [created] = await db
    .insert(samdAssessments)
    .values({
      orgId,
      projectId: data.project_id ?? null,
      title: data.title,
      deviceDescription: data.device_description,
      intendedUse: data.intended_use,
      aiMlType: data.ai_ml_type,
      imdrfClinicalSituation: data.imdrf_clinical_situation,
      imdrfHealthcareSituation: data.imdrf_healthcare_situation,
      imdrfCategory: classification.imdrfCategory,
      fdaPathway: classification.fdaPathway,
      euAiRiskLevel: classification.euAiRiskLevel,
      pccpRequired: classification.pccpRequired,
      createdBy: session.user.id,
    })
    .returning();

  if (!created) {
    return Response.json({ error: 'Insert failed' }, { status: 500 });
  }

  await writeAudit({
    actor_id: session.user.id,
    action: 'samd_assessment_created',
    resource_type: 'samd_assessment',
    resource_id: created.id,
    meta_json: { title: data.title, imdrf_category: classification.imdrfCategory },
  });

  return Response.json({ assessment: created }, { status: 201 });
});
