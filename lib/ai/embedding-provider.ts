// @MX:ANCHOR [AUTO] Embedding provider — single source of truth for embedding
//                       model instantiation + batch embedding.
// @MX:REASON fan_in >= 3: lib/ingest/embed.ts, lib/knowledge-promo/embedding.ts,
//           lib/knowledge-promo/semantic-search.ts, and all retrievers
//           (hybrid-search, promoted-answers, internal-sops) route through here.
//           Swapping the backend (gx10 Ollama, OpenAI-compatible) is an
//           env-level change in this file alone.
// @MX:SPEC SPEC-LLM-MIGRATION-A (Phase A-revised: GitHub Models → gx10 Ollama qwen3-embedding)

import { createOpenAI } from '@ai-sdk/openai';
import { type EmbeddingModel, embedMany } from 'ai';

// @MX:NOTE [AUTO] gx10 Ollama exposes an OpenAI-compatible /v1/embeddings endpoint.
// qwen3-embedding natively outputs 4096 dims but supports MRL truncation via the
// `dimensions` request param. We truncate to 1536 to keep pgvector vector(1536)
// (lib/db/schema.ts + schema-docingest.ts) byte-compatible — no migration needed,
// corpus stays valid. Local-network (192.168.100.x) trust; Ollama ignores the API
// key but @ai-sdk/openai requires a string, so a sentinel is supplied.
// Direct-verified 2026-07-01: dim=1536 truncation returns 1536-dim vectors (L-013).
const DEFAULT_BASE_URL = 'http://192.168.100.1:11434/v1';
const DEFAULT_MODEL = 'qwen3-embedding:latest';
const EMBEDDING_DIMENSIONS = 1536;
const NO_KEY_FALLBACK = 'ollama';
const DEFAULT_MAX_RETRIES = 3;

/**
 * Base URL for the embedding API. Defaults to the gx10 Ollama OpenAI-compatible
 * endpoint. Overridable via EMBEDDING_BASE_URL.
 */
export function getEmbeddingBaseUrl(): string {
  return process.env.EMBEDDING_BASE_URL ?? DEFAULT_BASE_URL;
}

/**
 * Embedding model id. Defaults to qwen3-embedding:latest on gx10. Output dim is
 * truncated to EMBEDDING_DIMENSIONS (MRL) so vectors match pgvector vector(1536).
 */
export function getEmbeddingModelId(): string {
  return process.env.EMBEDDING_MODEL ?? DEFAULT_MODEL;
}

/**
 * API key. Ollama on the local GX10 network is keyless (OLLAMA_HOST=0.0.0.0,
 * 192.168.100.x trust), but the SDK constructor requires a string. Falls back to
 * a sentinel so unit tests can import this module without a real key — the value
 * is never validated until a request is made (and Ollama ignores it then).
 */
export function getEmbeddingApiKey(): string {
  return process.env.EMBEDDING_API_KEY ?? NO_KEY_FALLBACK;
}

let aiSdkProvider: ReturnType<typeof createOpenAI> | null = null;

/**
 * Lazy singleton for the @ai-sdk/openai provider configured against the gx10
 * Ollama endpoint. Used by retrievers (via getEmbeddingModel) and the batch
 * embedder (via embedBatchTexts).
 */
function getAiSdkProvider(): ReturnType<typeof createOpenAI> {
  if (!aiSdkProvider) {
    aiSdkProvider = createOpenAI({
      baseURL: getEmbeddingBaseUrl(),
      apiKey: getEmbeddingApiKey(),
      name: 'gx10-ollama',
      // @MX:WARN Inject MRL truncation (dimensions:1536) into every /v1/embeddings
      //      request at the fetch layer — single source of truth.
      // @MX:REASON @ai-sdk/openai ^3 accepts `dimensions` only as a per-call
      //      providerOption (`providerOptions.openai.dimensions`), not as a model
      //      setting. Centralizing it via fetch middleware means every consumer
      //      (embedBatchTexts, retrievers, knowledge-promo, ingest) emits 1536-dim
      //      vectors without each having to thread providerOptions through its
      //      embed/embedMany call. Direct-verified against gx10 2026-07-01 (L-013).
      fetch: async (url, init) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (init?.body && urlStr.includes('/embeddings')) {
          try {
            const body = JSON.parse(String(init.body)) as Record<string, unknown>;
            if (body.dimensions === undefined) {
              body.dimensions = EMBEDDING_DIMENSIONS;
              init = { ...init, body: JSON.stringify(body) };
            }
          } catch {
            // Non-JSON body (e.g. multipart) — pass through unchanged.
          }
        }
        return globalThis.fetch(url as RequestInfo, init);
      },
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
 * Returns the centralized ai-sdk embedding model (qwen3-embedding on gx10,
 * truncated to 1536 dims via MRL). Every retriever/knowledge-promo consumer
 * should import this instead of `openai.embedding(...)` from @ai-sdk/openai
 * directly, so the backend is swappable at the env level.
 *
 * MRL truncation keeps pgvector vector(1536) byte-compatible — no schema
 * migration and no re-embedding of the (currently empty) corpus is required.
 */
export function getEmbeddingModel(): EmbeddingModelInstance {
  // `dimensions` truncation is applied at the fetch layer (see getAiSdkProvider),
  // not here — @ai-sdk/openai ^3 embedding() takes only the model id.
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
