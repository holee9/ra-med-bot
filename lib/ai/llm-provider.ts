// @MX:ANCHOR [AUTO] LLM provider abstraction — single source of chat model instantiation.
// @MX:REASON fan_in >= 3: intent.ts, router.ts, consult.ts, and every Phase B-migrated
//           site (11 call sites) route through here. gx10 Ollama is the sole chat backend.
// @MX:SPEC SPEC-LLM-MIGRATION-BC (Phase B fixup: ollama-ai-provider 도입)
//
// Why ollama-ai-provider (not @ai-sdk/openai): @ai-sdk/openai v3 ↔ Ollama are
// incompatible — both /v1/responses and .chat() /v1/chat/completions return empty
// content + null usage even though Ollama's response is well-formed (direct-verified
// 2026-07-01 via fetch trace). ollama-ai-provider uses Ollama's native /api/chat and
// parses content correctly (verified: text="OK"). Embedding stays on @ai-sdk/openai
// because it needs the OpenAI-compatible /v1/embeddings `dimensions` param (MRL 1536).

import type { LanguageModel } from 'ai';
import { createOllama } from 'ollama-ai-provider';

// gx10 Ollama native API root. createOllama appends `/chat`. OLLAMA_BASE_URL in
// .env.example/.env.local is OpenAI-compat (`/v1`); we strip the trailing `/v1`
// and use `/api` so chat routes to the native endpoint that parses correctly.
const DEFAULT_OLLAMA_BASE_URL = 'http://192.168.100.1:11434/api';
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

function resolveNativeBaseURL(): string {
  const raw = process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL;
  // .env.example/.env.local set the OpenAI-compat /v1 root; convert to native /api.
  if (/\/v1\/?$/.test(raw)) return raw.replace(/\/v1\/?$/, '/api');
  return raw;
}

function buildModel(role: 'main' | 'fast'): LanguageModel {
  const baseURL = resolveNativeBaseURL();
  const mainModel = process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL;
  const fastModel = process.env.OLLAMA_FAST_MODEL ?? mainModel;
  const modelName = role === 'fast' ? fastModel : mainModel;
  const ollama = createOllama({ baseURL, fetch: withThinkLevel });
  return ollama(modelName) as unknown as LanguageModel;
}

// Inject gpt-oss reasoning-effort (`think`) into /api/chat bodies at the fetch
// layer — ollama-ai-provider 1.2.0 predates thinking-model support, so this is
// the only non-invasive injection point (same pattern as the embedding
// provider's MRL dimensions middleware). OFF by default: measured 2026-10-19,
// think=low answers ~4x faster BUT the model drops citation-marker compliance
// (markers malformed → all citations stripped → coverage 0 → every consult
// low-confidence) and answers Korean questions in English. Citation quality IS
// the product, so the model's default reasoning stands; set OLLAMA_THINK=low
// to opt into the latency trade explicitly (e.g. for the fast router role).
function withThinkLevel(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr = typeof url === 'string' ? url : url.toString();
  const think = process.env.OLLAMA_THINK;
  let next = init;
  if (think && think !== 'default' && init?.body && urlStr.includes('/api/chat')) {
    try {
      const parsed = JSON.parse(String(init.body)) as Record<string, unknown>;
      if (parsed.think === undefined) {
        next = { ...init, body: JSON.stringify({ ...parsed, think }) };
      }
    } catch {
      // Non-JSON body — pass through unchanged.
    }
  }
  return globalThis.fetch(url, next);
}
