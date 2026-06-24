// @MX:NOTE [AUTO] rollback.ts — revert to previous approved combination (REQ-MODELGOV-006).
// @MX:ANCHOR [AUTO] rollbackCombination — atomic re-activation of the previous combo.
// @MX:REASON REQ-MODELGOV-006 / AC-03 — rollback MUST atomically deactivate the current
//           active combination and re-activate the previous one. The partial UNIQUE INDEX
//           on (org_id WHERE active=true) would otherwise reject the second active row,
//           so the transition is a single transaction. fan_in >= 3 (route, test, audit).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-006, AC-03)

import type { AuditDbHandle } from '@/lib/audit';
import { db } from '@/lib/db/client';
import { approvedCombination } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { auditRolledBack } from './audit';

export class RollbackError extends Error {
  constructor(public reason: string) {
    super(`rollback failed: ${reason}`);
    this.name = 'RollbackError';
  }
}

/**
 * REQ-MODELGOV-006: revert to the previous approved combination.
 *
 * - `toCombinationId` optional: if supplied, re-activates that specific combination
 *   (must belong to the org + currently inactive). Otherwise re-activates the most
 *   recently superseded one.
 * - Atomically: deactivate current active, activate target, write audit (H2 tx).
 *
 * Throws RollbackError when there is no combination to revert to.
 */
export async function rollbackCombination(params: {
  orgId: string;
  actorId: string | null;
  toCombinationId?: string;
}): Promise<{ fromId: string; toId: string }> {
  return db.transaction(async (tx) => {
    // Current active.
    const [current] = await tx
      .select({ id: approvedCombination.id })
      .from(approvedCombination)
      .where(and(eq(approvedCombination.orgId, params.orgId), eq(approvedCombination.active, true)))
      .limit(1);

    if (!current) {
      throw new RollbackError('no_active_combination_to_rollback_from');
    }

    // Target: explicit or most-recently-superseded.
    let targetId: string;
    if (params.toCombinationId) {
      const [target] = await tx
        .select({ id: approvedCombination.id })
        .from(approvedCombination)
        .where(
          and(
            eq(approvedCombination.id, params.toCombinationId),
            eq(approvedCombination.orgId, params.orgId),
            eq(approvedCombination.active, false),
          ),
        )
        .limit(1);
      if (!target) {
        throw new RollbackError('target_combination_not_found_or_active');
      }
      targetId = target.id;
    } else {
      const [prev] = await tx
        .select({ id: approvedCombination.id })
        .from(approvedCombination)
        .where(
          and(eq(approvedCombination.orgId, params.orgId), eq(approvedCombination.active, false)),
        )
        .orderBy(approvedCombination.approvedAt)
        .limit(1);
      if (!prev) {
        throw new RollbackError('no_previous_combination_to_rollback_to');
      }
      targetId = prev.id;
    }

    // Deactivate current.
    await tx
      .update(approvedCombination)
      .set({ active: false })
      .where(eq(approvedCombination.id, current.id));

    // Activate target (clear superseded_by so it no longer points at the just-deactivated row).
    await tx
      .update(approvedCombination)
      .set({ active: true, supersededBy: null, approvedAt: new Date() })
      .where(eq(approvedCombination.id, targetId));

    // REQ-006 audit (H2 atomicity). auditRolledBack writes the single 21 CFR
    // Part 11 record — do not duplicate it.
    await auditRolledBack({
      actorId: params.actorId,
      orgId: params.orgId,
      resourceId: targetId,
      fromCombinationId: current.id,
      toCombinationId: targetId,
      tx: tx as unknown as AuditDbHandle,
    });

    return { fromId: current.id, toId: targetId };
  });
}
