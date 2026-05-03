/**
 * SPEC-REGULA-LAUNCH-001 — REQ-LAUNCH-004 (TASK-003)
 *
 * Unit tests for hallucination scorer.
 *
 * RED phase: fails until GREEN phase creates the scorer.
 */

import { describe, expect, it } from 'vitest';
import scoreFn from '../../../tests/eval/scorers/hallucination';

const baseContext = {
  vars: { query: 'test query', jurisdiction: 'FDA' },
  prompt: 'test prompt',
};

describe('hallucination scorer', () => {
  it('passes for output without hallucination markers', async () => {
    const result = await scoreFn(
      'The 510(k) process requires substantial equivalence to a predicate device per 21 CFR Part 807.',
      baseContext,
    );
    expect(result.pass).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  it('fails when output contains obviously wrong regulation number pattern', async () => {
    // Made-up regulation numbers that follow no real pattern
    const result = await scoreFn(
      'According to CFR Part 9999, all devices must comply with regulation 12345-FAKE-2099.',
      baseContext,
    );
    expect(result.pass).toBe(false);
  });

  it('fails when output contains future years beyond reasonable range', async () => {
    const result = await scoreFn(
      'The EU MDR was enacted in 2045 and requires compliance by 2099.',
      baseContext,
    );
    expect(result.pass).toBe(false);
  });

  it('passes for output with real known regulation references', async () => {
    const result = await scoreFn(
      'Under 21 CFR Part 820 (Quality System Regulation), manufacturers must maintain design controls.',
      baseContext,
    );
    expect(result.pass).toBe(true);
  });

  it('returns reason string', async () => {
    const result = await scoreFn('Some output text.', baseContext);
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('result has pass, score, and reason fields', async () => {
    const result = await scoreFn('The device is a Class II device.', baseContext);
    expect(result).toHaveProperty('pass');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('reason');
  });

  it('score is between 0 and 1', async () => {
    const result = await scoreFn('Normal regulatory output [1].', baseContext);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});
