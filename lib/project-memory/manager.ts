// @MX:NOTE [AUTO] Project memory lifecycle — create / update / invalidate / approve.
// @MX:SPEC SPEC-REGULA-PROJECT-MEMORY-001 (REQ-001, REQ-007~014, AC-01, AC-05, AC-07)
// @MX:REASON 21 CFR Part 11 atomicity: every mutation wraps the data change +
//   writeAudit in ONE withTenantScope tx so a crash between them cannot leave
//   a memory row without an audit trail (C-3 defect class, recurred 4× in
//   knowledge-promo #50). Charter [지양-4] no auto-finalize: status='pending'
//   rows NEVER become 'active' without an explicit approve API call (REQ-005).
//   REQ-012 same-key update = invalidate old + create new in ONE tx; the
//   partial UNIQUE index (WHERE status='active') is the DB-level atomicity guard.

import { writeAudit } from '@/lib/kernel/audit';
import { db, withTenantScope } from '@/lib/kernel/db/client';
import { projectMemory, type projectMemoryStatusEnum } from '@/lib/kernel/db/schema';
import { logger } from '@/lib/observability/logger';
import { and, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { memoryBelongsToOrg, projectBelongsToOrg } from './access';

// @MX:NOTE [AUTO] status type re-export for type-safe API params.
type MemoryStatus = (typeof projectMemoryStatusEnum.enumValues)[number];

export interface CreateMemoryParams {
  projectId: string;
  memoryType:
    | 'device_classification'
    | 'target_markets'
    | 'submission_strategy'
    | 'predicate_device'
    | 'risk_class'
    | 'custom';
  key: string;
  value: string;
  /** REQ-013: provenance. NULL for RA-lead manual entries (Charter [지양-2]). */
  sourceConversationId?: string | null;
  /** RA-lead user id (audit actor + row.created_by). */
  userId: string;
  orgId: string;
  /**
   * Lifecycle status. 'active' for explicit RA-lead creates (default).
   * 'pending' for AI-extracted suggestions awaiting approval (extractor only).
   */
  status?: 'active' | 'pending';
  validUntil?: Date | null;
}

export interface UpdateMemoryParams {
  /** Existing memory row to supersede. */
  memoryId: string;
  memoryType: CreateMemoryParams['memoryType'];
  key: string;
  value: string;
  sourceConversationId?: string | null;
  userId: string;
  orgId: string;
  validUntil?: Date | null;
}

export interface InvalidateMemoryParams {
  memoryId: string;
  userId: string;
  orgId: string;
}

export interface ApproveSuggestedMemoryParams {
  memoryId: string;
  /** Approving RA-lead user id (becomes createdBy, REQ-014). */
  userId: string;
  orgId: string;
}

/**
 * REQ-001 / REQ-007 / AC-01: create a project memory row. Atomic: INSERT +
 * writeAudit('memory_created') in ONE tx. Default status='active' (explicit
 * RA-lead create via API). The extractor passes status='pending' (Charter
 * [지양-4] / REQ-005 — pending rows are excluded from injection + getValidMemories).
 *
 * Preconditions (enforced by the route layer):
 *   - Caller has projectmemory.manage RBAC (withPermission).
 *   - `projectId` belongs to `orgId` (assertProjectInOrg IDOR guard).
 * Throws 'memory_not_in_org' on IDOR failure (defense-in-depth).
 */
export async function createMemory(
  params: CreateMemoryParams,
): Promise<{ id: string; status: MemoryStatus }> {
  const { projectId, memoryType, key, value, userId, orgId } = params;
  const status = params.status ?? 'active';
  const sourceConversationId = params.sourceConversationId ?? null;

  // Defense-in-depth: the route already ran assertProjectInOrg, but the lib
  // function is also called from extractor/tests — re-check.
  const inOrg = await projectBelongsToOrg(projectId, orgId);
  if (!inOrg) {
    throw new Error('project_not_in_org');
  }

  return withTenantScope(orgId, async (tx) => {
    const [inserted] = await tx
      .insert(projectMemory)
      .values({
        projectId,
        memoryType,
        key,
        value,
        sourceConversationId,
        createdBy: userId,
        status,
        validUntil: params.validUntil ?? null,
      })
      .returning({ id: projectMemory.id, status: projectMemory.status });

    if (!inserted) {
      throw new Error('memory_insert_failed');
    }

    // REQ-007 / AC-05: audit ONLY on active create. Pending rows (AI suggestion)
    // do NOT get an audit row here — the audit is written at approve time
    // (memory_created) to avoid false-positive noise from suggestions that are
    // never approved (§6 Charter guard, tasks.md P1.6 decision).
    if (status === 'active') {
      await writeAudit(
        {
          actor_id: userId,
          action: 'memory_created',
          resource_type: 'projectMemory',
          resource_id: inserted.id,
          meta_json: {
            projectId,
            memoryType,
            key,
            source: sourceConversationId ? 'conversation' : 'manual',
            sourceConversationId: sourceConversationId ?? null,
          },
        },
        tx,
      );
    }

    return inserted;
  });
}

/**
 * REQ-012 / AC-07: update a memory by SAME-KEY SUPERSESSION. Atomic in ONE tx:
 *   1. Invalidate the existing active row (status='invalidated', valid_until=now())
 *   2. INSERT a new active row (same project_id + key, new value/type)
 *   3. writeAudit('memory_updated') recording the supersession
 * On tx failure, BOTH rollback — no orphaned invalidated row without a successor
 * (REQ-012 atomicity). History is preserved (old row retained with status='invalidated').
 *
 * The partial UNIQUE index (project_id, key) WHERE status='active' guarantees
 * at most one active row per key even under concurrent updates.
 */
export async function updateMemory(
  params: UpdateMemoryParams,
): Promise<{ invalidatedId: string; newId: string }> {
  const { memoryId, memoryType, key, value, userId, orgId } = params;
  const sourceConversationId = params.sourceConversationId ?? null;

  // IDOR defense-in-depth.
  const inOrg = await memoryBelongsToOrg(memoryId, orgId);
  if (!inOrg) {
    throw new Error('memory_not_in_org');
  }

  return withTenantScope(orgId, async (tx) => {
    // Step 1: invalidate the existing active row.
    const [invalidated] = await tx
      .update(projectMemory)
      .set({
        status: 'invalidated',
        validUntil: new Date(),
      })
      .where(eq(projectMemory.id, memoryId))
      .returning({
        id: projectMemory.id,
        projectId: projectMemory.projectId,
      });

    if (!invalidated) {
      throw new Error('memory_supersede_target_missing');
    }

    // Step 2: create the successor active row.
    const [created] = await tx
      .insert(projectMemory)
      .values({
        projectId: invalidated.projectId,
        memoryType,
        key,
        value,
        sourceConversationId,
        createdBy: userId,
        status: 'active',
        validUntil: params.validUntil ?? null,
      })
      .returning({ id: projectMemory.id });

    if (!created) {
      throw new Error('memory_successor_insert_failed');
    }

    // Step 3: audit the supersession (same tx — REQ-008 / AC-05).
    await writeAudit(
      {
        actor_id: userId,
        action: 'memory_updated',
        resource_type: 'projectMemory',
        resource_id: created.id,
        meta_json: {
          projectId: invalidated.projectId,
          memoryType,
          key,
          supersededId: invalidated.id,
          source: sourceConversationId ? 'conversation' : 'manual',
        },
      },
      tx,
    );

    return { invalidatedId: invalidated.id, newId: created.id };
  });
}

/**
 * REQ-009 / AC-05: invalidate (soft-delete) a memory. Sets valid_until=now() +
 * status='invalidated' + writeAudit('memory_invalidated') in ONE tx.
 * Hard delete is FORBIDDEN (history preservation, §6 Charter guard).
 */
export async function invalidateMemory(params: InvalidateMemoryParams): Promise<{ id: string }> {
  const { memoryId, userId, orgId } = params;

  const inOrg = await memoryBelongsToOrg(memoryId, orgId);
  if (!inOrg) {
    throw new Error('memory_not_in_org');
  }

  return withTenantScope(orgId, async (tx) => {
    const [updated] = await tx
      .update(projectMemory)
      .set({
        status: 'invalidated',
        validUntil: new Date(),
      })
      .where(eq(projectMemory.id, memoryId))
      .returning({
        id: projectMemory.id,
        projectId: projectMemory.projectId,
        key: projectMemory.key,
      });

    if (!updated) {
      throw new Error('memory_invalidate_target_missing');
    }

    await writeAudit(
      {
        actor_id: userId,
        action: 'memory_invalidated',
        resource_type: 'projectMemory',
        resource_id: updated.id,
        meta_json: {
          projectId: updated.projectId,
          key: updated.key,
        },
      },
      tx,
    );

    return { id: updated.id };
  });
}

/**
 * REQ-014 / REQ-005 / Charter [지양-4]: approve an AI-suggested (pending) memory.
 * Atomic: status='pending' -> 'active' + createdBy = approver +
 * writeAudit('memory_created') in ONE tx. The approval IS the creation of an
 * authoritative memory row — that is why the audit action is memory_created
 * (not a separate pending-event), avoiding false-positive noise (tasks.md §6).
 *
 * Throws 'memory_approve_target_missing' if the row does not exist, or
 * 'memory_approve_state_error' if the row exists but is NOT pending (already
 * active / invalidated). The UPDATE is conditional on status='pending' so a
 * crash / replay can NEVER resurrect an invalidated row (REQ-012 history).
 */
export async function approveSuggestedMemory(
  params: ApproveSuggestedMemoryParams,
): Promise<{ id: string }> {
  const { memoryId, userId, orgId } = params;

  const inOrg = await memoryBelongsToOrg(memoryId, orgId);
  if (!inOrg) {
    throw new Error('memory_not_in_org');
  }

  // Existence check FIRST so we can distinguish "row does not exist" from
  // "row exists but is not pending" — the route surfaces these as distinct
  // error codes (409 vs 404-style). Without this, the conditional UPDATE below
  // returns [] for BOTH cases and the caller cannot tell them apart.
  const [existing] = await db
    .select({ status: projectMemory.status })
    .from(projectMemory)
    .where(eq(projectMemory.id, memoryId))
    .limit(1);
  if (!existing) {
    throw new Error('memory_approve_target_missing');
  }

  return withTenantScope(orgId, async (tx) => {
    // Conditional UPDATE: only a pending row can transition to active.
    // This is the real idempotency guard — if the row was already active or
    // invalidated, the WHERE clause does not match, .returning() is empty,
    // and we throw (prevents resurrecting invalidated rows / bypassing
    // REQ-012 supersession history). Charter [지양-4] pending -> active is a
    // single-transition — once it leaves pending, it can never come back.
    const [updated] = await tx
      .update(projectMemory)
      .set({
        status: 'active',
        createdBy: userId,
      })
      .where(and(eq(projectMemory.id, memoryId), eq(projectMemory.status, 'pending')))
      .returning({
        id: projectMemory.id,
        status: projectMemory.status,
        projectId: projectMemory.projectId,
        memoryType: projectMemory.memoryType,
        key: projectMemory.key,
      });

    // Idempotency: row existed (above check passed) but was NOT pending.
    if (!updated) {
      throw new Error('memory_approve_state_error');
    }

    await writeAudit(
      {
        actor_id: userId,
        action: 'memory_created',
        resource_type: 'projectMemory',
        resource_id: updated.id,
        meta_json: {
          projectId: updated.projectId,
          memoryType: updated.memoryType,
          key: updated.key,
          source: 'ai_suggestion_approved',
        },
      },
      tx,
    );

    return { id: updated.id };
  });
}

/**
 * REQ-003 / REQ-010 / AC-06: fetch valid memories for injection.
 * A row is valid when status='active' AND (valid_until IS NULL OR valid_until > now()).
 * Excludes 'pending' (REQ-005 — AI suggestions are not authoritative) and
 * 'invalidated' (history). Ordered by created_at desc so the most recent
 * decision of each type wins the budget truncation in the injector.
 */
export async function getValidMemories(
  projectId: string,
  orgId: string,
): Promise<
  Array<{
    id: string;
    memoryType: CreateMemoryParams['memoryType'];
    key: string;
    value: string;
    createdAt: Date;
  }>
> {
  const inOrg = await projectBelongsToOrg(projectId, orgId);
  if (!inOrg) {
    return [];
  }

  return withTenantScope(orgId, async (tx) => {
    return tx
      .select({
        id: projectMemory.id,
        memoryType: projectMemory.memoryType,
        key: projectMemory.key,
        value: projectMemory.value,
        createdAt: projectMemory.createdAt,
      })
      .from(projectMemory)
      .where(
        and(
          eq(projectMemory.projectId, projectId),
          eq(projectMemory.status, 'active'),
          // REQ-010: exclude expired. valid_until NULL = permanent.
          or(isNull(projectMemory.validUntil), gt(projectMemory.validUntil, sql`now()`)),
        ),
      )
      .orderBy(desc(projectMemory.createdAt));
  });
}

/**
 * REQ-006: list pending (AI-suggested) memories for RA-lead review UI.
 * Excluded from injection and getValidMemories (Charter [지양-4]).
 */
export async function getPendingMemories(
  projectId: string,
  orgId: string,
): Promise<
  Array<{
    id: string;
    memoryType: CreateMemoryParams['memoryType'];
    key: string;
    value: string;
    sourceConversationId: string | null;
    createdAt: Date;
  }>
> {
  const inOrg = await projectBelongsToOrg(projectId, orgId);
  if (!inOrg) {
    return [];
  }

  return withTenantScope(orgId, async (tx) => {
    return tx
      .select({
        id: projectMemory.id,
        memoryType: projectMemory.memoryType,
        key: projectMemory.key,
        value: projectMemory.value,
        sourceConversationId: projectMemory.sourceConversationId,
        createdAt: projectMemory.createdAt,
      })
      .from(projectMemory)
      .where(and(eq(projectMemory.projectId, projectId), eq(projectMemory.status, 'pending')))
      .orderBy(desc(projectMemory.createdAt));
  });
}

// Re-export for callers that need to log non-fatal failures.
export { logger };
