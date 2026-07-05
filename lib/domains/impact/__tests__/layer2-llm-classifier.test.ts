// SPEC-V3-IMPACT-001 M4: LLM-based change category classification.
// TDD RED Phase: Write failing test first.

import type { generateText } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyChangeCategory } from '../layer2-llm-classifier';

// Helper to create a minimal object shaped like GenerateTextResult for mocking.
// Cast through unknown so the mock satisfies vitest's typed mock without forcing
// every field of the real (large) SDK result type.
type GenerateTextReturnType = Awaited<ReturnType<typeof generateText>>;
function mockGenerateTextResult(text: string): GenerateTextReturnType {
  return {
    text,
    usage: { promptTokens: 10, completionTokens: 20 },
    finishReason: 'stop',
    toolCalls: [],
    toolResults: [],
    warnings: undefined,
  } as unknown as GenerateTextReturnType;
}

// Mock the AI SDK and LLM provider
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

vi.mock('@/lib/ai/llm-provider', () => ({
  getLlmModel: vi.fn(() => ({ model: 'gpt-oss:120b' })),
}));

describe('Layer 2: LLM Classifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AC-IMP-06: classifyChangeCategory', () => {
    it('should classify change detail with high confidence', async () => {
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockResolvedValue(
        mockGenerateTextResult(
          JSON.stringify({
            category: 'label',
            confidence: 0.92,
            reason: 'Change explicitly mentions IFU update requirements',
          }),
        ),
      );

      const result = await classifyChangeCategory('IFU section 5 requires new indication wording');

      expect(result).toEqual({
        category: 'label',
        confidence: 0.92,
        reason: 'Change explicitly mentions IFU update requirements',
      });
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.any(Object),
          prompt: expect.stringContaining('IFU section 5 requires new indication wording'),
        }),
      );
    });

    it('should retry up to 3 times on failure', async () => {
      const { generateText } = await import('ai');
      vi.mocked(generateText)
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Connection lost'))
        .mockResolvedValueOnce(
          mockGenerateTextResult(
            JSON.stringify({
              category: 'sw',
              confidence: 0.85,
              reason: 'Software algorithm modification',
            }),
          ),
        );

      const result = await classifyChangeCategory('Algorithm update for decision logic');

      expect(result.category).toBe('sw');
      expect(generateText).toHaveBeenCalledTimes(3);
    });

    it('should return error category after 3 failed retries', async () => {
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockRejectedValue(new Error('Persistent failure'));

      const result = await classifyChangeCategory('Some change detail');

      expect(result).toEqual({
        category: 'error',
        confidence: 0,
        reason: 'Failed after 3 retries: Persistent failure',
      });
    });

    it('should handle malformed JSON response', async () => {
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockResolvedValue(mockGenerateTextResult('Invalid JSON{{{'));

      const result = await classifyChangeCategory('Change detail');

      expect(result).toEqual({
        category: 'error',
        confidence: 0,
        reason: expect.stringContaining('Failed after 3 retries'),
      });
    });

    it('should use gpt-oss:120b model via getLlmModel', async () => {
      const { generateText } = await import('ai');
      const { getLlmModel } = await import('@/lib/ai/llm-provider');

      vi.mocked(generateText).mockResolvedValue(
        mockGenerateTextResult(
          JSON.stringify({
            category: 'bom',
            confidence: 0.88,
            reason: 'BOM component replacement',
          }),
        ),
      );

      await classifyChangeCategory('BOM component change');

      expect(getLlmModel).toHaveBeenCalledWith();
      expect(generateText).toHaveBeenCalledTimes(1);
    });

    it('should validate category against allowed values', async () => {
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockResolvedValue(
        mockGenerateTextResult(
          JSON.stringify({
            category: 'invalid_category',
            confidence: 0.9,
            reason: 'Some reason',
          }),
        ),
      );

      const result = await classifyChangeCategory('Change detail');

      expect(result).toEqual({
        category: 'error',
        confidence: 0,
        reason: expect.stringContaining('Invalid category'),
      });
    });

    it('should handle valid categories from retest-matrix-data.ts', async () => {
      const { generateText } = await import('ai');

      const validCategories = ['bom', 'sw', 'sw-minor', 'label', 'warn', 'process', 'sterile'];

      for (const category of validCategories) {
        vi.mocked(generateText).mockResolvedValueOnce(
          mockGenerateTextResult(
            JSON.stringify({
              category,
              confidence: 0.8,
              reason: `Valid ${category} change`,
            }),
          ),
        );

        const result = await classifyChangeCategory(`Test ${category} change`);
        expect(result.category).toBe(category);
      }
    });
  });
});
