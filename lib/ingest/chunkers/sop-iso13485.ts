// @MX:NOTE [AUTO] SOP chunker — ISO 13485 3-part: header, revision history, body sections.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-050)
import { DocClass } from '../doc-class';
import type { Chunk, ChunkerFn } from './base';
import { MAX_CHUNK_TOKENS, OVERLAP_TOKENS, countTokens, splitByTokens } from './base';

export const chunkSopIso13485: ChunkerFn = (text, _metadata): Chunk[] => {
  const chunks: Chunk[] = [];
  const lines = text.split('\n');

  // Detect revision history table
  const revHistoryIdx = lines.findIndex((l) => /revision\s*history|change\s*log/i.test(l));
  // Detect first numbered body section (1., 2., 1.0, etc.)
  const bodyStartIdx = lines.findIndex((l, i) => i > (revHistoryIdx > -1 ? revHistoryIdx + 2 : 0) && /^\d+[\.\s]/.test(l.trim()));

  const headerLines = lines.slice(0, revHistoryIdx > -1 ? revHistoryIdx : bodyStartIdx > -1 ? bodyStartIdx : Math.min(10, lines.length));
  const headerText = headerLines.join('\n').trim();
  if (headerText) {
    chunks.push({ text: headerText, metadata: { docClass: DocClass.internal_sop, sectionPath: 'Header', tokenCount: countTokens(headerText) } });
  }

  if (revHistoryIdx > -1) {
    const revEnd = bodyStartIdx > -1 ? bodyStartIdx : revHistoryIdx + 20;
    const revText = lines.slice(revHistoryIdx, revEnd).join('\n').trim();
    if (revText) {
      chunks.push({ text: revText, metadata: { docClass: DocClass.internal_sop, sectionPath: 'Revision History', tokenCount: countTokens(revText) } });
    }
  }

  const bodyStart = bodyStartIdx > -1 ? bodyStartIdx : (revHistoryIdx > -1 ? revHistoryIdx + 10 : 0);
  const bodyText = lines.slice(bodyStart).join('\n').trim();
  if (bodyText) {
    for (const sub of splitByTokens(bodyText, MAX_CHUNK_TOKENS, OVERLAP_TOKENS)) {
      chunks.push({ text: sub, metadata: { docClass: DocClass.internal_sop, sectionPath: 'Body', tokenCount: countTokens(sub) } });
    }
  }

  if (chunks.length === 0) {
    for (const sub of splitByTokens(text, MAX_CHUNK_TOKENS, OVERLAP_TOKENS)) {
      chunks.push({ text: sub, metadata: { docClass: DocClass.internal_sop, sectionPath: 'Generic', tokenCount: countTokens(sub) } });
    }
  }
  return chunks;
};
