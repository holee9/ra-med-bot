// @MX:NOTE [AUTO] POST /api/admin/predicate/cache/clear — flush the predicate KV cache.
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-022, REQ-PRE-029)
//
// REQ-PRE-022: dev-only cache invalidation. RA/Exec/External are denied (403).

// REQ-PRE-029: nodejs runtime required — department lookup uses the pg driver.
export const runtime = 'nodejs';

import { writeAudit } from '@/lib/kernel/audit';
import { canClearPredicateCache } from '@/lib/kernel/auth/predicate-permissions';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { db } from '@/lib/kernel/db/client';
import { users } from '@/lib/kernel/db/schema';
import { createPredicateCache } from '@/lib/predicate/cache';
import { eq } from 'drizzle-orm';

/** Fetch the caller's department; null when unset or the user row is missing. */
async function getDepartment(userId: string): Promise<string | null> {
  const rows = await db
    .select({ department: users.department })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.department ?? null;
}

/**
 * Resolve the predicate KV namespace. KV bindings are not yet threaded through
 * the Next-on-Workers context; the cache degrades to a no-op when unbound.
 */
function getKv(): KVNamespace | undefined {
  return (globalThis as { KV_PREDICATE_CACHE?: KVNamespace }).KV_PREDICATE_CACHE;
}

export const POST = withPermission('workflow.execute', async (_req, _ctx, session) => {
  // Department RBAC (REQ-PRE-022): dev only.
  const department = await getDepartment(session.user.id);
  if (!canClearPredicateCache(department)) {
    return Response.json({ error: 'permission_denied', reason: 'department' }, { status: 403 });
  }

  const cache = createPredicateCache(getKv());
  await cache.invalidateAll();
  await writeAudit({
    actor_id: session.user.id,
    action: 'workflow.edit',
    resource_type: 'predicate_cache',
    resource_id: 'global',
    meta_json: { department },
  });

  return Response.json({ cleared: true });
});
