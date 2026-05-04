// @MX:NOTE [AUTO] 510(k) submission chunker — splits on 13 known FDA section headings.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-048)
import { DocClass } from '../doc-class';
import type { Chunk, ChunkerFn } from './base';
import { MAX_CHUNK_TOKENS, OVERLAP_TOKENS, countTokens, splitByTokens } from './base';

/** The 13 known 510(k) section headings per FDA guidance. */
export const FDA_510K_SECTIONS = [
  'Device Description',
  'Intended Use',
  'Substantial Equivalence Summary',
  'Standards',
  'Performance Testing',
  'Biocompatibility',
  'Sterilization',
  'Software',
  'EMC',
  'Labeling',
  'Comparison Table',
  'Summary Statement',
  'Substantial Equivalence Discussion',
] as const;

/**
 * Chunk a 510(k) submission by its known section headings.
 * Falls back to heading-based + fixed-size splitting when headings are absent.
 */
export const chunk510k: ChunkerFn = (text, _metadata): Chunk[] => {
  const chunks: Chunk[] = [];

  // Build regex pattern from known sections
  const sectionPattern = new RegExp(
    `^(${FDA_510K_SECTIONS.map((s) => s.replace(/[()]/g, '\\$&')).join('|')})\\s*$`,
    'im',
  );

  const lines = text.split('\n');
  let currentSection = 'Preamble';
  let currentLines: string[] = [];

  const flushSection = (section: string, content: string) => {
    if (!content.trim()) return;
    const subChunks = splitByTokens(content, MAX_CHUNK_TOKENS, OVERLAP_TOKENS);
    for (const sub of subChunks) {
      chunks.push({
        text: sub,
        metadata: {
          docClass: DocClass.submission_success,
          sectionPath: section,
          tokenCount: countTokens(sub),
        },
      });
    }
  };

  for (const line of lines) {
    if (sectionPattern.test(line.trim())) {
      flushSection(currentSection, currentLines.join('\n'));
      currentSection = line.trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  flushSection(currentSection, currentLines.join('\n'));

  // If no known sections found, fall back to generic chunking
  if (chunks.length === 0) {
    const subChunks = splitByTokens(text, MAX_CHUNK_TOKENS, OVERLAP_TOKENS);
    for (const sub of subChunks) {
      chunks.push({
        text: sub,
        metadata: {
          docClass: DocClass.submission_success,
          sectionPath: 'Generic',
          tokenCount: countTokens(sub),
        },
      });
    }
  }

  return chunks;
};
