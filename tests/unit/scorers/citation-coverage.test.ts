/**
 * SPEC-REGULA-LAUNCH-001 — REQ-LAUNCH-004 (TASK-003)
 *
 * Unit tests for citation-coverage scorer.
 *
 * RED phase: fails until GREEN phase creates the scorer.
 */

import { describe, expect, it } from 'vitest';
import scoreFn from '../../../tests/eval/scorers/citation-coverage';

const baseContext = {
  vars: { query: 'test query', jurisdiction: 'FDA' },
  prompt: 'test prompt',
};

describe('citation-coverage scorer', () => {
  it('passes when output contains bracket citation [1]', async () => {
    const result = await scoreFn(
      'The 510(k) requirements are defined in [1] and further elaborated in [2].',
      baseContext,
    );
    expect(result.pass).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  it('passes when output contains named citation [FDA-001]', async () => {
    const result = await scoreFn(
      'According to [FDA-001], manufacturers must submit substantial equivalence data.',
      baseContext,
    );
    expect(result.pass).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  it('fails when output has no citations', async () => {
    const result = await scoreFn(
      'The device must meet safety requirements without any citation.',
      baseContext,
    );
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
  });

  it('returns higher score for more citations', async () => {
    const fewCitations = await scoreFn('See [1] for details.', baseContext);
    const manyCitations = await scoreFn(
      'See [1], [2], [3], [FDA-001], [MDR-2017] for details.',
      baseContext,
    );
    expect(manyCitations.score).toBeGreaterThanOrEqual(fewCitations.score);
  });

  it('returns reason string', async () => {
    const result = await scoreFn('No citations here.', baseContext);
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('result has pass, score, and reason fields', async () => {
    const result = await scoreFn('Check [1].', baseContext);
    expect(result).toHaveProperty('pass');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('reason');
  });
});
