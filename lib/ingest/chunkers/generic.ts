// @MX:NOTE [AUTO] Generic fallback chunker — heading-based + fixed-size splitting.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-053)
import { DocClass } from '../doc-class';
import type { Chunk, ChunkerFn } from './base';
import {
  MAX_CHUNK_TOKENS,
  OVERLAP_TOKENS,
  countTokens,
  splitByHeadings,
  splitByTokens,
} from './base';

export function makeGenericChunker(docClass: DocClass): ChunkerFn {
  return (text, _metadata): Chunk[] => {
    const chunks: Chunk[] = [];
    const sections = splitByHeadings(text);

    if (sections.length > 1) {
      for (const section of sections) {
        const subChunks = splitByTokens(section.content, MAX_CHUNK_TOKENS, OVERLAP_TOKENS);
        for (const sub of subChunks) {
          chunks.push({
            text: sub,
            metadata: { docClass, sectionPath: section.heading, tokenCount: countTokens(sub) },
          });
        }
      }
    } else {
      // No headings found — fixed-size split
      const subChunks = splitByTokens(text, MAX_CHUNK_TOKENS, OVERLAP_TOKENS);
      for (const sub of subChunks) {
        chunks.push({
          text: sub,
          metadata: { docClass, sectionPath: 'Document', tokenCount: countTokens(sub) },
        });
      }
    }

    return chunks;
  };
}

/** Default generic chunker instance (for internal_sop default). */
export const chunkGeneric = makeGenericChunker(DocClass.internal_sop);
