/**
 * prompt-locale.test.ts — REQ-ENTERPRISE-042
 *
 * Verifies that composePrompt returns locale-appropriate language instructions
 * in the system prompt.
 */

import { composePrompt } from '@/lib/ai/prompt-templates';
import type { RetrievedChunk } from '@/lib/ai/retrievers/hybrid-search';
import { describe, expect, it } from 'vitest';

const DUMMY_CHUNKS: RetrievedChunk[] = [];
const DUMMY_QUESTION = 'test question';
const DUMMY_INTENT = 'general' as const;

describe('composePrompt locale behavior (REQ-ENTERPRISE-042)', () => {
  it('should include Korean language instruction when locale is ko', () => {
    const result = composePrompt(DUMMY_QUESTION, DUMMY_INTENT, DUMMY_CHUNKS, 'ko');
    expect(result.systemPrompt).toContain('한국어');
  });

  it('should include English language instruction when locale is en', () => {
    const result = composePrompt(DUMMY_QUESTION, DUMMY_INTENT, DUMMY_CHUNKS, 'en');
    expect(result.systemPrompt).toContain('English');
  });

  it('should include Respond in Korean when locale is ko', () => {
    const result = composePrompt(DUMMY_QUESTION, DUMMY_INTENT, DUMMY_CHUNKS, 'ko');
    expect(result.systemPrompt).toMatch(/Respond in Korean|한국어로 응답/);
  });

  it('should include Respond in English when locale is en', () => {
    const result = composePrompt(DUMMY_QUESTION, DUMMY_INTENT, DUMMY_CHUNKS, 'en');
    expect(result.systemPrompt).toContain('Respond in English');
  });
});
