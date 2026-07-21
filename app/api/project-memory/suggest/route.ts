// @MX:NOTE [AUTO] GET /api/project-memory/suggest — list pending AI suggestions (Issue #51).
// @MX:SPEC SPEC-REGULA-PROJECT-MEMORY-001 (REQ-006, AC-04 backend)
// @MX:REASON RA-lead review UI reads pending suggestions here. RBAC: ra-member+
//   (projectmemory.view) — any RA member can see the review queue; only
//   projectmemory.manage (ra-lead) can approve. IDOR guard (assertProjectInOrg).

import { withPermission } from '@/lib/kernel/auth/with-permission';
import { assertProjectInOrg } from '@/lib/project-memory/access';
import { getPendingMemories } from '@/lib/project-memory/manager';
import { z } from 'zod';

const ListQuerySchema = z.object({
  projectId: z.string().uuid(),
});

export const GET = withPermission('projectmemory.view', async (req, _ctx, session) => {
  const url = new URL(req.url);
  const parsed = ListQuerySchema.safeParse({ projectId: url.searchParams.get('projectId') });
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const orgId = session.user.organizationId ?? '';
  if (!orgId) return Response.json({ error: 'no_org_context' }, { status: 403 });

  const denied = await assertProjectInOrg(parsed.data.projectId, {
    actorId: session.user.id,
    organizationId: orgId,
    action: 'projectmemory.view',
  });
  if (denied) return denied;

  const pending = await getPendingMemories(parsed.data.projectId, orgId);
  return Response.json({ suggestions: pending });
});
