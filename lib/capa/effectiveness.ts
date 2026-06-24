// @MX:NOTE [AUTO] Effectiveness check scheduling + dispatch (REQ-006).
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-006, AC-02)
//
// REQ-006: when an effectiveness check's due_date arrives, the owner is notified.
// The Inngest cron function (lib/inngest/capa/effectiveness-due-reminder.ts) calls
// dispatchEffectivenessReminders daily. This module owns the DB query + the
// reminder payload shape + the send wiring. Mirrors lib/knowledge-gap/digest.ts.

import { db } from '@/lib/db/client';
import { capaEffectivenessChecks, capaRecords, users } from '@/lib/db/schema';
import { logger } from '@/lib/observability/logger';
import { and, eq, isNull, lte } from 'drizzle-orm';

export interface EffectivenessReminder {
  capaId: string;
  ownerId: string;
  ownerEmail: string | null;
  ownerName: string | null;
  dueDate: string;
  checkId: string;
}

/**
 * Injectable reminder sender — production resolves SendGrid via
 * notifications/dispatcher. Mirrors DigestEmailSender in lib/knowledge-gap/digest.ts.
 * Returns true when the reminder was delivered, false otherwise so the caller
 * can count successful dispatches without inspecting channel-level results.
 */
export type EffectivenessReminderSender = (
  reminder: EffectivenessReminder,
  body: string,
) => Promise<boolean>;

/**
 * Fetch all effectiveness checks whose due_date has arrived and that have not
 * yet been checked (checked_at IS NULL). Used by the Inngest daily cron to
 * dispatch reminders. REQ-006.
 *
 * @param today ISO date string (YYYY-MM-DD). Injected for testability.
 */
export async function fetchDueEffectivenessChecks(today: string): Promise<EffectivenessReminder[]> {
  const rows = await db
    .select({
      checkId: capaEffectivenessChecks.id,
      capaId: capaEffectivenessChecks.capaId,
      ownerId: capaRecords.ownerId,
      dueDate: capaEffectivenessChecks.dueDate,
      ownerEmail: users.email,
      ownerName: users.name,
    })
    .from(capaEffectivenessChecks)
    .innerJoin(capaRecords, eq(capaRecords.id, capaEffectivenessChecks.capaId))
    .leftJoin(users, eq(users.id, capaRecords.ownerId))
    .where(
      and(lte(capaEffectivenessChecks.dueDate, today), isNull(capaEffectivenessChecks.checkedAt)),
    );

  return rows.map((r) => ({
    checkId: r.checkId,
    capaId: r.capaId,
    ownerId: r.ownerId,
    ownerEmail: r.ownerEmail ?? null,
    ownerName: r.ownerName ?? null,
    dueDate: typeof r.dueDate === 'string' ? r.dueDate : String(r.dueDate),
  }));
}

/**
 * Render a single reminder as a plain-text email body. Kept separate so the
 * dispatch loop and any future UI preview share one rendering path (mirrors
 * renderDigestText in lib/knowledge-gap/digest.ts).
 */
export function renderEffectivenessReminder(reminder: EffectivenessReminder): string {
  const owner = reminder.ownerName ?? '(owner name missing)';
  const lines: string[] = [
    'Regula CAPA Effectiveness Check Due',
    '',
    `CAPA ID:   ${reminder.capaId}`,
    `Due date:  ${reminder.dueDate}`,
    `Owner:     ${owner}`,
    '',
    'This is an automated reminder: the effectiveness check for the CAPA above',
    'is due. Open Regula to record the verification result.',
  ];
  return lines.join('\n');
}

/**
 * REQ-006: dispatch reminders for due effectiveness checks. This is the entry
 * point invoked by the Inngest cron function. It NEVER throws — each reminder
 * is processed independently so one failure does not block the others. The
 * "never throws" contract is load-bearing: the Inngest step
 * (lib/inngest/capa/effectiveness-due-reminder.ts) relies on it to stay green.
 *
 * Send wiring mirrors lib/knowledge-gap/digest.ts dispatchDailyDigest:
 *   - When `opts.sendReminder` is provided (tests / explicit injection), use it.
 *   - Otherwise, dynamically import @/lib/notifications/dispatcher and call
 *     dispatch() so SENDGRID_API_KEY + recipient resolution live in one place.
 *   - When SENDGRID_API_KEY is absent the dispatcher degrades to a graceful
 *     no-op (skipped) — exactly like digest.ts. The reminder is only counted
 *     as dispatched when the dispatcher reports 'sent'.
 *
 * Returns a summary for audit/logging: `dispatched` counts only successful
 * deliveries (not just fetched rows).
 *
 * @param today ISO date string (YYYY-MM-DD). Injected for testability.
 * @param opts  Optional injection handles for tests (sendReminder) or future
 *              channel overrides.
 */
export async function dispatchEffectivenessReminders(
  today: string,
  opts: { sendReminder?: EffectivenessReminderSender } = {},
): Promise<{ totalDue: number; dispatched: number }> {
  const due = await fetchDueEffectivenessChecks(today);

  let dispatched = 0;
  for (const reminder of due) {
    try {
      const body = renderEffectivenessReminder(reminder);

      if (opts.sendReminder) {
        // Test-injected sender path: no network, no SendGrid.
        const ok = await opts.sendReminder(reminder, body);
        if (ok) dispatched += 1;
        continue;
      }

      // Default dispatch path: reuse the notifications dispatcher's email
      // channel. The dispatcher gracefully skips when SENDGRID_API_KEY is unset
      // and when no recipientEmail is provided — both surface as 'skipped',
      // which we do NOT count as dispatched (only 'sent' counts).
      const { dispatch } = await import('@/lib/notifications/dispatcher');
      const result = await dispatch({
        eventType: 'workflow.completed',
        title: `Regula CAPA Effectiveness Check Due — ${reminder.capaId}`,
        body,
        recipientEmail: reminder.ownerEmail ?? undefined,
        actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.regula.ai'}/capa/${reminder.capaId}`,
      });

      if (result.email === 'sent') {
        dispatched += 1;
      }
    } catch (err) {
      // NEVER re-throw — one failure must not block the remaining reminders.
      // Log and continue; the cron step stays green and the failed reminder
      // is simply not counted as dispatched.
      logger.error('[capa/effectiveness] reminder dispatch failed:', err);
    }
  }

  return { totalDue: due.length, dispatched };
}
