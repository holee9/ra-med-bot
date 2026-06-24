// @MX:NOTE [AUTO] runtime-guard.ts — block unapproved combinations at answer generation.
// @MX:ANCHOR [AUTO] assertApprovedCombination — SAFETY GATE for answer generation (REQ-MODELGOV-008).
// @MX:REASON REQ-MODELGOV-008 / AC-06 — unapproved prompt/model combo MUST block the LLM
//           call. This is a product safety gate, not a UX hint. Mirrors capa close-gate.
//           fan_in >= 3 expected (consult handler, refine handler, test fixtures).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-008, AC-06)

import { getActiveCombination } from './combination-resolver';
import { getRuntimeModel, runtimeMatchesApproved } from './runtime-model';
import type { ActiveCombination } from './types';

/**
 * REQ-MODELGOV-008: verify the active approved combination exists, matches the
 * requested combo (when promptId/modelPinId are provided), AND binds the running
 * model to the approved model_pin.
 *
 * Throw `RuntimeBlockError` when the combination is not approved. The caller
 * surfaces this as a 403 / error event and writes a `modelgov.runtime_blocked`
 * audit row. Do NOT swallow this error.
 *
 * Model binding (enforced): the active combination's model_pin (provider+model_id)
 * is compared to the runtime-configured model (env: LLM_PROVIDER + *_MODEL, the
 * same source getLlmModel reads). Mismatch blocks the call — swapping
 * OPENAI_MODEL/LLM_PROVIDER without an approved combo is detectable.
 *
 * @MX:TODO Prompt binding is tier2 and intentionally NOT enforced here. The consult
 *   path uses hardcoded composePrompt templates, not registry-sourced prompts, so
 *   binding the prompt requires resolving the running template to a registry
 *   content_hash — a deeper architectural change deferred until consult consumes
 *   registry-sourced prompts. When that lands, compare the active combo's
 *   prompt_registry.content_hash to the running template's hash here.
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

  // REQ-MODELGOV-008 model binding: the runtime-configured model (env) MUST match
  // the active approved combination's model_pin. Detects env-level model swaps.
  const runtime = getRuntimeModel();
  if (!runtimeMatchesApproved(runtime, active)) {
    throw new RuntimeBlockError(
      `model_mismatch:runtime=${runtime.provider}/${runtime.modelId}:approved=${active.modelProvider}/${active.modelId}`,
    );
  }

  return active;
}
