// @MX:ANCHOR: [AUTO] CER_STEPS — canonical 10-stage MEDDEV 2.7/1 Rev4 step order for CER workflow
// @MX:REASON: fan_in >= 3: route handler, workflow-system test, and registry all reference this
// @MX:SPEC SPEC-REGULA-CER-001 (REQ-CER-001~011)

export const CER_STEPS = [
  'device_identification',
  'intended_use',
  'clinical_background',
  'literature_search',
  'data_appraisal',
  'clinical_analysis',
  'equivalence_assessment',
  'risk_benefit',
  'conclusions',
  'pmcf_plan',
] as const;

export type CerStep = (typeof CER_STEPS)[number];

/** Returns the 0-based index of the given step. */
export function getStepIndex(step: CerStep): number {
  return CER_STEPS.indexOf(step);
}

/** Type guard — returns true if the string is a valid CerStep. */
export function isValidStep(step: string): step is CerStep {
  return (CER_STEPS as readonly string[]).includes(step);
}

/** Returns the next step, or null if the current step is the last. */
export function getNextStep(current: CerStep): CerStep | null {
  const index = getStepIndex(current);
  if (index === CER_STEPS.length - 1) return null;
  return CER_STEPS[index + 1] ?? null;
}
