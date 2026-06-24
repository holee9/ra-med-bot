// @MX:NOTE [AUTO] POST /api/cyberdevice/evidence-bundle — assemble submission bundle (REQ-009/012/014, AC-05).
// @MX:SPEC SPEC-REGULA-CYBERDEVICE-001 (REQ-009, REQ-012, REQ-014, AC-05)

import { withPermission } from '@/lib/auth/with-permission';
import { auditCyberAccessDenied, auditEvidenceBundled } from '@/lib/cyberdevice/audit';
import { assembleEvidenceBundle } from '@/lib/cyberdevice/evidence-bundle';
import { verifyLinkedReferentExists } from '@/lib/cyberdevice/linkage';
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
  // REQ-013: cross-tenant denial produces a cyber.access_denied audit row.
  const [tm] = await db
    .select({ orgId: threatModel.orgId, projectId: threatModel.projectId })
    .from(threatModel)
    .where(eq(threatModel.id, body.threatModelId))
    .limit(1);
  if (!tm || tm.orgId !== organizationId || tm.projectId !== body.projectId) {
    if (tm && tm.orgId !== organizationId) {
      await auditCyberAccessDenied({
        userId: session.user.id,
        projectId: body.projectId,
        reason: 'threat_model_cross_org',
      });
    }
    return Response.json({ error: 'threat_model_not_found' }, { status: 404 });
  }
  const [sb] = await db
    .select({ orgId: sbom.orgId, projectId: sbom.projectId })
    .from(sbom)
    .where(eq(sbom.id, body.sbomId))
    .limit(1);
  if (!sb || sb.orgId !== organizationId || sb.projectId !== body.projectId) {
    if (sb && sb.orgId !== organizationId) {
      await auditCyberAccessDenied({
        userId: session.user.id,
        projectId: body.projectId,
        reason: 'sbom_cross_org',
      });
    }
    return Response.json({ error: 'sbom_not_found' }, { status: 404 });
  }

  // C-1 fix: validate each non-null linked_* referent exists AND belongs to the
  // caller's org before persisting. Without this, a caller could link another
  // org's SaMD/DHF/Submission or a dangling UUID. Native FK is blocked by a
  // uuid-vs-text type mismatch (see 0079 migration), so this in-app check is
  // the authoritative guard. Mirrors lib/clinical-investigation/linkage.ts
  // verifyLinkTargetExists (H-4 pattern).
  if (body.linkedSamdId) {
    const ok = await verifyLinkedReferentExists(organizationId, 'samd', body.linkedSamdId);
    if (!ok) {
      await auditCyberAccessDenied({
        userId: session.user.id,
        projectId: body.projectId,
        reason: 'linked_samd_cross_org_or_missing',
      });
      return Response.json({ error: 'linked_samd_not_found' }, { status: 404 });
    }
  }
  if (body.linkedDhfId) {
    const ok = await verifyLinkedReferentExists(organizationId, 'dhf', body.linkedDhfId);
    if (!ok) {
      await auditCyberAccessDenied({
        userId: session.user.id,
        projectId: body.projectId,
        reason: 'linked_dhf_cross_org_or_missing',
      });
      return Response.json({ error: 'linked_dhf_not_found' }, { status: 404 });
    }
  }
  if (body.linkedSubmissionId) {
    const ok = await verifyLinkedReferentExists(
      organizationId,
      'submission',
      body.linkedSubmissionId,
    );
    if (!ok) {
      await auditCyberAccessDenied({
        userId: session.user.id,
        projectId: body.projectId,
        reason: 'linked_submission_cross_org_or_missing',
      });
      return Response.json({ error: 'linked_submission_not_found' }, { status: 404 });
    }
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
