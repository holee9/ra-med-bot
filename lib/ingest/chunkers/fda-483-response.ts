// @MX:NOTE [AUTO] FDA 483 response chunker — observation-level chunking.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-052)
import { DocClass } from '../doc-class';
import type { Chunk, ChunkerFn } from './base';
import { MAX_CHUNK_TOKENS, OVERLAP_TOKENS, countTokens, splitByTokens } from './base';

interface ObservationMeta {
  observationNumber: number;
  rootCause?: string;
  correctiveActionSummary?: string;
}

function extractObservationMeta(text: string, num: number): ObservationMeta {
  const meta: ObservationMeta = { observationNumber: num };

  const rcMatch = text.match(/Root\s*Cause\s*:?\s*(.+?)(?:\n|Corrective)/is);
  if (rcMatch?.[1]) meta.rootCause = rcMatch[1].trim().slice(0, 200);

  const caMatch = text.match(/Corrective\s*Action\s*:?\s*(.+)/is);
  if (caMatch?.[1]) meta.correctiveActionSummary = caMatch[1].trim().slice(0, 200);

  return meta;
}

/**
 * Chunk an FDA 483 response at the observation level.
 * Each "Observation N" block becomes a separate chunk.
 */
export const chunkFda483Response: ChunkerFn = (text, _metadata): Chunk[] => {
  const chunks: Chunk[] = [];

  // Match "Observation N" or "Observation No. N" patterns
  const observationPattern = /^Observation\s*(?:No\.?\s*)?\d+/im;
  const lines = text.split('\n');

  let currentObsNum = 0;
  let currentSection = 'Preamble';
  let currentLines: string[] = [];

  const flush = (section: string, content: string, obsNum: number) => {
    if (!content.trim()) return;
    const meta = obsNum > 0 ? extractObservationMeta(content, obsNum) : {};
    const subChunks = splitByTokens(content, MAX_CHUNK_TOKENS, OVERLAP_TOKENS);
    for (const sub of subChunks) {
      chunks.push({
        text: sub,
        metadata: {
          docClass: DocClass.audit_response,
          sectionPath: section,
          tokenCount: countTokens(sub),
          ...meta,
        },
      });
    }
  };

  for (const line of lines) {
    if (observationPattern.test(line.trim())) {
      flush(currentSection, currentLines.join('\n'), currentObsNum);
      currentObsNum++;
      currentSection = `Observation ${currentObsNum}`;
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }
  flush(currentSection, currentLines.join('\n'), currentObsNum);

  if (chunks.length === 0) {
    for (const sub of splitByTokens(text, MAX_CHUNK_TOKENS, OVERLAP_TOKENS)) {
      chunks.push({
        text: sub,
        metadata: {
          docClass: DocClass.audit_response,
          sectionPath: 'Generic',
          tokenCount: countTokens(sub),
        },
      });
    }
  }
  return chunks;
};
