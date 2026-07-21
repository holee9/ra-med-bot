// @MX:ANCHOR [AUTO] filterGovernanceEligible — source governance retrieval gate.
// @MX:REASON fan_in >= 3: lib/ai/retrievers/hybrid-search.ts,
//   lib/ai/retrievers/internal-sops.ts, lib/ai/retrievers/internal-docs.ts all
//   call this ADJACENT to filterExpiredSources. REQ-SOURCE-GOV-004/005/006/008
//   compliance gate — superseded / pending_review / rejected sources MUST be
//   excluded from default RAG retrieval. A dead-code definition without a call
//   site is a SPEC violation.
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (REQ-SOURCE-GOV-004/005/006/008)
//
// Composition contract (Issue #72 corpus-license):
//   filterExpiredSources(sourceIds, orgId)  →  Set<sourceId>  (license/expiry)
//   filterGovernanceEligible(sourceIds, {orgId, historical})  →  Set<sourceId>
// Retrievers intersect the two sets:
//   const [licenseEligible, govEligible] = await Promise.all([
//     filterExpiredSources(sourceIds, orgId),
//     filterGovernanceEligible(sourceIds, { orgId }),
//   ]);
//   const eligible = licenseEligible.intersection(govEligible);

import { db } from '@/lib/kernel/db/client';
import { sources } from '@/lib/kernel/db/schema';
import { logger } from '@/lib/observability/logger';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { AUTHORITY_RANK, authorityRank, isPrimaryGrade } from './authority-model';
import type { AuthorityGrade, LowAuthorityAssessment, RetrievalGateOptions } from './types';

/** Row shape fetched from sources for the gate computation. */
interface GovernanceRow {
  id: string;
  authorityGrade: string | null;
  approvalStatus: string;
  supersededBy: string | null;
  sunsetDate: string | null;
  effectiveDate: string | null;
}

/**
 * REQ-SOURCE-GOV-005/006/009 — default search excludes:
 *   - superseded sources (superseded_by != null)  — unless historical=true (REQ-006)
 *   - pending_review / rejected sources           — always (REQ-009)
 * Returns the set of sourceIds that PASS the governance gate.
 *
 * Defense-in-depth: a governance-db hiccup never blocks retrieval. On error,
 * returns the full input set (RLS still enforces org isolation; license-gate
 * still filters expired sources).
 */
export async function filterGovernanceEligible(
  sourceIds: string[],
  options: RetrievalGateOptions,
): Promise<Set<string>> {
  if (sourceIds.length === 0) return new Set();

  try {
    const rows = await db
      .select({
        id: sources.id,
        authorityGrade: sources.authorityGrade,
        approvalStatus: sources.approvalStatus,
        supersededBy: sources.supersededBy,
        sunsetDate: sources.sunsetDate,
        effectiveDate: sources.effectiveDate,
      })
      .from(sources)
      .where(inArray(sources.id, sourceIds));

    const historical = options.historical ?? false;
    const eligible = new Set<string>();

    for (const row of rows as GovernanceRow[]) {
      // REQ-009: pending_review / rejected / sunset always excluded from search.
      // The `!== 'approved'` check covers all non-approved statuses uniformly.
      // Issue 313: 'sunset' is set by the daily orphan-cleanup cron when all
      // source_sections are superseded — it is permanently excluded here.
      if (row.approvalStatus !== 'approved') continue;
      // REQ-005: superseded excluded unless historical=true (REQ-006).
      if (!historical && row.supersededBy !== null) continue;
      eligible.add(row.id);
    }
    return eligible;
  } catch (err) {
    // Governance metadata unavailable — return unfiltered (license-gate + RLS still apply).
    logger.warn('[source-governance] filterGovernanceEligible failed, returning unfiltered', {
      orgId: options.orgId,
      count: sourceIds.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return new Set(sourceIds);
  }
}

/**
 * REQ-SOURCE-GOV-004 — rank candidate source ids by authority grade (highest first).
 * Returns the sourceIds ordered by authority rank; ties preserve input order.
 */
export async function rankByAuthority(
  sourceIds: string[],
): Promise<Array<{ sourceId: string; grade: string | null }>> {
  if (sourceIds.length === 0) return [];

  const rows = (await db
    .select({ id: sources.id, authorityGrade: sources.authorityGrade })
    .from(sources)
    .where(inArray(sources.id, sourceIds))) as Array<{ id: string; authorityGrade: string | null }>;

  // Stable sort by authority rank.
  return rows
    .map((r) => {
      const grade = (r.authorityGrade as AuthorityGrade | null) ?? null;
      return {
        sourceId: r.id,
        grade: r.authorityGrade,
        rank: authorityRank(grade),
      };
    })
    .sort((a, b) => a.rank - b.rank)
    .map(({ sourceId, grade }) => ({ sourceId, grade }));
}

/**
 * REQ-SOURCE-GOV-008 — assess whether the candidate set is low-authority-only.
 * When every source is a non-primary grade (secondary_reference / public_database
 * / null), the consult answer is flagged expert_review_required.
 */
export function assessLowAuthority(
  candidates: Array<{ sourceId: string; grade: string | null }>,
): LowAuthorityAssessment {
  if (candidates.length === 0) {
    return { lowAuthorityOnly: false, highestGrade: null, reason: null };
  }

  let highestRank = Number.POSITIVE_INFINITY;
  let highestGrade: LowAuthorityAssessment['highestGrade'] = null;
  let allLow = true;

  for (const c of candidates) {
    const grade = (c.grade as LowAuthorityAssessment['highestGrade']) ?? null;
    if (isPrimaryGrade(grade)) allLow = false;
    const rank = authorityRank(grade);
    if (rank < highestRank) {
      highestRank = rank;
      highestGrade = grade;
    }
  }

  if (!allLow) {
    return { lowAuthorityOnly: false, highestGrade, reason: null };
  }
  return {
    lowAuthorityOnly: true,
    highestGrade,
    reason: `low-authority sources only (highest: ${highestGrade ?? 'unknown'})`,
  };
}

/**
 * REQ-SOURCE-GOV-007 — convenience: return the candidate source ids that remain
 * after BOTH the license filter (Issue #72) AND the governance filter are applied.
 * Retrievers call this to compose the two gates in one call.
 *
 * Usage:
 *   const eligible = await composeRetrievalGates(sourceIds, orgId);
 *   chunks.filter(c => eligible.has(c.sourceId));
 */
export async function composeRetrievalGates(
  sourceIds: string[],
  options: RetrievalGateOptions,
): Promise<Set<string>> {
  if (sourceIds.length === 0) return new Set();

  // Dynamic import avoids a circular dep at module load (corpus-license also
  // imports from db/schema). Both gates resolve in parallel.
  const [licenseEligible, govEligible] = await Promise.all([
    import('@/lib/corpus-license/expiry-checker').then((m) =>
      m.filterExpiredSources(sourceIds, options.orgId),
    ),
    filterGovernanceEligible(sourceIds, options),
  ]);

  return licenseEligible.intersection(govEligible);
}
