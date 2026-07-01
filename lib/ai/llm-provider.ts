// @MX:ANCHOR [AUTO] LLM provider abstraction — single source of model instantiation.
// @MX:REASON fan_in >= 3: intent.ts, router.ts, consult.ts, and every Phase B-migrated
//           site (11 call sites) route through here. gx10 Ollama is the sole chat backend.
// @MX:SPEC SPEC-LLM-MIGRATION-BC (Phase C: 외부 API 키/의존성 제거 — ollama-only)

import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

// gx10 Ollama is the only supported chat backend (#318 — 외부 API 전면 배제, 과금 0).
// LLM_PROVIDER is retained in .env.local for operator visibility but has no
// routing effect; any value resolves to the gx10 Ollama client below so the
// pipeline never crashes hard. Direct-verified 2026-07-01.
const DEFAULT_OLLAMA_BASE_URL = 'http://192.168.100.1:11434/v1';
const DEFAULT_OLLAMA_MODEL = 'gpt-oss:120b';

/**
 * Returns the main (smart) language model for prose generation.
 * Both main and fast resolve to gx10 gpt-oss:120b unless OLLAMA_FAST_MODEL
 * overrides the fast role.
 */
export function getLlmModel(): LanguageModel {
  return buildModel('main');
}

/**
 * Returns the fast language model for intent classification and routing.
 * Falls back to the main model when OLLAMA_FAST_MODEL is unset.
 */
export function getLlmFastModel(): LanguageModel {
  return buildModel('fast');
}

function buildModel(role: 'main' | 'fast'): LanguageModel {
  const baseURL = process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL;
  const mainModel = process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL;
  const fastModel = process.env.OLLAMA_FAST_MODEL ?? mainModel;
  const modelName = role === 'fast' ? fastModel : mainModel;
  // gx10 Ollama exposes an OpenAI-compatible endpoint; apiKey is ignored on the
  // local 192.168.100.x trust network but required as a string by the SDK.
  const ollama = createOpenAI({ baseURL, apiKey: 'ollama', name: 'gx10-ollama' });
  return ollama(modelName) as unknown as LanguageModel;
}
