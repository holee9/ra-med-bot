// @MX:NOTE [AUTO] runtime-model.ts — resolve the runtime-configured model id/provider.
// @MX:REASON REQ-MODELGOV-008 — assertApprovedCombination must compare the active
//           approved combination's model_pin to the model ACTUALLY running (env-configured
//           via getLlmModel in lib/ai/llm-provider.ts). Reading the env here keeps the
//           guard coupled to the same source of truth that instantiates the LLM client,
//           so swapping OPENAI_MODEL/LLM_PROVIDER is detectable.
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-008, AC-06)

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
 */
export function getRuntimeModel(): RuntimeModel {
  const provider = (process.env.LLM_PROVIDER ?? 'ollama').toLowerCase();

  switch (provider) {
    case 'openai':
      return { provider: 'openai', modelId: process.env.OPENAI_MODEL ?? 'gpt-4o-mini' };
    case 'anthropic':
      return { provider: 'anthropic', modelId: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5' };
    default:
      // Unknown provider falls back to ollama (mirrors lib/ai/llm-provider.ts
      // buildModel default branch — pipeline never crashes hard).
      return { provider: 'ollama', modelId: process.env.OLLAMA_MODEL ?? 'llama3.2' };
  }
}

/**
 * Compare the runtime model to the approved combination's model_pin.
 * provider + modelId MUST match exactly. model_version is intentionally NOT
 * compared here because the runtime env does not carry a separate version
 * string (the modelId IS the versioned identifier, e.g. 'claude-sonnet-4-5').
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
