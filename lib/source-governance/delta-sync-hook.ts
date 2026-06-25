// @MX:ANCHOR [AUTO] updateGovernanceFromSync — #45 delta-sync governance refresh hook.
// @MX:REASON fan_in >= 1 (the only call site is triggerGapReplay in
//   lib/radar/delta-sync/gap-replay.ts — the post-ingestion orchestration point
//   for #45 delta-sync). REQ-SOURCE-GOV-016/AC-07 compliance gate — when a
//   delta-sync refreshes a source's content, the governance metadata
//   (effective_date, supersession, last_reviewed_at) MUST be refreshed too.
//   A dead-code definition without a call site is a SPEC violation.
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (REQ-SOURCE-GOV-016, AC-07)
//
// Wired at: lib/radar/delta-sync/gap-replay.ts → triggerGapReplay() calls
// updateGovernanceFromSync() for every source touched by the ingestion run,
// AFTER the gap-replay loop, so the governance state reflects the new content.

import { withTenantScope } from '@/lib/db/client';
import { sources } from '@/lib/db/schema';
import { logger } from '@/lib/observability/logger';
import { eq, inArray } from 'drizzle-orm';
import { auditSourceDeltaSyncUpdated } from './audit';

export interface GovernanceSyncUpdate {
  sourceId: string;
  /** New effective date (ISO yyyy-mm-dd) from the synced document metadata. */
  effectiveDate?: string | null;
  /** New sunset date (ISO yyyy-mm-dd), if the document declares an expiry. */
  sunsetDate?: string | null;
  /** ID of a newer source that supersedes this one (if the sync detected it). */
  supersededBy?: string | null;
}

export interface GovernanceSyncResult {
  refreshed: string[];
  skipped: string[];
}

/**
 * REQ-SOURCE-GOV-016/AC-07 — refresh governance state after a #45 delta-sync.
 *
 * For each source in the update batch, set effective_date / sunset_date /
 * superseded_by when the sync provides new values, and bump last_reviewed_at.
 * Each refresh is audited as source.delta_sync_updated (21 CFR Part 11).
 *
 * Best-effort: a per-source failure is logged and skipped — the sync itself
 * already succeeded; governance refresh is a post-hoc enrichment.
 *
 * @param orgId  Org that owns the sources (RLS scopes the UPDATE; passed to audit).
 * @param actorId  System user UUID for the audit rows.
 */
export async function updateGovernanceFromSync(params: {
  orgId: string;
  actorId: string;
  updates: GovernanceSyncUpdate[];
}): Promise<GovernanceSyncResult> {
  const refreshed: string[] = [];
  const skipped: string[] = [];

  if (params.updates.length === 0) return { refreshed, skipped };

  // Bulk-verify the source IDs belong to the org before per-source UPDATEs.
  const ids = params.updates.map((u) => u.sourceId);
  const owned = await withTenantScope(params.orgId, (dbs) =>
    dbs.select({ id: sources.id }).from(sources).where(inArray(sources.id, ids)),
  );
  const ownedSet = new Set(owned.map((r) => r.id));

  for (const update of params.updates) {
    if (!ownedSet.has(update.sourceId)) {
      logger.warn('[source-governance] delta-sync hook: source not in org, skipping', {
        sourceId: update.sourceId,
        orgId: params.orgId,
      });
      skipped.push(update.sourceId);
      continue;
    }

    try {
      const setClause: Record<string, unknown> = {
        lastReviewedAt: new Date(),
      };
      const updatedFields: string[] = ['last_reviewed_at'];
      if (update.effectiveDate !== undefined) {
        setClause.effectiveDate = update.effectiveDate;
        updatedFields.push('effective_date');
      }
      if (update.sunsetDate !== undefined) {
        setClause.sunsetDate = update.sunsetDate;
        updatedFields.push('sunset_date');
      }
      if (update.supersededBy !== undefined) {
        setClause.supersededBy = update.supersededBy;
        updatedFields.push('superseded_by');
      }

      await withTenantScope(params.orgId, async (tx) => {
        await tx.update(sources).set(setClause).where(eq(sources.id, update.sourceId));
        await auditSourceDeltaSyncUpdated({
          userId: params.actorId,
          sourceId: update.sourceId,
          updatedFields,
          tx,
        });
      });
      refreshed.push(update.sourceId);
    } catch (err) {
      logger.error('[source-governance] delta-sync hook: refresh failed for source', {
        sourceId: update.sourceId,
        error: err instanceof Error ? err.message : String(err),
      });
      skipped.push(update.sourceId);
    }
  }

  return { refreshed, skipped };
}
