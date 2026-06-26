// @MX:NOTE [AUTO] Standards transition-milestone calculator (pure functions).
// @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-STANDARDS-010/012, AC-05)
//
// Pure date arithmetic — no DB, no I/O. Fully unit-testable. The cron caller
// (standards-revision-daily) computes milestones for each standards_updates row
// and emits an alert when the current date crosses a milestone boundary.
//
// @MX:TODO #62-A — ZERO production callers today. Consumed only by
//   emitStandardsAlert (also zero callers). Both are reserved for #62-A:
//   when live crawlers populate detectRevisions() with real data, the cron
//   will call emitStandardsAlert → calculateTransitionMilestones per detected
//   revision. Honest deferral per Charter scope discipline — no synthetic smoke.

/**
 * Transition milestones for a harmonized-standard revision.
 *
 * MDR/IVDR convention (EU OJ publication → Date of Withdrawal, DoW):
 * - D-12: 12 months before DoW — info tier ("revision available, plan adoption")
 * - D-6:  6 months before DoW  — warn tier ("adoption window narrowing")
 * - D-3:  3 months before DoW  — critical tier ("deadline imminent")
 * - dow:  Date of Withdrawal — critical (certificates against old revision invalid)
 *
 * Null inputs return null milestones — the caller skips alerting for that row.
 */
export interface TransitionMilestones {
  /** 12 months before DoW (info tier trigger). */
  d12: Date | null;
  /** 6 months before DoW (warn tier trigger). */
  d6: Date | null;
  /** 3 months before DoW (critical tier trigger). */
  d3: Date | null;
  /** Date of Withdrawal (hard cutoff). */
  dow: Date | null;
}

export type AlertTier = 'info' | 'warn' | 'critical';

export interface TransitionState {
  milestones: TransitionMilestones;
  /** Current tier based on `now`. null before D-12 and after DoW+grace. */
  currentTier: AlertTier | null;
  /** Days until DoW (negative = past DoW). */
  daysToDow: number | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  // Compute target year/month directly to avoid setMonth rollover quirks
  // (setMonth(-60) does not reliably subtract 60 months across leap years).
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = ((total % 12) + 12) % 12;
  d.setUTCFullYear(targetYear);
  d.setUTCMonth(targetMonth);
  return d;
}

/**
 * Calculate D-12/D-6/D-3/DoW milestones from the EU OJ publication date and
 * the (optional) Date of Withdrawal. When DoW is absent, the EU MDR default
 * transition window of 5 years after OJ publication is used (Regulation (EU)
 * 2017/745 Art. 120 transitional provision).
 */
export function calculateTransitionMilestones(
  ojPublicationDate: Date | string | null,
  dow: Date | string | null,
): TransitionMilestones {
  if (!ojPublicationDate && !dow) {
    return { d12: null, d6: null, d3: null, dow: null };
  }

  const dowDate = dow ? new Date(dow) : null;
  // Fallback: 5-year transition from OJ publication (MDR Art. 120 default).
  const ojDate = ojPublicationDate ? new Date(ojPublicationDate) : null;
  const effectiveDow = dowDate ?? (ojDate ? addMonths(ojDate, 60) : null);

  if (!effectiveDow) {
    return { d12: null, d6: null, d3: null, dow: null };
  }

  return {
    d12: addMonths(effectiveDow, -12),
    d6: addMonths(effectiveDow, -6),
    d3: addMonths(effectiveDow, -3),
    dow: effectiveDow,
  };
}

/**
 * Determine the current alert tier for a transition timeline at `now`.
 * Returns null before D-12 (too early to alert) and 'critical' on/after DoW.
 */
export function getTransitionState(
  milestones: TransitionMilestones,
  now: Date = new Date(),
): TransitionState {
  if (!milestones.dow) {
    return { milestones, currentTier: null, daysToDow: null };
  }

  const nowMs = now.getTime();
  const dowMs = milestones.dow.getTime();
  const daysToDow = Math.round((dowMs - nowMs) / MS_PER_DAY);

  // Past DoW+grace (grace = 0 days; DoW is the hard cutoff).
  // Keep emitting 'critical' for 365 days after DoW so laggard products still
  // get flagged — after that the row is historical and alerts cease.
  if (daysToDow < -365) {
    return { milestones, currentTier: null, daysToDow };
  }
  if (nowMs >= dowMs || daysToDow <= 0) {
    return { milestones, currentTier: 'critical', daysToDow };
  }
  if (milestones.d3 && nowMs >= milestones.d3.getTime()) {
    return { milestones, currentTier: 'critical', daysToDow };
  }
  if (milestones.d6 && nowMs >= milestones.d6.getTime()) {
    return { milestones, currentTier: 'warn', daysToDow };
  }
  if (milestones.d12 && nowMs >= milestones.d12.getTime()) {
    return { milestones, currentTier: 'info', daysToDow };
  }
  return { milestones, currentTier: null, daysToDow };
}
