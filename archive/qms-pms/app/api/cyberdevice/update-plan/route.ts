// @MX:NOTE [AUTO] POST /api/cyberdevice/update-plan — secure update / patch / EOS plan (REQ-007).
// @MX:SPEC SPEC-REGULA-CYBERDEVICE-001 (REQ-007)

import { withPermission } from '@/lib/auth/with-permission';
import { auditUpdatePlanCreated } from '@/lib/cyberdevice/audit';
import { updatePlanInputSchema } from '@/lib/cyberdevice/types';
import { generateUpdatePlan } from '@/lib/cyberdevice/update-plan';
import { withTenantScope } from '@/lib/db/client';
import { cyberEvidenceBundle } from '@/lib/db/schema';
import { assertPmsProjectAccess } from '@/lib/pms/project-ownership';

export const POST = withPermission('cyberdevice.manage', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const parsed = updatePlanInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const denied = await assertPmsProjectAccess(body.projectId, organizationId);
  if (denied) return denied;

  const plan = generateUpdatePlan(body);

  let bundleId = '';
  try {
    // #239 Phase 2: withTenantScope sets app.current_org_id GUC for RLS enforce.
    await withTenantScope(organizationId, async (tx) => {
      const [created] = await tx
        .insert(cyberEvidenceBundle)
        .values({
          orgId: organizationId,
          projectId: body.projectId,
          updatePlan: plan,
          createdBy: session.user.id,
        })
        .returning({ id: cyberEvidenceBundle.id });
      if (!created) throw new Error('bundle_insert_failed');
      bundleId = created.id;
      await auditUpdatePlanCreated(
        {
          userId: session.user.id,
          projectId: body.projectId,
          bundleId,
          patchCadenceDays: plan.patchCadenceDays,
          endOfSupportDate: plan.endOfSupportDate,
        },
        tx,
      );
    });
  } catch (err) {
    console.error('[cyberdevice.update-plan] insert failed', err);
    return Response.json({ error: 'persist_failed' }, { status: 500 });
  }

  return Response.json({ bundleId, updatePlan: plan }, { status: 201 });
});
