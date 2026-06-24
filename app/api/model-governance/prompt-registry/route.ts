// @MX:NOTE [AUTO] POST/GET /api/model-governance/prompt-registry — immutable prompt registration.
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-001)
// @MX:REASON POST registers an immutable prompt/template version (dedup by content_hash).
//           GET lists versions. RBAC modelgov.manage (POST) / modelgov.view (GET).

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { auditPromptRegistered } from '@/lib/model-governance/audit';
import { listPrompts, registerPrompt } from '@/lib/model-governance/registry';
import { registerPromptInputSchema } from '@/lib/model-governance/types';

export const POST = withPermission('modelgov.manage', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const parsed = registerPromptInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  try {
    const prompt = await registerPrompt({
      orgId: organizationId,
      kind: input.kind,
      content: input.content,
      createdBy: session.user.id,
    });

    // REQ-MODELGOV-001 audit (21 CFR Part 11).
    await auditPromptRegistered({
      actorId: session.user.id,
      orgId: organizationId,
      resourceId: prompt.id,
      promptId: prompt.id,
      kind: prompt.kind,
      version: prompt.version,
      contentHash: prompt.contentHash,
    });

    return Response.json({ prompt }, { status: 201 });
  } catch (err) {
    await writeAudit({
      actor_id: session.user.id,
      action: 'modelgov.prompt_registered',
      resource_type: 'prompt_registry',
      resource_id: 'unknown',
      meta_json: {
        org_id: organizationId,
        error: err instanceof Error ? err.message : 'unknown',
      },
    });
    return Response.json({ error: 'Failed to register prompt' }, { status: 500 });
  }
});

export const GET = withPermission('modelgov.view', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const url = new URL(req.url);
  const kindParam = url.searchParams.get('kind');
  const kind = kindParam === 'prompt' || kindParam === 'template' ? kindParam : undefined;

  const prompts = await listPrompts(organizationId, kind);
  return Response.json({ prompts });
});
