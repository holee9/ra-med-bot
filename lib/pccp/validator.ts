// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-016)
// PCCP completeness validation — SLO: 100% completion before submission.

import type { PccpCompletenessResult, PccpComponentType } from './types';

const REQUIRED_COMPONENTS: PccpComponentType[] = [
  'modification_description',
  'sps',
  'acp',
  'impact_assessment',
  'performance_testing',
];

export interface ComponentCompletionRecord {
  componentType: PccpComponentType;
  completedAt: Date | null;
}

/**
 * Validates that all 5 PCCP components are completed.
 * Returns a structured result with missing component list.
 */
export function validatePccpCompleteness(
  components: ComponentCompletionRecord[],
): PccpCompletenessResult {
  const completedTypes = new Set(
    components.filter((c) => c.completedAt !== null).map((c) => c.componentType),
  );

  const completedComponents = REQUIRED_COMPONENTS.filter((t) => completedTypes.has(t));
  const missingComponents = REQUIRED_COMPONENTS.filter((t) => !completedTypes.has(t));

  return {
    isComplete: missingComponents.length === 0,
    completedComponents,
    missingComponents,
    completionPercentage: Math.round(
      (completedComponents.length / REQUIRED_COMPONENTS.length) * 100,
    ),
  };
}

/**
 * Throws if PCCP is not complete. Use before status transitions to 'submitted'.
 */
export function assertPccpComplete(components: ComponentCompletionRecord[]): void {
  const result = validatePccpCompleteness(components);
  if (!result.isComplete) {
    throw new Error(
      `PCCP incomplete: missing components [${result.missingComponents.join(', ')}]. ` +
        `Completion: ${result.completionPercentage}%`,
    );
  }
}
