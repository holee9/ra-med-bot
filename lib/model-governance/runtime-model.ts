// @MX:NOTE [AUTO] runtime-model.ts — resolve the runtime-configured model id/provider.
// @MX:REASON REQ-MODELGOV-008 — assertApprovedCombination must compare the active
//           approved combination's model_pin to the model ACTUALLY running (env-configured
//           via getLlmModel in lib/ai/llm-provider.ts). Reading the env here keeps the
//           guard coupled to the same source of truth that instantiates the LLM client,
//           so swapping OLLAMA_MODEL is detectable.
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-008, AC-06)
// @MX:SPEC SPEC-LLM-MIGRATION-BC (Phase C: ollama-only)

export interface RuntimeModel {
  provider: string;
  modelId: string;
}

/**
 * Resolve the model the runtime will actually use for prose generation.
 * Mirrors the env precedence in lib/ai/llm-provider.ts buildModel('main').
 *
 * @MX:ANCHOR [AUTO] getRuntimeModel — single source of truth for the runtime model id.
 * @MX:REASON fan_in >= 3 expected (runtime-guard, consult audit, tests). Keeping the
 *           env-reading centralized means the guard never drifts from getLlmModel.
 *
 * Phase C (#318): gx10 Ollama is the sole chat backend. `provider` is always
 * 'ollama'; LLM_PROVIDER has no routing effect (retained in env only for
 * operator visibility).
 */
export function getRuntimeModel(): RuntimeModel {
  return {
    provider: 'ollama',
    modelId: process.env.OLLAMA_MODEL ?? 'gpt-oss:120b',
  };
}

/**
 * Compare the runtime model to the approved combination's model_pin.
 * provider + modelId MUST match exactly. model_version is intentionally NOT
 * compared here because the runtime env does not carry a separate version
 * string (the modelId IS the versioned identifier, e.g. 'gpt-oss:120b').
 */
export function runtimeMatchesApproved(
  runtime: RuntimeModel,
  approved: { modelProvider: string; modelId: string },
): boolean {
  return (
    runtime.provider.toLowerCase() === approved.modelProvider.toLowerCase() &&
    runtime.modelId === approved.modelId
  );
}
