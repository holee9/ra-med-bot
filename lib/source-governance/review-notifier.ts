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

import { db } from '@/lib/db/client';
import { sources } from '@/lib/db/schema';
import { and, eq, isNull, lte, or } from 'drizzle-orm';

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
 * A source is "due" when:
 *   - review_cycle_days is set AND last_reviewed_at + cycle <= now + withinDays
 *   - OR last_reviewed_at is null (never reviewed) AND the source is approved.
 *
 * Best-effort date arithmetic in JS (Drizzle date-text comparison is simpler
 * here than a server-side expression). RLS scopes by org automatically.
 */
export async function getReviewDueSources(params: {
  orgId: string;
  withinDays?: number;
}): Promise<ReviewDueSource[]> {
  const withinDays = params.withinDays ?? 30;
  const horizon = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);

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
        or(lte(sources.reviewCycleDays, withinDays), isNull(sources.lastReviewedAt)),
      ),
    )) as Array<Omit<ReviewDueSource, 'daysOverdue'>>;

  const now = Date.now();
  return rows
    .map((r) => {
      const cycle = r.reviewCycleDays ?? 0;
      const last = r.lastReviewedAt ? new Date(r.lastReviewedAt).getTime() : 0;
      const dueAt = last + cycle * 24 * 60 * 60 * 1000;
      const daysOverdue = Math.floor((now - dueAt) / (24 * 60 * 60 * 1000));
      return { ...r, daysOverdue };
    })
    .filter((r) => {
      // Keep sources whose due-at falls on or before the horizon.
      const cycle = r.reviewCycleDays ?? 0;
      if (cycle === 0) return r.lastReviewedAt === null;
      const dueAt =
        (r.lastReviewedAt ? new Date(r.lastReviewedAt).getTime() : 0) + cycle * 86400000;
      return dueAt <= horizon.getTime();
    });
}
