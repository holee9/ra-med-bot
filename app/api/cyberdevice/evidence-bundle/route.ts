// @MX:NOTE [AUTO] POST /api/cyberdevice/evidence-bundle — assemble submission bundle (REQ-009/012/014, AC-05).
// @MX:SPEC SPEC-REGULA-CYBERDEVICE-001 (REQ-009, REQ-012, REQ-014, AC-05)

import { withPermission } from '@/lib/auth/with-permission';
import { auditEvidenceBundled } from '@/lib/cyberdevice/audit';
import { assembleEvidenceBundle } from '@/lib/cyberdevice/evidence-bundle';
import { evidenceBundleInputSchema } from '@/lib/cyberdevice/types';
import { db } from '@/lib/db/client';
import { cyberEvidenceBundle, sbom, threatModel } from '@/lib/db/schema';
import { assertPmsProjectAccess } from '@/lib/pms/project-ownership';
import { eq } from 'drizzle-orm';

export const POST = withPermission('cyberdevice.manage', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const parsed = evidenceBundleInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const denied = await assertPmsProjectAccess(body.projectId, organizationId);
  if (denied) return denied;

  // IDOR: threat_model + sbom must belong to the same project + org.
  const [tm] = await db
    .select({ orgId: threatModel.orgId, projectId: threatModel.projectId })
    .from(threatModel)
    .where(eq(threatModel.id, body.threatModelId))
    .limit(1);
  if (!tm || tm.orgId !== organizationId || tm.projectId !== body.projectId) {
    return Response.json({ error: 'threat_model_not_found' }, { status: 404 });
  }
  const [sb] = await db
    .select({ orgId: sbom.orgId, projectId: sbom.projectId })
    .from(sbom)
    .where(eq(sbom.id, body.sbomId))
    .limit(1);
  if (!sb || sb.orgId !== organizationId || sb.projectId !== body.projectId) {
    return Response.json({ error: 'sbom_not_found' }, { status: 404 });
  }

  const assembled = assembleEvidenceBundle({
    threatModelId: body.threatModelId,
    sbomId: body.sbomId,
    pentestArtifactPath: body.pentestArtifactPath,
    updatePlan: body.updatePlan,
    linkedSamdId: body.linkedSamdId,
    linkedDhfId: body.linkedDhfId,
    linkedSubmissionId: body.linkedSubmissionId,
  });

  let bundleId = '';
  try {
    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(cyberEvidenceBundle)
        .values({
          orgId: organizationId,
          projectId: body.projectId,
          threatModelId: body.threatModelId,
          sbomId: body.sbomId,
          pentestArtifactPath: body.pentestArtifactPath ?? null,
          updatePlan: body.updatePlan,
          linkedSamdId: body.linkedSamdId ?? null,
          linkedDhfId: body.linkedDhfId ?? null,
          linkedSubmissionId: body.linkedSubmissionId ?? null,
          createdBy: session.user.id,
        })
        .returning({ id: cyberEvidenceBundle.id });
      if (!created) throw new Error('bundle_insert_failed');
      bundleId = created.id;
      await auditEvidenceBundled(
        {
          userId: session.user.id,
          bundleId,
          projectId: body.projectId,
          threatModelId: body.threatModelId,
          sbomId: body.sbomId,
          linkedSubmissionId: body.linkedSubmissionId,
        },
        tx,
      );
    });
  } catch (err) {
    console.error('[cyberdevice.evidence-bundle] insert failed', err);
    return Response.json({ error: 'persist_failed' }, { status: 500 });
  }

  return Response.json({ bundleId, ...assembled }, { status: 201 });
});
