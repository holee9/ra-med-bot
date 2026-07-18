// @MX:ANCHOR: [AUTO] AUDIT_RESPONSE_STEPS — canonical step order for FDA audit response workflow
// @MX:REASON: fan_in >= 3: executor, route handler, and status route all reference this constant

export const AUDIT_RESPONSE_STEPS = [
  'deficiency_analysis',
  'root_cause_identification',
  'corrective_action_plan',
  'regulatory_reference_mapping',
  'response_drafting',
  'legal_review_gate',
] as const;

export type AuditResponseStep = (typeof AUDIT_RESPONSE_STEPS)[number];

/** Returns the 0-based index of the given step. */
export function getStepIndex(step: AuditResponseStep): number {
  return AUDIT_RESPONSE_STEPS.indexOf(step);
}

/** Type guard — returns true if the string is a valid AuditResponseStep. */
export function isValidStep(step: string): step is AuditResponseStep {
  return (AUDIT_RESPONSE_STEPS as readonly string[]).includes(step);
}

/** Returns the next step, or null if the current step is the last.
 *  Note: legal_review_gate is a human review gate step (21 CFR Part 11). */
export function getNextStep(current: AuditResponseStep): AuditResponseStep | null {
  const index = getStepIndex(current);
  if (index === AUDIT_RESPONSE_STEPS.length - 1) return null;
  return AUDIT_RESPONSE_STEPS[index + 1] ?? null;
}
