// @MX:ANCHOR [AUTO] verifyGovernanceFreshness — stale-citation gate at draft/export.
// @MX:REASON fan_in >= 3: traceability export route, change-control export route,
//   and integration tests all call this ADJACENT to verifyExportRights.
//   REQ-SOURCE-GOV-007/AC-03 compliance gate — superseded / sunset-past /
//   not-yet-effective sources MUST NOT appear in a regulatory submission
//   export. A dead-code definition without a call site is a SPEC violation.
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (REQ-SOURCE-GOV-007, AC-03)
//
// Composition contract (Issue #72 corpus-license export-gate):
//   const exportGate = await verifyExportRights({ sourceIds, orgId });   // license
//   const govGate    = await verifyGovernanceFreshness(sourceIds, orgId); // governance
//   if (!exportGate.allowed || !govGate.allowed) return blockedResponse(...);

import { writeAudit } from '@/lib/audit';
import { db } from '@/lib/db/client';
import { sources } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import type { StaleCitationGateResult } from './types';

interface StaleCheckRow {
  id: string;
  title: string | null;
  supersededBy: string | null;
  sunsetDate: string | null;
  effectiveDate: string | null;
  approvalStatus: string;
}

/**
 * REQ-SOURCE-GOV-007 — block draft/export when a cited source is:
 *   - superseded (superseded_by != null)            — REQ-005
 *   - sunset-past (sunset_date < today)              — stale regulation
 *   - not-yet-effective (effective_date > today)     — future regulation
 *   - pending_review / rejected (approval gate)      — REQ-009
 *
 * Returns { allowed: false, blockedSources: [...] } when any cited source fails.
 * The caller (export route) is responsible for the audit write via
 * {@link auditStaleBlockedBatch} so the audit carries the actor id.
 */
export async function verifyGovernanceFreshness(
  sourceIds: string[],
  /** Org scope — RLS enforces row isolation; kept for the compose-with-verifyExportRights contract symmetry. */
  _orgId: string,
): Promise<StaleCitationGateResult> {
  if (sourceIds.length === 0) return { allowed: true, blockedSources: [] };

  const rows = (await db
    .select({
      id: sources.id,
      title: sources.title,
      supersededBy: sources.supersededBy,
      sunsetDate: sources.sunsetDate,
      effectiveDate: sources.effectiveDate,
      approvalStatus: sources.approvalStatus,
    })
    .from(sources)
    .where(inArray(sources.id, sourceIds))) as StaleCheckRow[];

  const today = new Date().toISOString().slice(0, 10);
  const blockedSources: StaleCitationGateResult['blockedSources'] = [];

  for (const row of rows) {
    let reason: string | null = null;
    if (row.supersededBy !== null) {
      reason = `superseded by ${row.supersededBy}`;
    } else if (row.sunsetDate !== null && row.sunsetDate < today) {
      reason = `sunset date passed (${row.sunsetDate})`;
    } else if (row.effectiveDate !== null && row.effectiveDate > today) {
      reason = `not yet effective (effective ${row.effectiveDate})`;
    } else if (row.approvalStatus !== 'approved') {
      reason = `approval status: ${row.approvalStatus}`;
    }
    if (reason) {
      blockedSources.push({ sourceId: row.id, title: row.title, reason });
    }
  }

  return { allowed: blockedSources.length === 0, blockedSources };
}

/**
 * Convenience: write a source.stale_blocked audit row for each blocked source.
 * REQ-SOURCE-GOV-015 — the block event is audit-material (21 CFR Part 11).
 */
export async function auditStaleBlockedBatch(params: {
  userId: string;
  conversationId?: string;
  blockedSources: StaleCitationGateResult['blockedSources'];
}): Promise<void> {
  for (const b of params.blockedSources) {
    await writeAudit({
      actor_id: params.userId,
      action: 'source.stale_blocked',
      resource_type: 'source',
      resource_id: b.sourceId,
      conversation_id: params.conversationId,
      meta_json: { reason: b.reason, title: b.title },
    });
  }
}
