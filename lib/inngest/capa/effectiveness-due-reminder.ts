// @MX:NOTE [AUTO] CAPA effectiveness due-date reminder cron function.
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-006, AC-02)
// @MX:REASON Mirrors lib/inngest/digest/knowledge-gap-daily-digest.ts so the
//           Inngest serve endpoint discovers + triggers this function daily.
//           dispatchEffectivenessReminders never throws — it records the
//           audit-relevant count and returns, so the Inngest step stays green.

import { INNGEST_EVENTS, inngest } from '../client';

/** Cron schedule: every day at 08:30 UTC (15 min after the knowledge-gap digest). */
export const CAPA_EFFECTIVENESS_REMINDER_CRON = '30 8 * * *';

/**
 * Daily CAPA effectiveness reminder function. Registered with Inngest so the
 * dev/prod server triggers it on schedule. Optional manual trigger via the
 * capa/effectiveness.reminder.trigger event lets operators replay the sweep.
 */
export const capaEffectivenessDueReminderFn = inngest.createFunction(
  {
    id: 'capa-effectiveness-due-reminder',
    name: 'Daily CAPA Effectiveness Due Reminder',
    triggers: [
      { cron: CAPA_EFFECTIVENESS_REMINDER_CRON },
      { event: INNGEST_EVENTS.CAPA_EFFECTIVENESS_REMINDER_TRIGGER },
    ],
  },
  async ({ step, logger }) => {
    const { dispatchEffectivenessReminders } = await import('../../capa/effectiveness');

    const today = new Date().toISOString().slice(0, 10);
    const result = await step.run('dispatch-reminders', () =>
      dispatchEffectivenessReminders(today),
    );

    logger.info(
      `[capa-effectiveness] ${result.totalDue} due checks, ${result.dispatched} reminders dispatched`,
    );

    return {
      totalDue: result.totalDue,
      dispatched: result.dispatched,
    };
  },
);
