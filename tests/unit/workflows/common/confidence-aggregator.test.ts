import {
  type ConfidenceScore,
  InvalidScoreError,
  InvalidWeightError,
  aggregateScores,
  classifyConfidence,
  requiresHumanReview,
} from '@/lib/workflows/common/confidence-aggregator';
import { describe, expect, it } from 'vitest';

describe('confidence-aggregator', () => {
  describe('aggregateScores', () => {
    it('returns weighted average of scores', () => {
      const scores: ConfidenceScore[] = [
        { source: 'llm-a', score: 0.9, weight: 2 },
        { source: 'llm-b', score: 0.6, weight: 1 },
      ];
      // (0.9*2 + 0.6*1) / (2+1) = (1.8+0.6)/3 = 2.4/3 = 0.8
      const result = aggregateScores(scores);
      expect(result).toBeCloseTo(0.8, 5);
    });

    it('returns 0 for empty array', () => {
      expect(aggregateScores([])).toBe(0);
    });

    it('handles single score correctly', () => {
      const scores: ConfidenceScore[] = [{ source: 'llm-a', score: 0.75, weight: 1 }];
      expect(aggregateScores(scores)).toBeCloseTo(0.75, 5);
    });
  });

  describe('classifyConfidence', () => {
    it('classifies score >= 0.8 as high', () => {
      expect(classifyConfidence(0.8)).toBe('high');
      expect(classifyConfidence(1.0)).toBe('high');
      expect(classifyConfidence(0.95)).toBe('high');
    });

    it('classifies score >= 0.5 and < 0.8 as medium', () => {
      expect(classifyConfidence(0.5)).toBe('medium');
      expect(classifyConfidence(0.79)).toBe('medium');
    });

    it('classifies score < 0.5 as low', () => {
      expect(classifyConfidence(0.0)).toBe('low');
      expect(classifyConfidence(0.49)).toBe('low');
    });
  });

  describe('requiresHumanReview', () => {
    it('returns true when aggregated score < default threshold 0.7', () => {
      const scores: ConfidenceScore[] = [{ source: 'llm-a', score: 0.5, weight: 1 }];
      expect(requiresHumanReview(scores)).toBe(true);
    });

    it('returns false when aggregated score >= default threshold 0.7', () => {
      const scores: ConfidenceScore[] = [{ source: 'llm-a', score: 0.8, weight: 1 }];
      expect(requiresHumanReview(scores)).toBe(false);
    });

    it('uses custom threshold when provided', () => {
      const scores: ConfidenceScore[] = [{ source: 'llm-a', score: 0.75, weight: 1 }];
      // 0.75 < 0.9 threshold → requires review
      expect(requiresHumanReview(scores, 0.9)).toBe(true);
      // 0.75 >= 0.5 threshold → no review needed
      expect(requiresHumanReview(scores, 0.5)).toBe(false);
    });
  });

  describe('error cases', () => {
    it('throws InvalidScoreError for score > 1', () => {
      const scores: ConfidenceScore[] = [{ source: 'bad', score: 1.1, weight: 1 }];
      expect(() => aggregateScores(scores)).toThrow(InvalidScoreError);
    });

    it('throws InvalidScoreError for score < 0', () => {
      const scores: ConfidenceScore[] = [{ source: 'bad', score: -0.1, weight: 1 }];
      expect(() => aggregateScores(scores)).toThrow(InvalidScoreError);
    });

    it('throws InvalidWeightError for weight <= 0', () => {
      const scores: ConfidenceScore[] = [{ source: 'bad', score: 0.5, weight: 0 }];
      expect(() => aggregateScores(scores)).toThrow(InvalidWeightError);
    });

    it('throws InvalidWeightError for negative weight', () => {
      const scores: ConfidenceScore[] = [{ source: 'bad', score: 0.5, weight: -1 }];
      expect(() => aggregateScores(scores)).toThrow(InvalidWeightError);
    });
  });
});
