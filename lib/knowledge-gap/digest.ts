// @MX:ANCHOR [AUTO] Knowledge gap daily digest — aggregation + dispatch.
// @MX:REASON fan_in reaches 3+: Inngest daily cron, manual operator trigger,
//          future SLA dashboard. The digest summarizes the last 24h of
//          unanswered gaps and is the operational feedback loop that turns
//          "the bot couldn't answer X" into an RA-team action item.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-011, REQ-012, REQ-013, AC-05, AC-07, Issue #35)
//
// Design reference: design.md §3 (loop flow) and §7.4 (Digest Scheduling).
//   - generateDailyDigest(): pure DB aggregation — top recurring topics (by
//     cluster), urgency breakdown by classification, counts. Returns a
//     structured digest object; no side effects.
//   - dispatchDailyDigest(): wraps the above + email send in try/catch and
//     writes the knowledge_gap_digest_sent audit row on BOTH success and
//     failure (REQ-013). Failures never crash the caller — the Inngest step
//     logs and the audit row captures the error for SLA review.

import { writeAudit } from '@/lib/audit';
import { db } from '@/lib/db/client';
import { unansweredQueue } from '@/lib/db/schema';
import type { DispatchResult } from '@/lib/notifications/dispatcher';
import { logger } from '@/lib/observability/logger';
import { and, count, desc, eq, gte, inArray } from 'drizzle-orm';

/** Window for the daily digest: gaps created in the last 24 hours. */
export const DIGEST_WINDOW_HOURS = 24;

/** Classification categories surfaced in the urgency breakdown. */
export type GapClassification =
  | 'ra_project_gap'
  | 'md_process_gap'
  | 'external_regulation_needed'
  | 'bug'
  | 'unclassified';

/** A single topic cluster in the digest — the most-recurring unanswered themes. */
export interface DigestTopicItem {
  clusterId: string | null;
  /** PII-free excerpt of the most recent gap in this cluster. */
  sampleQuestion: string;
  /** Number of gaps sharing this cluster in the window. */
  occurrences: number;
}

/** Urgency breakdown: counts per classification category (REQ-KNOWLEDGE-GAP-012). */
export interface DigestUrgencyBreakdown {
  ra_project_gap: number;
  md_process_gap: number;
  external_regulation_needed: number;
  bug: number;
  /** Gaps that exist but have not yet been classified — the SLA backlog. */
  unclassified: number;
}

/** Structured digest payload returned by generateDailyDigest(). */
export interface DailyDigest {
  /** ISO timestamp the digest was generated. */
  generatedAt: string;
  /** ISO timestamp of the oldest gap included. */
  windowStart: string;
  /** Total unresolved (status != 'resolved') gaps in the window. */
  totalUnresolved: number;
  /** Breakdown by classification (REQ-KNOWLEDGE-GAP-012 urgency). */
  urgency: DigestUrgencyBreakdown;
  /** Top recurring topics by cluster size, descending. */
  topTopics: DigestTopicItem[];
}

/** Injectable email sender — production resolves SendGrid via notifications/dispatcher. */
export type DigestEmailSender = (digest: DailyDigest) => Promise<void>;

function assertDispatchDelivered(result: DispatchResult): void {
  const statuses = [result.slack, result.teams, result.email];
  if (statuses.includes('sent')) return;

  const errorChannels = Object.entries(result)
    .filter(([, status]) => status === 'error')
    .map(([channel]) => channel);
  const errorSuffix =
    errorChannels.length > 0 ? `; failed channels: ${errorChannels.join(', ')}` : '';
  throw new Error(`no notification channel delivered knowledge gap digest${errorSuffix}`);
}

/**
 * Aggregate the last 24h of unresolved knowledge gaps into a structured digest
 * (REQ-KNOWLEDGE-GAP-011, REQ-012). Pure read — no side effects.
 *
 * Top topics are derived from cluster_id grouping (design.md §7.3): the more
 * gaps share a cluster, the more recurring the theme. Unclassified gaps are
 * surfaced separately as the SLA backlog the RA team still needs to triage.
 */
export async function generateDailyDigest(
  args: {
    now?: Date;
    windowHours?: number;
    orgId?: string;
  } = {},
): Promise<DailyDigest> {
  const now = args.now ?? new Date();
  const windowHours = args.windowHours ?? DIGEST_WINDOW_HOURS;
  const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

  const filters = [gte(unansweredQueue.createdAt, windowStart)];
  // status != 'resolved' — resolved gaps are closed-loop, not digest material.
  filters.push(inArray(unansweredQueue.status, ['open', 'classified']));
  if (args.orgId) {
    filters.push(eq(unansweredQueue.orgId, args.orgId));
  }

  const rows = await db
    .select({
      id: unansweredQueue.id,
      clusterId: unansweredQueue.clusterId,
      redactedQuestion: unansweredQueue.redactedQuestion,
      classification: unansweredQueue.classification,
      status: unansweredQueue.status,
      createdAt: unansweredQueue.createdAt,
    })
    .from(unansweredQueue)
    .where(and(...filters))
    .orderBy(desc(unansweredQueue.createdAt));

  const urgency: DigestUrgencyBreakdown = {
    ra_project_gap: 0,
    md_process_gap: 0,
    external_regulation_needed: 0,
    bug: 0,
    unclassified: 0,
  };

  // Group by cluster to find recurring topics. Null cluster → singleton bucket.
  const clusterGroups = new Map<string | null, DigestTopicItem>();
  for (const row of rows) {
    const key = row.classification ?? 'unclassified';
    urgency[key] += 1;

    const clusterKey = row.clusterId;
    const existing = clusterGroups.get(clusterKey);
    if (existing) {
      existing.occurrences += 1;
    } else {
      clusterGroups.set(clusterKey, {
        clusterId: clusterKey,
        // Most-recent gap's question is the sample (rows are ordered desc).
        sampleQuestion: row.redactedQuestion,
        occurrences: 1,
      });
    }
  }

  const topTopics = [...clusterGroups.values()]
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 5);

  return {
    generatedAt: now.toISOString(),
    windowStart: windowStart.toISOString(),
    totalUnresolved: rows.length,
    urgency,
    topTopics,
  };
}

/**
 * Render the digest as a plain-text email body. Kept separate so the Inngest
 * function and any future UI preview share one rendering path.
 */
export function renderDigestText(digest: DailyDigest): string {
  const lines: string[] = [
    `Regula Knowledge Gap Digest — ${digest.generatedAt}`,
    `Window: ${digest.windowStart} → ${digest.generatedAt}`,
    `Total unresolved gaps (last 24h): ${digest.totalUnresolved}`,
    '',
    'Urgency breakdown:',
    `  - RA project gap:           ${digest.urgency.ra_project_gap}`,
    `  - MD process gap:           ${digest.urgency.md_process_gap}`,
    `  - External regulation:      ${digest.urgency.external_regulation_needed}`,
    `  - Bug:                      ${digest.urgency.bug}`,
    `  - Unclassified (SLA risk):  ${digest.urgency.unclassified}`,
    '',
    'Top recurring topics:',
  ];
  if (digest.topTopics.length === 0) {
    lines.push('  (none)');
  } else {
    for (const [i, topic] of digest.topTopics.entries()) {
      const excerpt =
        topic.sampleQuestion.length > 80
          ? `${topic.sampleQuestion.slice(0, 77)}...`
          : topic.sampleQuestion;
      lines.push(
        `  ${i + 1}. [${topic.occurrences}x] ${excerpt} (cluster: ${topic.clusterId ?? 'singleton'})`,
      );
    }
  }
  return lines.join('\n');
}

/**
 * Generate the digest and dispatch it to the email channel. Failures are
 * captured in the audit log (REQ-KNOWLEDGE-GAP-013) and never re-thrown —
 * the Inngest cron must stay green even when SendGrid is misconfigured, so
 * the SLA dashboard can surface the audit row instead of a crashed job.
 *
 * Returns the generated digest so the caller (cron step / test) can inspect it.
 */
export async function dispatchDailyDigest(
  args: {
    orgId?: string;
    sendEmail?: DigestEmailSender;
    now?: Date;
  } = {},
): Promise<DailyDigest> {
  const digest = await generateDailyDigest({ now: args.now, orgId: args.orgId });

  try {
    if (args.sendEmail) {
      await args.sendEmail(digest);
    } else {
      // Default dispatch path: reuse the notifications dispatcher's email
      // channel so SENDGRID_API_KEY + recipient resolution live in one place.
      const { dispatch } = await import('@/lib/notifications/dispatcher');
      const result = await dispatch({
        eventType: 'knowledge_gap.detected',
        title: `Regula Knowledge Gap Digest — ${digest.totalUnresolved} unresolved`,
        body: renderDigestText(digest),
        actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.regula.ai'}/knowledge-gap`,
      });
      assertDispatchDelivered(result);
    }

    await writeAudit({
      actor_id: null,
      action: 'knowledge_gap_digest_sent',
      resource_type: 'unanswered_queue',
      resource_id: digest.generatedAt,
      meta_json: {
        total_unresolved: digest.totalUnresolved,
        urgency: digest.urgency,
        topic_count: digest.topTopics.length,
        status: 'sent',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[knowledge-gap/digest] dispatch failed:', err);
    // REQ-KNOWLEDGE-GAP-013: record the failure in audit_logs but DO NOT
    // re-throw — the digest generation itself succeeded; only delivery failed.
    await writeAudit({
      actor_id: null,
      action: 'knowledge_gap_digest_sent',
      resource_type: 'unanswered_queue',
      resource_id: digest.generatedAt,
      meta_json: {
        total_unresolved: digest.totalUnresolved,
        urgency: digest.urgency,
        topic_count: digest.topTopics.length,
        status: 'failed',
        error: message,
      },
    });
  }

  return digest;
}

/**
 * Count helper used by tests / dashboards to assert the window was non-empty.
 */
export async function countUnresolvedGaps(args: { orgId?: string; since?: Date } = {}): Promise<{
  total: number;
  byClassification: Record<string, number>;
}> {
  const since = args.since ?? new Date(Date.now() - DIGEST_WINDOW_HOURS * 60 * 60 * 1000);
  const filters = [gte(unansweredQueue.createdAt, since)];
  if (args.orgId) filters.push(eq(unansweredQueue.orgId, args.orgId));

  const rows = await db
    .select({
      classification: unansweredQueue.classification,
      c: count(),
    })
    .from(unansweredQueue)
    .where(and(...filters))
    .groupBy(unansweredQueue.classification);

  const byClassification: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    const key = row.classification ?? 'unclassified';
    byClassification[key] = row.c;
    total += row.c;
  }
  return { total, byClassification };
}
