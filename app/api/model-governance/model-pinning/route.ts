// @MX:NOTE [AUTO] POST/GET /api/model-governance/model-pinning — model pin registration.
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-002/003)

import { withPermission } from '@/lib/auth/with-permission';
import { listModelPins, registerModelPin } from '@/lib/model-governance/model-pinning';
import { registerModelPinInputSchema } from '@/lib/model-governance/types';

export const POST = withPermission('modelgov.manage', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const parsed = registerModelPinInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  try {
    const pin = await registerModelPin({
      orgId: organizationId,
      provider: input.provider,
      modelId: input.modelId,
      modelVersion: input.modelVersion,
      retrievalConfig: input.retrievalConfig,
      createdBy: session.user.id,
    });
    return Response.json({ modelPin: pin }, { status: 201 });
  } catch {
    return Response.json({ error: 'Failed to register model pin' }, { status: 500 });
  }
});

export const GET = withPermission('modelgov.view', async (_req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const modelPins = await listModelPins(organizationId);
  return Response.json({ modelPins });
});
