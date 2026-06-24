// @MX:NOTE [AUTO] runtime-guard.ts — block unapproved combinations at answer generation.
// @MX:ANCHOR [AUTO] assertApprovedCombination — SAFETY GATE for answer generation (REQ-MODELGOV-008).
// @MX:REASON REQ-MODELGOV-008 / AC-06 — unapproved prompt/model combo MUST block the LLM
//           call. This is a product safety gate, not a UX hint. Mirrors capa close-gate.
//           fan_in >= 3 expected (consult handler, refine handler, test fixtures).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-008, AC-06)

import { getActiveCombination } from './combination-resolver';
import type { ActiveCombination } from './types';

/**
 * REQ-MODELGOV-008: verify the active approved combination exists and (when
 * promptId/modelPinId are provided) matches the requested combo.
 *
 * Throw `RuntimeBlockError` when the combination is not approved. The caller
 * surfaces this as a 403 / error event and writes a `modelgov.runtime_blocked`
 * audit row. Do NOT swallow this error.
 *
 * When called without explicit promptId/modelPinId, it only asserts that an
 * active combination exists for the org (the resolver is the single source of
 * truth for which combo that is).
 */
export class RuntimeBlockError extends Error {
  constructor(public reason: string) {
    super(`model governance runtime block: ${reason}`);
    this.name = 'RuntimeBlockError';
  }
}

export async function assertApprovedCombination(params: {
  orgId: string;
  promptId?: string;
  modelPinId?: string;
}): Promise<ActiveCombination> {
  const active = await getActiveCombination(params.orgId);

  if (!active) {
    throw new RuntimeBlockError('no_active_approved_combination');
  }

  if (params.promptId && active.promptId !== params.promptId) {
    throw new RuntimeBlockError('prompt_not_in_active_combination');
  }

  if (params.modelPinId && active.modelPinId !== params.modelPinId) {
    throw new RuntimeBlockError('model_pin_not_in_active_combination');
  }

  return active;
}
