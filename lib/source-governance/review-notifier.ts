// @MX:NOTE [AUTO] Source review-due notifier — periodic review cycle (REQ-SOURCE-GOV-011/013).
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48, REQ-SOURCE-GOV-011/013)
//
// Query function for sources whose review_cycle_days has elapsed (or will
// within the next 30 days). The dashboard calls this directly (AC-06).
//
// @MX:TODO [AUTO] REQ-SOURCE-GOV-011 follow-up: wire an Inngest daily cron that
//   calls getReviewDueSources + auditSourceReviewDue + email/PDF notification.
//   The query function is the highest-value piece and is wired now (dashboard);
//   the cron + outbound channel is a follow-up to avoid an Inngest function
//   registration churn in this tier.

import { db } from '@/lib/kernel/db/client';
import { sources } from '@/lib/kernel/db/schema';
import { and, eq, isNull, or, sql } from 'drizzle-orm';

export interface ReviewDueSource {
  id: string;
  title: string;
  ownerDepartment: string | null;
  reviewCycleDays: number | null;
  lastReviewedAt: string | null;
  daysOverdue: number;
}

/**
 * REQ-SOURCE-GOV-013 — sources whose review is due within `withinDays` (default 30).
 *
 * M-3 fix: the prior predicate `lte(reviewCycleDays, withinDays)` compared
 * cycle-days against 30 — so a 365-day-cycle source 400 days overdue was
 * excluded (cycle 365 > 30). The real "due" condition is:
 *   - last_reviewed_at + (review_cycle_days || ' days')::interval <= now() + (withinDays || ' days')::interval
 *   - OR last_reviewed_at IS NULL AND approval_status='approved' (never reviewed)
 *
 * The due-date arithmetic is pushed to SQL via Drizzle's sql template so the
 * interval comparison is server-side (no JS date skew across timezones). RLS
 * scopes by org automatically.
 */
export async function getReviewDueSources(params: {
  orgId: string;
  withinDays?: number;
}): Promise<ReviewDueSource[]> {
  const withinDays = params.withinDays ?? 30;

  const duePredicate = or(
    // Reviewed before but the cycle has elapsed (or will within withinDays).
    sql`(sources.last_reviewed_at + ((sources.review_cycle_days || ' days'))::interval) <= (now() + (${withinDays} || ' days')::interval)`,
    // Never reviewed AND approved (newly-approved sources need an initial review).
    and(isNull(sources.lastReviewedAt), eq(sources.approvalStatus, 'approved')),
  );

  const rows = (await db
    .select({
      id: sources.id,
      title: sources.title,
      ownerDepartment: sources.ownerDepartment,
      reviewCycleDays: sources.reviewCycleDays,
      lastReviewedAt: sources.lastReviewedAt,
    })
    .from(sources)
    .where(
      and(
        eq(sources.organizationId, params.orgId),
        eq(sources.approvalStatus, 'approved'),
        sql`sources.review_cycle_days IS NOT NULL OR sources.last_reviewed_at IS NULL`,
        duePredicate,
      ),
    )) as Array<Omit<ReviewDueSource, 'daysOverdue'>>;

  const now = Date.now();
  return rows.map((r) => {
    const cycle = r.reviewCycleDays ?? 0;
    const last = r.lastReviewedAt ? new Date(r.lastReviewedAt).getTime() : 0;
    const dueAt = cycle > 0 ? last + cycle * 24 * 60 * 60 * 1000 : 0;
    const daysOverdue = cycle > 0 ? Math.floor((now - dueAt) / (24 * 60 * 60 * 1000)) : 0;
    return { ...r, daysOverdue };
  });
}
