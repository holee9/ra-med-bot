// @MX:NOTE [AUTO] Source governance dashboard queries (REQ-SOURCE-GOV-012/014, AC-06).
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48)
//
// Aggregates: corpus-wide approved/pending/stale/superseded counts, review-due
// list (delegates to review-notifier), and stale-citation artifacts list.
// The /api/source-governance/dashboard route and the Governance UI page call this.

import { db } from '@/lib/db/client';
import { messageSources, sources } from '@/lib/db/schema';
import { and, count, eq, isNotNull, lte, sql } from 'drizzle-orm';
import { type ReviewDueSource, getReviewDueSources } from './review-notifier';

export interface GovernanceDashboardCounts {
  approved: number;
  pendingReview: number;
  rejected: number;
  /** Sources with sunset_date in the past. */
  stale: number;
  /** Sources with superseded_by != null. */
  superseded: number;
}

export interface StaleCitationArtifact {
  messageId: string;
  sourceId: string;
  sourceTitle: string | null;
  reason: string;
}

export interface GovernanceDashboard {
  counts: GovernanceDashboardCounts;
  reviewDue: ReviewDueSource[];
  staleCitationArtifacts: StaleCitationArtifact[];
}

/**
 * REQ-SOURCE-GOV-012 — corpus-wide counts by approval/sunset/supersession state.
 * RLS scopes by org automatically; `orgId` is threaded for the review-due query.
 */
export async function getGovernanceDashboard(params: {
  orgId: string;
}): Promise<GovernanceDashboard> {
  const today = new Date().toISOString().slice(0, 10);

  // Single pass: 4 scalar counts + the review-due list + stale-citation artifacts,
  // fanned out concurrently. Each query is org-scoped via sources.organizationId
  // (the table RLS also enforces this, but the explicit WHERE keeps the query
  // planner honest and the test mock simple).
  const [
    approvedRows,
    pendingRows,
    rejectedRows,
    staleRows,
    supersededRows,
    reviewDue,
    staleArtifacts,
  ] = await Promise.all([
    db
      .select({ n: count() })
      .from(sources)
      .where(and(eq(sources.organizationId, params.orgId), eq(sources.approvalStatus, 'approved'))),
    db
      .select({ n: count() })
      .from(sources)
      .where(
        and(eq(sources.organizationId, params.orgId), eq(sources.approvalStatus, 'pending_review')),
      ),
    db
      .select({ n: count() })
      .from(sources)
      .where(and(eq(sources.organizationId, params.orgId), eq(sources.approvalStatus, 'rejected'))),
    db
      .select({ n: count() })
      .from(sources)
      .where(
        and(
          eq(sources.organizationId, params.orgId),
          sql`${sources.sunsetDate} IS NOT NULL AND ${sources.sunsetDate} < ${today}`,
        ),
      ),
    db
      .select({ n: count() })
      .from(sources)
      .where(and(eq(sources.organizationId, params.orgId), isNotNull(sources.supersededBy))),
    getReviewDueSources({ orgId: params.orgId }),
    getStaleCitationArtifacts(params.orgId),
  ]);

  const num = (rows: Array<{ n: number }>) => rows[0]?.n ?? 0;

  return {
    counts: {
      approved: num(approvedRows as Array<{ n: number }>),
      pendingReview: num(pendingRows as Array<{ n: number }>),
      rejected: num(rejectedRows as Array<{ n: number }>),
      stale: num(staleRows as Array<{ n: number }>),
      superseded: num(supersededRows as Array<{ n: number }>),
    },
    reviewDue,
    staleCitationArtifacts: staleArtifacts,
  };
}

/**
 * REQ-SOURCE-GOV-014 — messages that cite a stale (superseded/sunset-past) source.
 * Joins message_sources → sources and filters to stale rows. Returns the message
 * id + the offending source so the dashboard can link RA leads to the artifacts
 * needing re-citation.
 *
 * Capped at 50 rows to keep the dashboard payload bounded.
 */
export async function getStaleCitationArtifacts(orgId: string): Promise<StaleCitationArtifact[]> {
  const today = new Date().toISOString().slice(0, 10);

  const rows = (await db
    .select({
      messageId: messageSources.messageId,
      sourceId: messageSources.sourceId,
      sourceTitle: sources.title,
      supersededBy: sources.supersededBy,
      sunsetDate: sources.sunsetDate,
    })
    .from(messageSources)
    .innerJoin(sources, eq(messageSources.sourceId, sources.id))
    .where(
      and(
        eq(sources.organizationId, orgId),
        sql`(${sources.supersededBy} IS NOT NULL OR (${sources.sunsetDate} IS NOT NULL AND ${sources.sunsetDate} < ${today}))`,
      ),
    )
    .limit(50)) as Array<{
    messageId: string;
    sourceId: string;
    sourceTitle: string | null;
    supersededBy: string | null;
    sunsetDate: string | null;
  }>;

  return rows.map((r) => ({
    messageId: r.messageId,
    sourceId: r.sourceId,
    sourceTitle: r.sourceTitle,
    reason:
      r.supersededBy !== null
        ? `superseded by ${r.supersededBy}`
        : `sunset date passed (${r.sunsetDate})`,
  }));
}
