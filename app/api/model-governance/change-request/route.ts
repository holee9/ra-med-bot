// @MX:NOTE [AUTO] POST/GET /api/model-governance/change-request — change request + eval trigger.
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-004/005)

import { withPermission } from '@/lib/auth/with-permission';
import { withTenantScope } from '@/lib/db/client';
import { changeRequest } from '@/lib/db/schema';
import { assertModelPinAccess, assertPromptAccess } from '@/lib/model-governance/access';
import { createChangeRequest } from '@/lib/model-governance/change-workflow';
import { createChangeRequestInputSchema } from '@/lib/model-governance/types';
import { eq } from 'drizzle-orm';

/* audit-check-ignore: audit is written inside createChangeRequest() (change-workflow)
   within the same tx (21 CFR Part 11 atomicity) — route-level writeAudit would duplicate */
export const POST = withPermission('modelgov.manage', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const parsed = createChangeRequestInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // IDOR defense — verify prompt + model_pin belong to this org (404 on miss).
  const promptOk = await assertPromptAccess(input.promptId, organizationId);
  if (!promptOk) {
    return Response.json({ error: 'Prompt not found' }, { status: 404 });
  }
  const pinOk = await assertModelPinAccess(input.modelPinId, organizationId);
  if (!pinOk) {
    return Response.json({ error: 'Model pin not found' }, { status: 404 });
  }

  try {
    const result = await createChangeRequest({
      orgId: organizationId,
      promptId: input.promptId,
      modelPinId: input.modelPinId,
      evalRunId: input.evalRunId,
      createdBy: session.user.id,
    });
    return Response.json({ changeRequest: result }, { status: 201 });
  } catch {
    return Response.json({ error: 'Failed to create change request' }, { status: 500 });
  }
});

export const GET = withPermission('modelgov.view', async (_req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  // #239 Phase 2: withTenantScope sets app.current_org_id GUC for RLS enforce.
  const rows = await withTenantScope(organizationId, async (dbs) =>
    dbs.select().from(changeRequest).where(eq(changeRequest.orgId, organizationId)),
  );
  return Response.json({ changeRequests: rows });
});
