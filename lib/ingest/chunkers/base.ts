// @MX:ANCHOR [AUTO] Chunker base — shared constants and utilities for all document chunkers.
// @MX:REASON fan_in >= 3: all 8 class-specific chunkers, plus the registry and tests depend on this.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-046, REQ-DOC-047)
import type { DocClass } from '../doc-class';

export const MAX_CHUNK_TOKENS = 512;
export const OVERLAP_TOKENS = 64;
export const MIN_CHUNK_TOKENS = 64;

export interface ChunkMetadata {
  docClass: DocClass;
  sectionPath: string;
  pageNumber?: number;
  offset?: number;
  tokenCount: number;
}

export interface Chunk {
  text: string;
  metadata: ChunkMetadata;
}

export type ChunkerFn = (text: string, metadata: Record<string, unknown>) => Chunk[];

/**
 * Approximate token count using word-boundary heuristic (cl100k_base approximation).
 * ~4 chars per token on average for English regulatory text.
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  // Approximate: split on whitespace and punctuation for word count,
  // then apply ~1.3 tokens per word heuristic (regulatory text is denser than prose)
  const words = text.trim().split(/\s+/).filter(Boolean);
  return Math.ceil(words.length * 1.3);
}

/**
 * Split text into chunks by token count with overlap.
 * Returns array of text strings, each within maxTokens limit.
 */
export function splitByTokens(text: string, maxTokens: number, overlapTokens: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  // Approximate tokens per word
  const tokensPerWord = 1.3;
  const wordsPerChunk = Math.floor(maxTokens / tokensPerWord);
  const overlapWords = Math.floor(overlapTokens / tokensPerWord);

  if (words.length <= wordsPerChunk) {
    return [text.trim()];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    const chunkWords = words.slice(start, end);
    chunks.push(chunkWords.join(' '));

    if (end >= words.length) break;
    start = end - overlapWords;
    if (start >= end) start = end; // prevent infinite loop
  }

  return chunks;
}

/**
 * Generate ChunkMetadata for a chunk.
 */
export function generateChunkMetadata(
  docClass: DocClass,
  sectionPath: string,
  pageNumber?: number,
  offset?: number,
): ChunkMetadata {
  return {
    docClass,
    sectionPath,
    pageNumber,
    offset,
    tokenCount: 0, // caller fills in after splitting
  };
}

/**
 * Split text by heading patterns (# Heading, ## Heading, numbered headings).
 * Returns array of {heading, content} objects.
 */
export function splitByHeadings(text: string): Array<{ heading: string; content: string }> {
  // Match markdown headings or uppercase section headings
  const headingPattern = /^(#{1,4}\s+.+|[A-Z][A-Z\s]{2,}:?\s*$)/m;
  const lines = text.split('\n');
  const sections: Array<{ heading: string; content: string }> = [];
  let currentHeading = 'Document';
  let currentLines: string[] = [];

  for (const line of lines) {
    if (headingPattern.test(line.trim()) && line.trim().length > 0) {
      if (currentLines.join('\n').trim()) {
        sections.push({ heading: currentHeading, content: currentLines.join('\n').trim() });
      }
      currentHeading = line.replace(/^#+\s*/, '').trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.join('\n').trim()) {
    sections.push({ heading: currentHeading, content: currentLines.join('\n').trim() });
  }

  return sections.filter((s) => s.content.length > 0);
}
