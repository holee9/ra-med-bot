// @MX:NOTE [AUTO] PATCH/DELETE /api/project-memory/[id] — update + invalidate (Issue #51).
// @MX:SPEC SPEC-REGULA-PROJECT-MEMORY-001 (REQ-008, REQ-009, REQ-011, REQ-012, AC-07, AC-08)
// @MX:REASON Charter [지양-4]: both require ra-lead (projectmemory.manage).
//   PATCH = same-key supersession (invalidate old + create new in ONE tx, REQ-012).
//   DELETE = soft-invalidate (valid_until + status; hard delete forbidden).
//   21 CFR Part 11 atomicity via updateMemory / invalidateMemory.
//   IDOR guard (assertMemoryInOrg) before any write.

import { withPermission } from '@/lib/kernel/auth/with-permission';
import { assertMemoryInOrg } from '@/lib/project-memory/access';
import { invalidateMemory, updateMemory } from '@/lib/project-memory/manager';
import { z } from 'zod';

const MemoryTypeSchema = z.enum([
  'device_classification',
  'target_markets',
  'submission_strategy',
  'predicate_device',
  'risk_class',
  'custom',
]);

const PatchMemorySchema = z.object({
  memoryType: MemoryTypeSchema,
  key: z.string().min(1).max(200),
  value: z.string().min(1).max(2000),
  sourceConversationId: z.string().uuid().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
});

// PATCH /api/project-memory/[id] — same-key supersession (ra-lead only).
/* audit-check-ignore: audit (memory action) is written inside updateMemory() /
   invalidateMemory() within the same tx (21 CFR Part 11 atomicity) — route-level
   writeAudit would duplicate */
export const PATCH = withPermission('projectmemory.manage', async (req, ctx, session) => {
  const params = ctx.params && 'then' in ctx.params ? await ctx.params : (ctx.params ?? {});
  const memoryId = params?.id;
  if (typeof memoryId !== 'string') {
    return Response.json({ error: 'missing_id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = PatchMemorySchema.safeParse(body);
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
  const denied = await assertMemoryInOrg(memoryId, {
    actorId: session.user.id,
    organizationId: orgId,
    action: 'projectmemory.manage',
  });
  if (denied) return denied;

  try {
    const result = await updateMemory({
      memoryId,
      memoryType: input.memoryType,
      key: input.key,
      value: input.value,
      sourceConversationId: input.sourceConversationId ?? null,
      userId: session.user.id,
      orgId,
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
    });
    return Response.json(result);
  } catch (err) {
    // Concurrent same-key update hit the partial UNIQUE index → 409.
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return Response.json({ error: 'memory_duplicate_active_key' }, { status: 409 });
    }
    return Response.json({ error: 'memory_update_failed' }, { status: 500 });
  }
});

// DELETE /api/project-memory/[id] — soft-invalidate (ra-lead only).
export const DELETE = withPermission('projectmemory.manage', async (_req, ctx, session) => {
  const params = ctx.params && 'then' in ctx.params ? await ctx.params : (ctx.params ?? {});
  const memoryId = params?.id;
  if (typeof memoryId !== 'string') {
    return Response.json({ error: 'missing_id' }, { status: 400 });
  }

  const orgId = session.user.organizationId ?? '';
  if (!orgId) return Response.json({ error: 'no_org_context' }, { status: 403 });

  // IDOR guard (AC-08).
  const denied = await assertMemoryInOrg(memoryId, {
    actorId: session.user.id,
    organizationId: orgId,
    action: 'projectmemory.manage',
  });
  if (denied) return denied;

  try {
    const result = await invalidateMemory({ memoryId, userId: session.user.id, orgId });
    return Response.json(result);
  } catch {
    return Response.json({ error: 'memory_invalidate_failed' }, { status: 500 });
  }
});
