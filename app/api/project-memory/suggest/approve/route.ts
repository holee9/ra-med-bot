// @MX:NOTE [AUTO] POST /api/project-memory/suggest/approve — approve AI suggestion (Issue #51).
// @MX:SPEC SPEC-REGULA-PROJECT-MEMORY-001 (REQ-005, REQ-014, AC-04, AC-08)
// @MX:REASON Charter [지양-4] / REQ-005: pending -> active is the ONLY path from
//   AI suggestion to authoritative memory, and it requires explicit ra-lead
//   approval (projectmemory.manage). approveSuggestedMemory sets createdBy =
//   approver (REQ-014) + writes memory_created audit in ONE tx (21 CFR Part 11).
//   IDOR guard (assertMemoryInOrg) before any write.

import { withPermission } from '@/lib/auth/with-permission';
import { assertMemoryInOrg } from '@/lib/project-memory/access';
import { approveSuggestedMemory } from '@/lib/project-memory/manager';
import { z } from 'zod';

const ApproveSchema = z.object({
  memoryId: z.string().uuid(),
});

export const POST = withPermission('projectmemory.manage', async (req, _ctx, session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = ApproveSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const orgId = session.user.organizationId ?? '';
  if (!orgId) return Response.json({ error: 'no_org_context' }, { status: 403 });

  // IDOR guard (AC-08).
  const denied = await assertMemoryInOrg(input.memoryId, {
    actorId: session.user.id,
    organizationId: orgId,
    action: 'projectmemory.manage',
  });
  if (denied) return denied;

  try {
    const result = await approveSuggestedMemory({
      memoryId: input.memoryId,
      userId: session.user.id,
      orgId,
    });
    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    if (msg === 'memory_approve_target_missing' || msg === 'memory_approve_state_error') {
      return Response.json({ error: msg }, { status: 409 });
    }
    return Response.json({ error: 'memory_approve_failed' }, { status: 500 });
  }
});
