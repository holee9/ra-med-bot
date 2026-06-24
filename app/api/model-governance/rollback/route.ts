// @MX:NOTE [AUTO] POST /api/model-governance/rollback — revert to previous approved combination.
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-006, AC-03)

import { withPermission } from '@/lib/auth/with-permission';
import { RollbackError, rollbackCombination } from '@/lib/model-governance/rollback';
import { rollbackInputSchema } from '@/lib/model-governance/types';

export const POST = withPermission('modelgov.manage', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const parsed = rollbackInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  try {
    const result = await rollbackCombination({
      orgId: organizationId,
      actorId: session.user.id,
      toCombinationId: input.toCombinationId,
    });
    return Response.json({ fromId: result.fromId, toId: result.toId });
  } catch (err) {
    if (err instanceof RollbackError) {
      const status = err.reason.includes('not_found') ? 404 : 409;
      return Response.json({ error: err.reason }, { status });
    }
    return Response.json({ error: 'Failed to rollback' }, { status: 500 });
  }
});
