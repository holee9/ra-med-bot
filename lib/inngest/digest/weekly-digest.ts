// @MX:SPEC SPEC-REGULA-DIGEST-001 (Phase 2 — Inngest cron wiring)
// Weekly regulatory intelligence digest: enumerates weekly org preferences,
// generates the payload, and dispatches email via the digest sender.

import { and, eq, ne } from 'drizzle-orm';
import type { DigestPayload } from '../../digest/digest-generator';
import { orgDigestPreferences } from '../../kernel/db/schema';
import { INNGEST_EVENTS, inngest } from '../client';

type DigestWeeklyTriggerData = { orgId?: string; weekId?: string };
type DigestPreference = Pick<typeof orgDigestPreferences.$inferSelect, 'orgId' | 'recipientEmails'>;
type DigestLogger = { error: (message: string, err?: unknown) => void };

export function buildDigestPreferencesPredicate(data: DigestWeeklyTriggerData) {
  return data.orgId
    ? and(
        eq(orgDigestPreferences.orgId, data.orgId),
        ne(orgDigestPreferences.frequency, 'disabled'),
      )
    : eq(orgDigestPreferences.frequency, 'weekly');
}

export async function processDigestPreference({
  generateWeeklyDigest,
  logger,
  pref,
  sendDigestEmail,
  weekId,
}: {
  generateWeeklyDigest: (
    orgId: string,
    weekId?: string,
    actorId?: string | null,
  ) => Promise<DigestPayload>;
  logger: DigestLogger;
  pref: DigestPreference;
  sendDigestEmail: (
    orgId: string,
    payload: DigestPayload,
    recipientEmails: string[],
  ) => Promise<boolean>;
  weekId?: string;
}): Promise<1> {
  try {
    // Issue #378 PR-E-③: generateWeeklyDigest writes digest_generated inside its
    // withTenantScope tx. The cron omits actorId → the audit records actor_id: null
    // (system actor). Prior to PR-E-③ the cron path wrote NO digest audit (gap);
    // automated digest generation is now auditable per 21 CFR Part 11 §11.10(e).
    const payload = await generateWeeklyDigest(pref.orgId, weekId);
    if (pref.recipientEmails.length > 0) {
      const sent = await sendDigestEmail(pref.orgId, payload, pref.recipientEmails);
      if (!sent) {
        throw new Error(`Digest email send failed for org ${pref.orgId}`);
      }
    }
    return 1;
  } catch (err) {
    logger.error(`[digest-cron] Failed for org ${pref.orgId}:`, err);
    throw err;
  }
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
    const { db } = await import('../../kernel/db/client');

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
      const count = await step.run(`digest-org-${pref.orgId}`, () =>
        processDigestPreference({
          generateWeeklyDigest,
          logger,
          pref,
          sendDigestEmail,
          weekId: data.weekId,
        }),
      );
      processed += count;
    }

    return { processed };
  },
);
