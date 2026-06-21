// @MX:SPEC SPEC-REGULA-DIGEST-001 (Phase 2 — Inngest cron wiring)
// Weekly regulatory intelligence digest: enumerates orgs with frequency != disabled,
// generates the payload, and dispatches email via the digest sender.

import { and, eq, ne } from 'drizzle-orm';
import { orgDigestPreferences } from '../../db/schema';
import { INNGEST_EVENTS, inngest } from '../client';

type DigestWeeklyTriggerData = { orgId?: string; weekId?: string };

export function buildDigestPreferencesPredicate(data: DigestWeeklyTriggerData) {
  const enabledPreference = ne(orgDigestPreferences.frequency, 'disabled');
  return data.orgId
    ? and(eq(orgDigestPreferences.orgId, data.orgId), enabledPreference)
    : enabledPreference;
}

/** Cron schedule: every Monday at 00:00 UTC. Orgs apply their own tz offset. */
export const DIGEST_CRON_SCHEDULE = '0 0 * * 1';

/**
 * Weekly digest cron function. Registered with Inngest so the dev/prod server
 * triggers it on schedule. Uses step.run for per-org retry isolation.
 */
export const weeklyDigestFn = inngest.createFunction(
  {
    id: 'digest-weekly-cron',
    name: 'Weekly Regulatory Intelligence Digest',
    triggers: [{ cron: DIGEST_CRON_SCHEDULE }, { event: INNGEST_EVENTS.DIGEST_WEEKLY_TRIGGER }],
  },
  async ({ event, step, logger }) => {
    const { generateWeeklyDigest } = await import('../../digest/digest-generator');
    const { sendDigestEmail } = await import('../../digest/email-sender');
    const { db } = await import('../../db/client');

    // Cron trigger passes no data; manual event may pass { orgId?, weekId? }.
    const data = (event.data ?? {}) as DigestWeeklyTriggerData;

    const prefs = data.orgId
      ? await db
          .select()
          .from(orgDigestPreferences)
          .where(buildDigestPreferencesPredicate(data))
          .limit(1)
      : await db.select().from(orgDigestPreferences).where(buildDigestPreferencesPredicate(data));

    let processed = 0;
    for (const pref of prefs) {
      const count = await step.run(`digest-org-${pref.orgId}`, async () => {
        try {
          const payload = await generateWeeklyDigest(pref.orgId, data.weekId);
          if (pref.recipientEmails.length > 0) {
            await sendDigestEmail(pref.orgId, payload, pref.recipientEmails);
          }
          return 1;
        } catch (err) {
          logger.error(`[digest-cron] Failed for org ${pref.orgId}:`, err);
          return 0;
        }
      });
      processed += count;
    }

    return { processed };
  },
);
