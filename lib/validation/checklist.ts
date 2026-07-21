// @MX:ANCHOR [AUTO] Sign-off checklist definition — REQ-VAL-013 / AC-8.
// @MX:REASON SPEC-REGULA-VALIDATION-001 M5. fan_in >= 3: build-report.ts (renders
//   checklist section), signoff route (evaluates gate), tests (assert shape). The
//   checklist is the sign-off invariant — every item MUST be met for HTTP 200.
//   Unmet items surface as HTTP 409 with the failed list (AC-8).
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (REQ-VAL-013, AC-8, Issue #49)

import type { ChecklistItem } from '@/lib/kernel/schemas/validation';

/**
 * Canonical sign-off checklist item ids. Used by build-report (rendering),
 * signoff route (gate evaluation), and tests. Adding an item tightens the
 * release gate — do so via PR + plan-auditor review.
 *
 * Each id encodes the qualification it derives from:
 *   - iq:* / oq:* / pq:*     — at least one evidence row with result='pass'
 *   - changes:resolved      — no high-impact change without rerun evidence
 *   - report:exported       — Release Validation Report Markdown file exists
 */
export const CHECKLIST_IDS = [
  'iq:pass',
  'oq:pass',
  'pq:pass',
  'changes:resolved',
  'report:exported',
] as const;

export type ChecklistId = (typeof CHECKLIST_IDS)[number];

/** Human-readable title for each checklist id. Rendered in the report. */
export const CHECKLIST_TITLES: Record<ChecklistId, string> = {
  'iq:pass': 'IQ evidence bundle recorded (pass)',
  'oq:pass': 'OQ evidence bundle recorded (pass)',
  'pq:pass': 'PQ evidence bundle recorded (pass)',
  'changes:resolved': 'High-impact changes have rerun evidence or residual-risk record',
  'report:exported': 'Release Validation Report Markdown exported',
};

/** Full checklist template with `met: false` — starting state for evaluation. */
export const EMPTY_CHECKLIST: ChecklistItem[] = CHECKLIST_IDS.map((id) => ({
  id,
  title: CHECKLIST_TITLES[id],
  met: false,
}));

/**
 * Compute the canonical checklist from evidence + change-control + report state.
 * Returns a fresh array (does not mutate input).
 *
 * Inputs:
 *   - hasIqPass: at least one validation_evidence row q='iq' result='pass'
 *   - hasOqPass: same for 'oq'
 *   - hasPqPass: same for 'pq'
 *   - rerunGatePassed: evaluateRerunGate().passed (no blocking axes)
 *   - reportExported: build-report.ts wrote docs/validation/release-report-*.md
 */
export function buildChecklist(input: {
  hasIqPass: boolean;
  hasOqPass: boolean;
  hasPqPass: boolean;
  rerunGatePassed: boolean;
  reportExported: boolean;
}): ChecklistItem[] {
  return [
    { id: 'iq:pass', title: CHECKLIST_TITLES['iq:pass'], met: input.hasIqPass },
    { id: 'oq:pass', title: CHECKLIST_TITLES['oq:pass'], met: input.hasOqPass },
    { id: 'pq:pass', title: CHECKLIST_TITLES['pq:pass'], met: input.hasPqPass },
    {
      id: 'changes:resolved',
      title: CHECKLIST_TITLES['changes:resolved'],
      met: input.rerunGatePassed,
    },
    {
      id: 'report:exported',
      title: CHECKLIST_TITLES['report:exported'],
      met: input.reportExported,
    },
  ];
}

/** Return only the unmet items — the payload of the HTTP 409 response (AC-8). */
export function unmetItems(checklist: ChecklistItem[]): ChecklistItem[] {
  return checklist.filter((item) => !item.met);
}

/** True when every item is met — gate condition for sign-off (REQ-VAL-013). */
export function isChecklistSatisfied(checklist: ChecklistItem[]): boolean {
  return checklist.length > 0 && checklist.every((item) => item.met);
}
