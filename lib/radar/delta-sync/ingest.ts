// @MX:NOTE [AUTO] Incremental ingest — outdate existing chunks + prepare new ones.
// @MX:SPEC SPEC-REGULA-DELTA-SYNC-001 (REQ-DELTA-004, REQ-DELTA-005, REQ-DELTA-006)
//
// Reuses chunkers registry (generic chunker for Radar documents) for text
// segmentation. Embedding is deferred to the vectorstore layer so this module
// stays pure and unit-testable without OpenAI dependency (Enforce Simplicity).

import type { Chunk } from '../../ingest/chunkers/base';
import { chunk } from '../../ingest/chunkers/index';
import { DocClass } from '../../ingest/doc-class';

/**
 * A chunk with its embedding ready for insertion into source_sections.
 */
export interface EmbeddedChunk {
  text: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

/**
 * Delta between existing and new chunk state for a single source.
 * - added: new chunks to upsert
 * - outdated: existing chunk ids to mark superseded
 * - unchanged: existing chunk ids whose content hash matched (kept as-is)
 */
export interface ChunkDelta {
  added: EmbeddedChunk[];
  outdated: string[];
  unchanged: string[];
}

/**
 * Build per-chunk outdate operations for existing chunks.
 * Each operation marks a chunk as superseded by the new ingestion run (REQ-DELTA-005).
 * Hard delete is prohibited — 21 CFR Part 11 preservation.
 */
export function buildOutdateOperations(
  existingChunkIds: string[],
  newIngestionRunId: string,
): Array<{ id: string; supersededBy: string; updatedAt: Date }> {
  const updatedAt = new Date();
  return existingChunkIds.map((id) => ({
    id,
    supersededBy: newIngestionRunId,
    updatedAt,
  }));
}

/**
 * Segment a freshly crawled document into chunks using the chunkers registry.
 * The generic chunker is used because Radar documents are public regulatory
 * guidance, not one of the 8 internal DocClass types — generic is the correct
 * reuse path (no new chunker family created).
 *
 * Embedding is NOT performed here. Callers pass the chunk texts to
 * vectorstore.upsertWithRetry, which invokes the embedder inside the retry loop.
 */
export function chunkForDelta(params: {
  rawContent: string;
  sourceUrl: string;
  ingestionRunId: string;
}): Chunk[] {
  return chunk(DocClass.internal_sop, params.rawContent, {
    sourceUrl: params.sourceUrl,
    ingestionRunId: params.ingestionRunId,
  });
}

/**
 * Assemble embedded chunks from segmented text + precomputed embeddings.
 * Index alignment must match: chunk[i] ↔ embeddings[i].
 */
export function assembleEmbeddedChunks(
  chunks: Chunk[],
  embeddings: number[][],
  context: { sourceUrl: string; ingestionRunId: string },
): EmbeddedChunk[] {
  return chunks.map((c, i) => ({
    text: c.text,
    embedding: embeddings[i] ?? [],
    metadata: {
      ...c.metadata,
      sourceUrl: context.sourceUrl,
      ingestionRunId: context.ingestionRunId,
    },
  }));
}
