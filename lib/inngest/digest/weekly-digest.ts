// @MX:TODO: [AUTO] Inngest cron not yet wired — reserved for SPEC-REGULA-DIGEST-001 Phase 2.
// @MX:SPEC SPEC-REGULA-DIGEST-001
// When Inngest is wired, register this function with:
//   inngest.createFunction({ id: 'weekly-digest-cron', cron: '0 0 * * 1' }, async ({ step }) => { ... })

export interface DigestCronEvent {
  name: 'digest.weekly.trigger';
  data: { orgId?: string; weekId?: string };
}

// Cron schedule: '0 0 * * 1' = Every Monday at 00:00 UTC (orgs apply their own timezone offset)
export const DIGEST_CRON_SCHEDULE = '0 0 * * 1';

export const weeklyDigestFn = {
  id: 'digest-weekly-cron',
  name: 'Weekly Regulatory Intelligence Digest',
  cron: DIGEST_CRON_SCHEDULE,

  // @MX:TODO: [AUTO] Wire Inngest client when SPEC-REGULA-DOCINGEST-001 Inngest setup completes
  async run(event: DigestCronEvent): Promise<{ processed: number }> {
    const { generateWeeklyDigest } = await import('../../digest/digest-generator');
    const { sendDigestEmail } = await import('../../digest/email-sender');
    const { db } = await import('../../db/client');
    const { orgDigestPreferences } = await import('../../db/schema');
    const { ne } = await import('drizzle-orm');

    const prefs = event.data.orgId
      ? await db
          .select()
          .from(orgDigestPreferences)
          .where(ne(orgDigestPreferences.frequency, 'disabled'))
          .limit(1)
      : await db
          .select()
          .from(orgDigestPreferences)
          .where(ne(orgDigestPreferences.frequency, 'disabled'));

    let processed = 0;
    for (const pref of prefs) {
      try {
        const payload = await generateWeeklyDigest(pref.orgId, event.data.weekId);
        if (pref.recipientEmails.length > 0) {
          await sendDigestEmail(pref.orgId, payload, pref.recipientEmails);
        }
        processed++;
      } catch (err) {
        console.error(`[digest-cron] Failed for org ${pref.orgId}:`, err);
      }
    }
    return { processed };
  },
};
