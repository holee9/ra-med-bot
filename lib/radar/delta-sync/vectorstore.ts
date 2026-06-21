// @MX:NOTE [AUTO] Vector store sync — pgvector upsert + Vectorize payload builder.
// @MX:SPEC SPEC-REGULA-DELTA-SYNC-001 (REQ-DELTA-007, REQ-DELTA-009, REQ-DELTA-010)
//
// pgvector: upsert by (document_id, chunk_index) — handled by caller via DB client.
// Cloudflare Vectorize: vectorize.upsert() with version metadata (public corpus).
// Retry policy: max 3 attempts for transient network failures.

/** Maximum retry attempts per SPEC-REGULA-DELTA-SYNC-001 completion criteria. */
export const MAX_RETRY_COUNT = 3;

/** Error substrings that indicate non-retryable failures. */
const NON_RETRYABLE_PATTERNS = [
  'pii guard',
  'invalid api key',
  'unauthorized',
  'forbidden',
  'bad request',
  'validation',
];

/**
 * Determine whether a sync failure should be retried.
 * Non-retryable: PII guard triggers, auth errors, validation errors.
 * Retryable: network timeouts, 429/503, transient connection failures.
 */
export function shouldRetry(errorMessage: string, currentRetryCount: number): boolean {
  if (currentRetryCount >= MAX_RETRY_COUNT) return false;

  const lower = errorMessage.toLowerCase();
  return !NON_RETRYABLE_PATTERNS.some((pattern) => lower.includes(pattern));
}

export interface VectorizeUpsertInput {
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export interface VectorizeUpsertEntry {
  id: string;
  values: number[];
  metadata: Record<string, unknown>;
}

/**
 * Build the Cloudflare Vectorize upsert payload from embedded chunks.
 * Includes version metadata for incremental tracking (REQ-DELTA-010).
 */
export function buildVectorizeUpsertPayload(
  chunks: VectorizeUpsertInput[],
  context: { ingestionRunId: string; corpus: string },
): VectorizeUpsertEntry[] {
  return chunks.map((c) => ({
    id: c.id,
    values: c.embedding,
    metadata: {
      ...c.metadata,
      content: c.text,
      ingestionRunId: context.ingestionRunId,
      corpus: context.corpus,
      version: Date.now(),
    },
  }));
}

/**
 * Execute a vector store upsert with retry policy.
 * Callers provide the actual upsert function (pgvector or Vectorize binding).
 */
export async function upsertWithRetry<T>(
  upsertFn: () => Promise<T>,
  errorMessage: string,
  currentRetryCount: number,
  retryDelayMs: (attempt: number) => number,
): Promise<{ result: T | null; nextRetryCount: number; exhausted: boolean }> {
  if (!shouldRetry(errorMessage, currentRetryCount)) {
    return { result: null, nextRetryCount: currentRetryCount, exhausted: true };
  }

  try {
    const result = await upsertFn();
    return { result, nextRetryCount: 0, exhausted: false };
  } catch (_err) {
    const nextRetryCount = currentRetryCount + 1;
    if (nextRetryCount >= MAX_RETRY_COUNT) {
      return { result: null, nextRetryCount, exhausted: true };
    }
    return { result: null, nextRetryCount, exhausted: false };
  }
}

/**
 * Default retry delay: exponential backoff 1s, 2s, 4s.
 */
export function defaultRetryDelay(attempt: number): number {
  return 2 ** attempt * 1000;
}
