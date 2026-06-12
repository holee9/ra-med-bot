// @MX:ANCHOR [AUTO] PCCP_STEPS — canonical 4-step order for PCCP builder workflow.
// @MX:REASON fan_in >= 3: route handler, workflow-system.test, and registry all reference this.
// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-001)

export const PCCP_STEPS = [
  'modification_description',
  'sps_acp',
  'impact_assessment',
  'performance_testing',
] as const;

export type PccpStep = (typeof PCCP_STEPS)[number];

export function getStepIndex(step: PccpStep): number {
  return PCCP_STEPS.indexOf(step);
}

export function isValidStep(step: string): step is PccpStep {
  return (PCCP_STEPS as readonly string[]).includes(step);
}

export function getNextStep(current: PccpStep): PccpStep | null {
  const index = getStepIndex(current);
  if (index === PCCP_STEPS.length - 1) return null;
  return PCCP_STEPS[index + 1] ?? null;
}
