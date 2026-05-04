// @MX:ANCHOR: [AUTO] SUBMISSION_DRAFTER_STEPS — canonical step order for 510(k) submission workflow
// @MX:REASON: fan_in >= 3: executor, route handler, and status route all reference this constant

export const SUBMISSION_DRAFTER_STEPS = [
  'device_classification',
  'predicate_search',
  'substantial_equivalence',
  'performance_summary',
  'labeling_review',
  'submission_assembly',
] as const;

export type SubmissionDrafterStep = (typeof SUBMISSION_DRAFTER_STEPS)[number];

/** Returns the 0-based index of the given step. */
export function getStepIndex(step: SubmissionDrafterStep): number {
  return SUBMISSION_DRAFTER_STEPS.indexOf(step);
}

/** Type guard — returns true if the string is a valid SubmissionDrafterStep. */
export function isValidStep(step: string): step is SubmissionDrafterStep {
  return (SUBMISSION_DRAFTER_STEPS as readonly string[]).includes(step);
}

/** Returns the next step, or null if the current step is the last. */
export function getNextStep(current: SubmissionDrafterStep): SubmissionDrafterStep | null {
  const index = getStepIndex(current);
  if (index === SUBMISSION_DRAFTER_STEPS.length - 1) return null;
  return SUBMISSION_DRAFTER_STEPS[index + 1] ?? null;
}
