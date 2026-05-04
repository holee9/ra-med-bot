// @MX:ANCHOR: [AUTO] INDICATION_IMPACT_STEPS — canonical step order for indication impact workflow
// @MX:REASON: fan_in >= 3: executor, route handler, and status route all reference this constant

export const INDICATION_IMPACT_STEPS = [
  'indication_comparison',
  'regulatory_pathway_assessment',
  'predicate_impact_analysis',
  'clinical_data_gap_analysis',
  'market_specific_requirements',
  'impact_report_generation',
] as const;

export type IndicationImpactStep = (typeof INDICATION_IMPACT_STEPS)[number];

/** Returns the 0-based index of the given step. */
export function getStepIndex(step: IndicationImpactStep): number {
  return INDICATION_IMPACT_STEPS.indexOf(step);
}

/** Type guard — returns true if the string is a valid IndicationImpactStep. */
export function isValidStep(step: string): step is IndicationImpactStep {
  return (INDICATION_IMPACT_STEPS as readonly string[]).includes(step);
}

/** Returns the next step, or null if the current step is the last. */
export function getNextStep(current: IndicationImpactStep): IndicationImpactStep | null {
  const index = getStepIndex(current);
  if (index === INDICATION_IMPACT_STEPS.length - 1) return null;
  return INDICATION_IMPACT_STEPS[index + 1] ?? null;
}
