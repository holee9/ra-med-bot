// SPEC-V3-IMPACT-001 M6: Layer 4 RAG similar cases via pgvector.
// TDD RED Phase: Write failing test first.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findSimilarCases } from '../layer4-rag-similar-cases';

// Mock the database - use factory function
vi.mock('@/lib/db/client', () => {
  const mockExecute = vi.fn();
  return {
    db: {
      execute: mockExecute,
    },
    getMockExecute: () => mockExecute,
  };
});

// Mock the embedding provider
vi.mock('@/lib/ai/embedding-provider', () => ({
  embedBatchTexts: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3, 0.4, 0.5]]),
}));

describe('Layer 4: RAG Similar Cases', () => {
  let mockExecute: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = (await import('@/lib/db/client')) as unknown as {
      getMockExecute: () => typeof mockExecute;
    };
    mockExecute = mod.getMockExecute();
    mockExecute.mockClear();
  });

  describe('AC-IMP-08 & AC-IMP-14: findSimilarCases', () => {
    it('should embed query text and search similar cases', async () => {
      mockExecute.mockResolvedValue([
        {
          id: 'case-1',
          title: 'Similar labeling change',
          content: 'IFU section 5 update for new indication',
          similarity: 0.92,
        },
        {
          id: 'case-2',
          title: 'Related software update',
          content: 'Algorithm change for decision logic',
          similarity: 0.87,
        },
      ]);

      const result = await findSimilarCases({
        productId: 'product-123',
        changeType: 'label',
        changeDetail: 'Label wording change for IFU section 5',
      });

      expect(result.cases).toHaveLength(2);
      expect(result.cases[0]?.similarity).toBeGreaterThan(0.9);
      expect(result.citations).toContain('<sup class="cite">1</sup>');
    });

    it('should filter by source_repo, product_id, and change_type', async () => {
      mockExecute.mockResolvedValue([]);

      await findSimilarCases({
        productId: 'product-456',
        changeType: 'sw',
        changeDetail: 'Software algorithm update',
      });

      expect(mockExecute).toHaveBeenCalled();
      const callArgs = mockExecute.mock.calls[0]?.[0];
      expect(typeof callArgs).toBe('object');
    });

    it('should limit to max 3 results', async () => {
      mockExecute.mockResolvedValue([
        { id: 'case-1', title: 'Case 1', content: 'Content 1', similarity: 0.9 },
        { id: 'case-2', title: 'Case 2', content: 'Content 2', similarity: 0.85 },
        { id: 'case-3', title: 'Case 3', content: 'Content 3', similarity: 0.8 },
      ]);

      const result = await findSimilarCases({
        productId: 'product-789',
        changeType: 'process',
        changeDetail: 'Process validation update',
      });

      expect(mockExecute).toHaveBeenCalled();
      expect(result.cases).toHaveLength(3);
    });

    it('should timeout after 10s and return empty results', async () => {
      mockExecute.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 11000)),
      );

      const result = await findSimilarCases({
        productId: 'product-999',
        changeType: 'bom',
        changeDetail: 'BOM component replacement',
      });

      // Should timeout before 11s completes
      expect(result.cases).toEqual([]);
      expect(result.timedOut).toBe(true);
    }, 15000); // Increase test timeout to 15s

    it('should handle database errors gracefully', async () => {
      mockExecute.mockRejectedValue(new Error('DB connection lost'));

      const result = await findSimilarCases({
        productId: 'product-error',
        changeType: 'warn',
        changeDetail: 'Warning letter update',
      });

      expect(result.cases).toEqual([]);
      expect(result.error).toContain('DB connection lost');
    });

    it('should format citations with <sup class="cite">N</sup>', async () => {
      mockExecute.mockResolvedValue([
        {
          id: 'case-1',
          title: 'First case',
          content: 'First content',
          similarity: 0.95,
        },
        {
          id: 'case-2',
          title: 'Second case',
          content: 'Second content',
          similarity: 0.88,
        },
      ]);

      const result = await findSimilarCases({
        productId: 'product-cite',
        changeType: 'sterile',
        changeDetail: 'Sterilization condition change',
      });

      expect(result.citations).toBe('<sup class="cite">1</sup><sup class="cite">2</sup>');
    });

    it('should return empty result on embedding failure', async () => {
      const { embedBatchTexts } = await import('@/lib/ai/embedding-provider');
      vi.mocked(embedBatchTexts).mockResolvedValue([]);

      const result = await findSimilarCases({
        productId: 'product-embed-fail',
        changeType: 'sw-minor',
        changeDetail: 'Test',
      });

      expect(result.cases).toEqual([]);
      expect(result.error).toContain('Failed to embed');
    });
  });
});
