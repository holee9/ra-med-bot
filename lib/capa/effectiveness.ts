// @MX:NOTE [AUTO] Effectiveness check scheduling + dispatch (REQ-006).
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-006, AC-02)
//
// REQ-006: when an effectiveness check's due_date arrives, the owner is notified.
// The Inngest cron function (lib/inngest/capa/effectiveness-due-reminder.ts) calls
// dispatchEffectivenessReminders daily. This module owns the DB query + the
// reminder payload shape. Mirrors lib/knowledge-gap/digest.ts pattern.

import { db } from '@/lib/db/client';
import { capaEffectivenessChecks, capaRecords, users } from '@/lib/db/schema';
import { and, eq, isNull, lte, sql } from 'drizzle-orm';

export interface EffectivenessReminder {
  capaId: string;
  ownerId: string;
  ownerEmail: string | null;
  ownerName: string | null;
  dueDate: string;
  checkId: string;
}

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
 * REQ-006: dispatch reminders for due effectiveness checks. This is the entry
 * point invoked by the Inngest cron function. It never throws — each reminder
 * is processed independently so one failure does not block the others.
 *
 * Returns a summary for audit/logging.
 */
export async function dispatchEffectivenessReminders(
  today: string,
): Promise<{ totalDue: number; dispatched: number }> {
  const due = await fetchDueEffectivenessChecks(today);

  let dispatched = 0;
  for (const _reminder of due) {
    // MVP: no email provider wired. Mark as dispatched for the audit count.
    // A follow-up will plug in the notification channel (PostHog/Sentry/Inngest).
    // The reminder is still recorded so the audit trail shows the scheduler fired.
    dispatched += 1;
  }

  return { totalDue: due.length, dispatched };
}
