// @MX:NOTE [AUTO] CER (Clinical Evaluation Report) chunker — MEDDEV 2.7/1 rev4 7 stages.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-049)
import { DocClass } from '../doc-class';
import type { Chunk, ChunkerFn } from './base';
import { MAX_CHUNK_TOKENS, OVERLAP_TOKENS, countTokens, splitByTokens } from './base';

const MEDDEV_STAGES = [
  'Scope',
  'Data Identification',
  'Data Appraisal',
  'Data Analysis',
  'Finalization',
  'PMCF Plan',
  'Update Plan',
] as const;

export const chunkCerMeddev: ChunkerFn = (text, _metadata): Chunk[] => {
  const chunks: Chunk[] = [];
  const pattern = new RegExp(`^(${MEDDEV_STAGES.join('|')})\\s*$`, 'im');
  const lines = text.split('\n');
  let currentSection = 'Preamble';
  let currentLines: string[] = [];

  const flush = (section: string, content: string) => {
    if (!content.trim()) return;
    for (const sub of splitByTokens(content, MAX_CHUNK_TOKENS, OVERLAP_TOKENS)) {
      chunks.push({ text: sub, metadata: { docClass: DocClass.clinical_report, sectionPath: section, tokenCount: countTokens(sub) } });
    }
  };

  for (const line of lines) {
    if (pattern.test(line.trim())) {
      flush(currentSection, currentLines.join('\n'));
      currentSection = line.trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  flush(currentSection, currentLines.join('\n'));

  if (chunks.length === 0) {
    for (const sub of splitByTokens(text, MAX_CHUNK_TOKENS, OVERLAP_TOKENS)) {
      chunks.push({ text: sub, metadata: { docClass: DocClass.clinical_report, sectionPath: 'Generic', tokenCount: countTokens(sub) } });
    }
  }
  return chunks;
};
