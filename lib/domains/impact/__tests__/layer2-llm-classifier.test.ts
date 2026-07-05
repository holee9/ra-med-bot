// SPEC-V3-IMPACT-001 M4: LLM-based change category classification.
// TDD RED Phase: Write failing test first.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyChangeCategory } from '../layer2-llm-classifier';

// Mock the LLM provider
vi.mock('@/lib/ai/llm-provider', () => ({
  getLlmModel: vi.fn(() => ({
    complete: vi.fn(),
  })),
}));

describe('Layer 2: LLM Classifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AC-IMP-06: classifyChangeCategory', () => {
    it('should classify change detail with high confidence', async () => {
      const mockLlm = {
        complete: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            category: 'labeling',
            confidence: 0.92,
            reason: 'Change explicitly mentions IFU update requirements',
          }),
        }),
      };

      const { getLlmModel } = await import('@/lib/ai/llm-provider');
      vi.mocked(getLlmModel).mockReturnValue(mockLlm as any);

      const result = await classifyChangeCategory('IFU section 5 requires new indication wording');

      expect(result).toEqual({
        category: 'labeling',
        confidence: 0.92,
        reason: 'Change explicitly mentions IFU update requirements',
      });
    });

    it('should retry up to 3 times on failure', async () => {
      const mockLlm = {
        complete: vi.fn()
          .mockRejectedValueOnce(new Error('Timeout'))
          .mockRejectedValueOnce(new Error('Connection lost'))
          .mockResolvedValueOnce({
            text: JSON.stringify({
              category: 'software',
              confidence: 0.85,
              reason: 'Software algorithm modification',
            }),
          }),
      };

      const { getLlmModel } = await import('@/lib/ai/llm-provider');
      vi.mocked(getLlmModel).mockReturnValue(mockLlm as any);

      const result = await classifyChangeCategory('Algorithm update for decision logic');

      expect(result.category).toBe('software');
      expect(mockLlm.complete).toHaveBeenCalledTimes(3);
    });

    it('should return error category after 3 failed retries', async () => {
      const mockLlm = {
        complete: vi.fn().mockRejectedValue(new Error('Persistent failure')),
      };

      const { getLlmModel } = await import('@/lib/ai/llm-provider');
      vi.mocked(getLlmModel).mockReturnValue(mockLlm as any);

      const result = await classifyChangeCategory('Some change detail');

      expect(result).toEqual({
        category: 'error',
        confidence: 0,
        reason: expect.stringContaining('Failed after 3 retries'),
      });
    });

    it('should handle malformed JSON response', async () => {
      const mockLlm = {
        complete: vi.fn().mockResolvedValue({
          text: 'Invalid JSON{{{',
        }),
      };

      const { getLlmModel } = await import('@/lib/ai/llm-provider');
      vi.mocked(getLlmModel).mockReturnValue(mockLlm as any);

      const result = await classifyChangeCategory('Change detail');

      expect(result).toEqual({
        category: 'error',
        confidence: 0,
        reason: expect.stringContaining('Failed after 3 retries'),
      });
    });

    it('should use gpt-oss:120b model via getLlmModel', async () => {
      const mockLlm = {
        complete: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            category: 'clinical',
            confidence: 0.88,
            reason: 'Clinical evidence requirement change',
          }),
        }),
      };

      const { getLlmModel } = await import('@/lib/ai/llm-provider');
      vi.mocked(getLlmModel).mockReturnValue(mockLlm as any);

      await classifyChangeCategory('New clinical data required');

      expect(getLlmModel).toHaveBeenCalledWith('gpt-oss:120b');
      expect(mockLlm.complete).toHaveBeenCalledTimes(1);
    });

    it('should validate category against allowed values', async () => {
      const mockLlm = {
        complete: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            category: 'invalid_category',
            confidence: 0.9,
            reason: 'Some reason',
          }),
        }),
      };

      const { getLlmModel } = await import('@/lib/ai/llm-provider');
      vi.mocked(getLlmModel).mockReturnValue(mockLlm as any);

      const result = await classifyChangeCategory('Change detail');

      expect(result).toEqual({
        category: 'error',
        confidence: 0,
        reason: expect.stringContaining('Invalid category'),
      });
    });
  });
});
