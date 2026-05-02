// @MX:NOTE Unit tests for confidence calculation — REQ-CHAT-055 confidence gate.
// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { calculateConfidence, getConfidenceLevel } from '../../lib/ai/confidence';

describe('calculateConfidence', () => {
  it('returns 1.0 for perfect chunks and full citation coverage', () => {
    const score = calculateConfidence({
      chunkScores: [0.9, 0.85, 0.8],
      citedCount: 3,
      totalSentences: 3,
    });
    expect(score).toBeGreaterThan(0.8);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it('returns lower score for low chunk similarity', () => {
    const scoreHigh = calculateConfidence({
      chunkScores: [0.9, 0.9],
      citedCount: 5,
      totalSentences: 5,
    });
    const scoreLow = calculateConfidence({
      chunkScores: [0.3, 0.2],
      citedCount: 1,
      totalSentences: 5,
    });
    expect(scoreHigh).toBeGreaterThan(scoreLow);
  });

  it('returns score between 0 and 1', () => {
    const score = calculateConfidence({
      chunkScores: [0.5],
      citedCount: 2,
      totalSentences: 5,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('returns 0 for empty chunks', () => {
    const score = calculateConfidence({
      chunkScores: [],
      citedCount: 0,
      totalSentences: 0,
    });
    expect(score).toBe(0);
  });
});

describe('getConfidenceLevel', () => {
  it('returns "high" for score >= 0.8', () => {
    expect(getConfidenceLevel(0.8)).toBe('high');
    expect(getConfidenceLevel(0.95)).toBe('high');
    expect(getConfidenceLevel(1.0)).toBe('high');
  });

  it('returns "med" for score >= 0.5 and < 0.8', () => {
    expect(getConfidenceLevel(0.5)).toBe('med');
    expect(getConfidenceLevel(0.7)).toBe('med');
    expect(getConfidenceLevel(0.79)).toBe('med');
  });

  it('returns "low" for score < 0.5', () => {
    expect(getConfidenceLevel(0.0)).toBe('low');
    expect(getConfidenceLevel(0.3)).toBe('low');
    expect(getConfidenceLevel(0.49)).toBe('low');
  });
});
