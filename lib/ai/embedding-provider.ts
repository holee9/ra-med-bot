// @MX:ANCHOR [AUTO] Embedding provider — single source of truth for embedding
//                       model instantiation + batch embedding.
// @MX:REASON fan_in >= 3: lib/ingest/embed.ts, lib/knowledge-promo/embedding.ts,
//           lib/knowledge-promo/semantic-search.ts, and all retrievers
//           (hybrid-search, promoted-answers, internal-sops) route through here.
//           Swapping the backend (GitHub Models API, OpenAI-compatible) is an
//           env-level change in this file alone.
// @MX:SPEC SPEC-LLM-MIGRATION-A (Phase A: OpenAI → GitHub Models embedding)

import { createOpenAI } from '@ai-sdk/openai';
import { type EmbeddingModel, embedMany } from 'ai';

// @MX:NOTE [AUTO] GitHub Models API is an OpenAI-compatible inference endpoint.
// Defaults match the Regula charter (abyz internal, text-embedding-3-small 1536-dim).
// The token is a GitHub PAT with Models scope; supplied by the operator via .env.local.
const DEFAULT_BASE_URL = 'https://models.github.ai/inference';
const DEFAULT_MODEL = 'text-embedding-3-small';
const NO_KEY_FALLBACK = 'no-key-in-test';
const DEFAULT_MAX_RETRIES = 3;

/**
 * Base URL for the embedding API. Overridable via EMBEDDING_BASE_URL for
 * testing or Azure AI Foundry migration (Phase D+).
 */
export function getEmbeddingBaseUrl(): string {
  return process.env.EMBEDDING_BASE_URL ?? DEFAULT_BASE_URL;
}

/**
 * Embedding model id. Defaults to text-embedding-3-small (1536-dim, matches
 * pgvector vector(1536) in lib/db/schema.ts + schema-docingest.ts).
 */
export function getEmbeddingModelId(): string {
  return process.env.EMBEDDING_MODEL ?? DEFAULT_MODEL;
}

/**
 * API key (GitHub PAT with Models scope). Falls back to a sentinel so unit
 * tests can import this module without a real key — the SDK constructor
 * requires a string but never validates until a request is made.
 */
export function getEmbeddingApiKey(): string {
  return process.env.GITHUB_MODELS_TOKEN ?? NO_KEY_FALLBACK;
}

let aiSdkProvider: ReturnType<typeof createOpenAI> | null = null;

/**
 * Lazy singleton for the @ai-sdk/openai provider configured against the
 * GitHub Models endpoint. Used by retrievers (via getEmbeddingModel) and
 * the batch embedder (via embedBatchTexts).
 */
function getAiSdkProvider(): ReturnType<typeof createOpenAI> {
  if (!aiSdkProvider) {
    aiSdkProvider = createOpenAI({
      baseURL: getEmbeddingBaseUrl(),
      apiKey: getEmbeddingApiKey(),
      name: 'github-models',
    });
  }
  return aiSdkProvider;
}

/**
 * The ai-sdk embedding model type returned by the configured provider.
 * Derived from the provider's own `.embedding()` signature so we don't need
 * a direct dependency on @ai-sdk/provider (an indirect dep we don't own).
 */
export type EmbeddingModelInstance = ReturnType<ReturnType<typeof createOpenAI>['embedding']>;

/**
 * Returns the centralized ai-sdk embedding model (text-embedding-3-small by
 * default). Every retriever/knowledge-promo consumer should import this
 * instead of `openai.embedding(...)` from @ai-sdk/openai directly, so the
 * backend is swappable at the env level.
 *
 * Same model id as before Phase A → vectors are byte-equivalent; no
 * re-embedding of the (currently empty) corpus is required.
 */
export function getEmbeddingModel(): EmbeddingModelInstance {
  return getAiSdkProvider().embedding(getEmbeddingModelId());
}

/**
 * Batch-embed an array of texts using the centralized model. Used by
 * lib/ingest/embed.ts (with its PII guard) and any path that needs raw
 * number[][] output rather than the ai-sdk embed() wrapper.
 *
 * Retries with exponential backoff on transient failures. Throws if all
 * retries are exhausted.
 */
export async function embedBatchTexts(
  texts: string[],
  opts: { maxRetries?: number } = {},
): Promise<number[][]> {
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { embeddings } = await embedMany({
        // @MX:NOTE Cast bridges v3 provider model → v1 SDK type. Same pattern as
        //           every retriever consumer (hybrid-search, promoted-answers, etc.).
        model: getEmbeddingModel() as unknown as EmbeddingModel<string>,
        values: texts,
      });
      return embeddings;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
      }
    }
  }
  throw new Error(`Embedding failed after ${maxRetries} attempts: ${lastError}`);
}
