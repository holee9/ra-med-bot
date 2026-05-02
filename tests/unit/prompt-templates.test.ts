// @MX:NOTE Unit tests for prompt template composition — REQ-CHAT-017, 021, 022.
// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { composePrompt } from '../../lib/ai/prompt-templates';
import type { RetrievedChunk } from '../../lib/ai/retrievers/hybrid-search';

const makeChunk = (n: number): RetrievedChunk => ({
  sectionId: `sec-${n}`,
  sourceId: `src-${n}`,
  anchor: `anchor-${n}`,
  text: `Content of section ${n}`,
  offset: n * 100,
  vec_score: 0.8,
  fts_score: 0.7,
  combined_score: 0.76,
  orgLabel: 'FDA',
  title: `21 CFR Part ${n}`,
  year: 2024,
  type: 'Regulation',
  url: null,
});

describe('composePrompt', () => {
  it('includes citation directive in system prompt for ko locale', () => {
    const result = composePrompt('질문', 'regulation-lookup', [makeChunk(1)], 'ko');
    expect(result.systemPrompt).toMatch(/cite|인용|출처/i);
  });

  it('includes citation directive in system prompt for en locale', () => {
    const result = composePrompt('question', 'regulation-lookup', [makeChunk(1)], 'en');
    expect(result.systemPrompt).toMatch(/cite|citation|source/i);
  });

  it('wraps each chunk with [Source N: ...] prefix', () => {
    const chunks = [makeChunk(1), makeChunk(2)];
    const result = composePrompt('질문', 'regulation-lookup', chunks, 'ko');
    expect(result.chunkContext).toContain('[Source 1:');
    expect(result.chunkContext).toContain('[Source 2:');
  });

  it('includes section_id and offset in chunk header', () => {
    const chunks = [makeChunk(1)];
    const result = composePrompt('질문', 'regulation-lookup', chunks, 'ko');
    expect(result.chunkContext).toContain('section_id=');
    expect(result.chunkContext).toContain('offset=');
  });

  it('includes role framing text', () => {
    const result = composePrompt('질문', 'regulation-lookup', [], 'ko');
    expect(result.systemPrompt).toMatch(/Regulatory|RA|규제/i);
  });

  it('adds Korean locale instruction', () => {
    const result = composePrompt('질문', 'regulation-lookup', [], 'ko');
    expect(result.systemPrompt).toMatch(/Korean|한국어/i);
  });

  it('adds English locale instruction', () => {
    const result = composePrompt('question', 'regulation-lookup', [], 'en');
    expect(result.systemPrompt).toMatch(/English/i);
  });

  it('limits to 8 chunks even if more provided (chunkContext has <= 8 [Source N:] entries)', () => {
    const chunks = Array.from({ length: 10 }, (_, i) => makeChunk(i + 1));
    const result = composePrompt('질문', 'regulation-lookup', chunks, 'ko');
    // Count occurrences of [Source N: patterns
    const matches = result.chunkContext.match(/\[Source \d+:/g) ?? [];
    expect(matches.length).toBeLessThanOrEqual(8);
  });

  it('returns the user question in userQuestion field', () => {
    const result = composePrompt('What is 510(k)?', 'regulation-lookup', [], 'en');
    expect(result.userQuestion).toBe('What is 510(k)?');
  });
});
