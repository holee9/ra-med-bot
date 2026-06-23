// @MX:NOTE [AUTO] Knowledge gap daily digest cron function.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-011, REQ-013, AC-05, Issue #35)
// @MX:REASON Mirrors lib/inngest/digest/weekly-digest.ts so the Inngest serve
//           endpoint discovers + triggers this function at 08:00 UTC daily.
//           dispatchDailyDigest never throws on delivery failure — it records
//           the audit row and returns, so the Inngest step stays green.

import { INNGEST_EVENTS, inngest } from '../client';

/** Cron schedule: every day at 08:00 UTC (design.md §7.4). */
export const KNOWLEDGE_GAP_DIGEST_CRON = '0 8 * * *';

/**
 * Daily knowledge-gap digest function. Registered with Inngest so the
 * dev/prod server triggers it on schedule. Optional manual trigger via the
 * knowledge-gap/digest.trigger event lets operators replay the digest.
 */
export const knowledgeGapDailyDigestFn = inngest.createFunction(
  {
    id: 'knowledge-gap-daily-digest',
    name: 'Daily Knowledge Gap Digest',
    triggers: [
      { cron: KNOWLEDGE_GAP_DIGEST_CRON },
      { event: INNGEST_EVENTS.KNOWLEDGE_GAP_DIGEST_TRIGGER },
    ],
  },
  async ({ step, logger }) => {
    const { dispatchDailyDigest } = await import('../../knowledge-gap/digest');

    const digest = await step.run('generate-and-dispatch', () => dispatchDailyDigest());

    logger.info(`[knowledge-gap-digest] ${digest.totalUnresolved} unresolved gaps in the last 24h`);

    return {
      totalUnresolved: digest.totalUnresolved,
      topTopicCount: digest.topTopics.length,
    };
  },
);
