// @MX:NOTE [AUTO] IDOR guard for project-memory routes (Issue #51).
// @MX:SPEC SPEC-REGULA-PROJECT-MEMORY-001 (AC-08, 21 CFR Part 11)
// @MX:REASON RLS is INERT project-wide (#239 debt), so org isolation MUST be
//           enforced at the query layer. withPermission('projectmemory.*')
//           proves the caller is a member of their OWN org — it does not bind
//           the request body projectId/memoryId to that org. Without this
//           guard, an org-A ra-lead could mutate org-B project memories
//           (cross-tenant corruption of design-control decisions). Mirrors the
//           knowledge-promo assertMessageInOrg pattern (lib/knowledge-promo/access.ts).
//
// AC-08: cross-org (IDOR) 403 denials MUST be audit logged. withPermission
// logs `rbac.permission_deny` for RBAC role failures, but the IDOR 403 below
// is a SEPARATE gate — if it returns 403 WITHOUT writing audit, a ra-lead
// attempting cross-org memory access leaves no trail (21 CFR Part 11 violation).
// The assert functions below write the denial audit row before returning 403.

import { writeAudit } from '@/lib/kernel/audit';
import { db } from '@/lib/kernel/db/client';
import { projectMemory, projects } from '@/lib/kernel/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Resolve the organizationId that owns `projectId`. Returns null when the
 * project does not exist.
 */
export async function resolveProjectOrg(projectId: string): Promise<string | null> {
  const [row] = await db
    .select({ orgId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return row?.orgId ?? null;
}

/**
 * IDOR guard: verify `projectId` belongs to `organizationId`.
 */
export async function projectBelongsToOrg(
  projectId: string,
  organizationId: string,
): Promise<boolean> {
  const orgId = await resolveProjectOrg(projectId);
  return orgId !== null && orgId === organizationId;
}

/**
 * Resolve the organizationId that owns a project_memory row via its parent
 * project. Returns null when the memory row does not exist.
 */
export async function resolveMemoryOrg(memoryId: string): Promise<string | null> {
  const [row] = await db
    .select({ orgId: projects.organizationId })
    .from(projectMemory)
    .innerJoin(projects, eq(projects.id, projectMemory.projectId))
    .where(eq(projectMemory.id, memoryId))
    .limit(1);
  return row?.orgId ?? null;
}

/**
 * IDOR guard: verify `memoryId` belongs to `organizationId`.
 */
export async function memoryBelongsToOrg(
  memoryId: string,
  organizationId: string,
): Promise<boolean> {
  const orgId = await resolveMemoryOrg(memoryId);
  return orgId !== null && orgId === organizationId;
}

/**
 * Parameters for the IDOR assert helpers (mirrors knowledge-promo shape).
 */
export interface AssertAccessParams {
  /** Caller's session user id (audit actor). */
  actorId: string;
  /** Caller's org id. */
  organizationId: string;
  /** Permission action for the denial audit meta. */
  action: string;
}

/**
 * Assert `projectId` belongs to the caller's org. Returns a 403 Response on
 * denial (with a `rbac.permission_deny` audit row already written), or null
 * on success. Route usage mirrors knowledge-promo:
 *
 *   const denied = await assertProjectInOrg(projectId, { actorId, organizationId, action });
 *   if (denied) return denied;
 */
export async function assertProjectInOrg(
  projectId: string,
  params: AssertAccessParams,
): Promise<Response | null> {
  const orgId = await resolveProjectOrg(projectId);
  if (orgId === null || orgId !== params.organizationId) {
    await writeAudit({
      actor_id: params.actorId,
      action: 'rbac.permission_deny',
      resource_type: 'projectMemory',
      resource_id: projectId,
      meta_json: {
        reason: 'idor_project_org_mismatch',
        attemptedAction: params.action,
        targetProjectId: projectId,
      },
    });
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  return null;
}

/**
 * Assert `memoryId` belongs to the caller's org. Returns a 403 Response on
 * denial (with audit row), or null on success.
 */
export async function assertMemoryInOrg(
  memoryId: string,
  params: AssertAccessParams,
): Promise<Response | null> {
  const orgId = await resolveMemoryOrg(memoryId);
  if (orgId === null || orgId !== params.organizationId) {
    await writeAudit({
      actor_id: params.actorId,
      action: 'rbac.permission_deny',
      resource_type: 'projectMemory',
      resource_id: memoryId,
      meta_json: {
        reason: 'idor_memory_org_mismatch',
        attemptedAction: params.action,
        targetMemoryId: memoryId,
      },
    });
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  return null;
}
