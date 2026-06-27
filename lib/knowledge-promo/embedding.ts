// @MX:NOTE [AUTO] Embedding helper for promoted answers and messages.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-KNOWLEDGE-PROMO-002, REQ-002)
// @MX:REASON promoted_answers.embedding is computed at promotion time from
//           the source message prose. messages.embedding is computed at
//           persist time for assistant messages. Returns null when OpenAI is
//           unavailable (tests / no-key env) — persist still succeeds.

import { openai } from '@ai-sdk/openai';
import { type EmbeddingModel, embed } from 'ai';
import { logger } from '../observability/logger';

/**
 * Embed `text` via text-embedding-3-small (1536 dims — matches vector(1536)).
 * Returns the raw number[] for pgvector literal binding, or null on failure.
 */
export async function embedForPromotion(text: string): Promise<number[] | null> {
  if (!text) return null;
  try {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small') as unknown as EmbeddingModel<string>,
      value: text,
    });
    return embedding;
  } catch {
    // OpenAI key unavailable or transient failure — promote without embedding.
    return null;
  }
}

/**
 * Build a pgvector-compatible SQL literal `[v1,v2,...]` from an embedding.
 * Returns null when the embedding is null/empty.
 */
export function toVectorLiteral(embedding: number[] | null): string | null {
  if (!embedding || embedding.length === 0) return null;
  return `[${embedding.join(',')}]`;
}

/**
 * Embed `text` via text-embedding-3-small (1536 dims — matches vector(1536)).
 * Used for messages.embedding at persist time. Returns null on failure with
 * warning logged — message persist continues without embedding (graceful).
 */
export async function embedForMessage(text: string): Promise<number[] | null> {
  if (!text) return null;
  try {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small') as unknown as EmbeddingModel<string>,
      value: text,
    });
    return embedding;
  } catch (error) {
    logger.warn('Failed to generate embedding for message', { error });
    // OpenAI key unavailable or transient failure — persist without embedding.
    return null;
  }
}
