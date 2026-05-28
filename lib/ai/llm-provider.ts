// @MX:ANCHOR [AUTO] LLM provider abstraction — single source of model instantiation.
// @MX:REASON fan_in >= 3: intent.ts, router.ts, consult.ts. Swap the provider at env level.
// Supported: ollama (default, local) | openai | anthropic
// Future: oauth-subscription (REQ-LLM-OAUTH, planned)

import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

export type LlmProviderName = 'ollama' | 'openai' | 'anthropic';

/**
 * Returns the main (smart) language model for prose generation.
 * Configured via LLM_PROVIDER + provider-specific env vars.
 */
export function getLlmModel(): LanguageModel {
  return buildModel('main');
}

/**
 * Returns the fast (small) language model for intent classification and routing.
 * Falls back to the main model when no fast model is configured.
 */
export function getLlmFastModel(): LanguageModel {
  return buildModel('fast');
}

function buildModel(role: 'main' | 'fast'): LanguageModel {
  const provider = (process.env.LLM_PROVIDER ?? 'ollama') as LlmProviderName;

  switch (provider) {
    case 'ollama': {
      const baseURL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1';
      const mainModel = process.env.OLLAMA_MODEL ?? 'llama3.2';
      const fastModel = process.env.OLLAMA_FAST_MODEL ?? mainModel;
      const modelName = role === 'fast' ? fastModel : mainModel;
      // Ollama exposes an OpenAI-compatible endpoint; apiKey is ignored but required by the SDK.
      const ollama = createOpenAI({ baseURL, apiKey: 'ollama' });
      return ollama(modelName) as unknown as LanguageModel;
    }

    case 'openai': {
      const { openai } = require('@ai-sdk/openai') as typeof import('@ai-sdk/openai');
      const mainModel = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
      const fastModel = process.env.OPENAI_FAST_MODEL ?? mainModel;
      return openai(role === 'fast' ? fastModel : mainModel) as unknown as LanguageModel;
    }

    case 'anthropic': {
      const { anthropic } = require('@ai-sdk/anthropic') as typeof import('@ai-sdk/anthropic');
      const mainModel = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';
      const fastModel = process.env.ANTHROPIC_FAST_MODEL ?? 'claude-haiku-4-5';
      return anthropic(role === 'fast' ? fastModel : mainModel) as unknown as LanguageModel;
    }

    default: {
      // Unknown provider — fall back to Ollama so the pipeline never crashes hard.
      const baseURL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1';
      const modelName = process.env.OLLAMA_MODEL ?? 'llama3.2';
      const ollama = createOpenAI({ baseURL, apiKey: 'ollama' });
      return ollama(modelName) as unknown as LanguageModel;
    }
  }
}
