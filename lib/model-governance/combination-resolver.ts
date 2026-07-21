// @MX:NOTE [AUTO] combination-resolver.ts — resolve the active approved combination.
// @MX:ANCHOR [AUTO] getActiveCombination — single source of truth for the active combo.
// @MX:REASON REQ-MODELGOV-013 — exactly one active combination per org (enforced by
//           partial UNIQUE INDEX). fan_in >= 3 (runtime-guard, audit-metadata, routes).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-013)

import { db } from '@/lib/kernel/db/client';
import { approvedCombination, modelPin, promptRegistry } from '@/lib/kernel/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import type { ActiveCombination } from './types';

/**
 * REQ-MODELGOV-013: resolve the single active approved combination for an org.
 * Joins prompt_registry + model_pin to return full version metadata in one trip.
 * Returns null if no combination is active (e.g., pre-approval bootstrap state).
 */
export async function getActiveCombination(orgId: string): Promise<ActiveCombination | null> {
  const [row] = await db
    .select({
      id: approvedCombination.id,
      promptId: approvedCombination.promptId,
      modelPinId: approvedCombination.modelPinId,
      promptVersion: promptRegistry.version,
      promptContentHash: promptRegistry.contentHash,
      modelProvider: modelPin.provider,
      modelId: modelPin.modelId,
      modelVersion: modelPin.modelVersion,
      approvedAt: approvedCombination.approvedAt,
    })
    .from(approvedCombination)
    .innerJoin(promptRegistry, eq(promptRegistry.id, approvedCombination.promptId))
    .innerJoin(modelPin, eq(modelPin.id, approvedCombination.modelPinId))
    .where(and(eq(approvedCombination.orgId, orgId), eq(approvedCombination.active, true)))
    .limit(1);

  return row ?? null;
}

/**
 * Find the most recently superseded (immediately-prior) combination for rollback.
 * Returns null if there is no prior combination to revert to.
 */
export async function getPreviousCombination(
  orgId: string,
  currentActiveId: string,
): Promise<{ id: string; promptId: string; modelPinId: string } | null> {
  const [row] = await db
    .select({
      id: approvedCombination.id,
      promptId: approvedCombination.promptId,
      modelPinId: approvedCombination.modelPinId,
      supersededAt: approvedCombination.approvedAt,
    })
    .from(approvedCombination)
    .where(and(eq(approvedCombination.orgId, orgId), eq(approvedCombination.active, false)))
    // H1 fix: DESC selects the MOST RECENT superseded combo (immediately-prior),
    // not the oldest. ASC was reverting to the first combo ever approved.
    .orderBy(desc(approvedCombination.approvedAt))
    .limit(1);

  // Exclude the current active id (defensive — active=false filter already handles it).
  if (!row || row.id === currentActiveId) return null;
  return { id: row.id, promptId: row.promptId, modelPinId: row.modelPinId };
}
