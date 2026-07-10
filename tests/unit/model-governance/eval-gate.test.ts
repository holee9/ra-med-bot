// @MX:NOTE [AUTO] Unit tests for eval-gate (SPEC-REGULA-MODEL-GOVERNANCE-001, REQ-MODELGOV-005/010/011).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (REQ-MODELGOV-005/010/011, AC-02/04)
// @MX:REASON REQ-MODELGOV-010/011 gate: checkEvalThreshold parses promptfoo result
//   JSON and enforces pass-rate threshold. evalGatePassed is the boolean shortcut.
//   Pure module — no db mock needed.

import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('DEFAULT_EVAL_THRESHOLD (REQ-MODELGOV-010)', () => {
  it('is 0.8 — mirrors promptfoo ">= 80%" config', async () => {
    const { DEFAULT_EVAL_THRESHOLD } = await import('@/lib/model-governance/eval-gate');
    expect(DEFAULT_EVAL_THRESHOLD).toBe(0.8);
  });
});

describe('checkEvalThreshold (REQ-MODELGOV-010/011)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('passes when all cases succeed (score = 1.0)', async () => {
    const { checkEvalThreshold } = await import('@/lib/model-governance/eval-gate');
    const result = checkEvalThreshold({
      results: [{ success: true }, { success: true }, { success: true }],
    });
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
    expect(result.reason).toBe('ok');
    expect(result.threshold).toBe(0.8);
  });

  it('passes when score exactly equals threshold (boundary)', async () => {
    const { checkEvalThreshold } = await import('@/lib/model-governance/eval-gate');
    // 4 of 5 = 0.8; threshold 0.8 → pass (>=).
    const result = checkEvalThreshold({
      results: [
        { success: true },
        { success: true },
        { success: true },
        { success: true },
        { success: false },
      ],
    });
    expect(result.score).toBe(0.8);
    expect(result.passed).toBe(true);
    expect(result.reason).toBe('ok');
  });

  it('fails when score is just below threshold (boundary)', async () => {
    const { checkEvalThreshold } = await import('@/lib/model-governance/eval-gate');
    // 3 of 4 = 0.75; threshold 0.8 → fail.
    const result = checkEvalThreshold({
      results: [{ success: true }, { success: true }, { success: true }, { success: false }],
    });
    expect(result.score).toBe(0.75);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('0.75');
    expect(result.reason).toContain('0.8');
  });

  it('fails when all cases fail (score = 0)', async () => {
    const { checkEvalThreshold } = await import('@/lib/model-governance/eval-gate');
    const result = checkEvalThreshold({
      results: [{ success: false }, { success: false }, { success: false }],
    });
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reason).not.toBe('ok');
  });

  it('fails closed with reason "no_eval_cases" when results array is empty', async () => {
    const { checkEvalThreshold } = await import('@/lib/model-governance/eval-gate');
    const result = checkEvalThreshold({ results: [] });
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reason).toBe('no_eval_cases');
    expect(result.threshold).toBe(0.8);
  });

  it('fails closed when resultJson is null', async () => {
    const { checkEvalThreshold } = await import('@/lib/model-governance/eval-gate');
    const result = checkEvalThreshold(null);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('no_eval_cases');
  });

  it('fails closed when resultJson is undefined', async () => {
    const { checkEvalThreshold } = await import('@/lib/model-governance/eval-gate');
    const result = checkEvalThreshold(undefined);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('no_eval_cases');
  });

  it('fails closed when resultJson has no results property', async () => {
    const { checkEvalThreshold } = await import('@/lib/model-governance/eval-gate');
    const result = checkEvalThreshold({ foo: 'bar' });
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('no_eval_cases');
  });

  it('counts only success === true; success === undefined does not count', async () => {
    const { checkEvalThreshold } = await import('@/lib/model-governance/eval-gate');
    // 2 of 4 explicitly true, 2 undefined → score 0.5, fail at 0.8.
    const result = checkEvalThreshold({
      results: [{ success: true }, { success: true }, { success: undefined }, {}],
    });
    expect(result.score).toBe(0.5);
    expect(result.passed).toBe(false);
  });

  it('respects custom threshold — pass when score >= custom low threshold', async () => {
    const { checkEvalThreshold } = await import('@/lib/model-governance/eval-gate');
    const result = checkEvalThreshold(
      { results: [{ success: true }, { success: false }] },
      { threshold: 0.4 },
    );
    expect(result.score).toBe(0.5);
    expect(result.passed).toBe(true);
    expect(result.threshold).toBe(0.4);
  });

  it('respects custom threshold — fail when score < custom high threshold', async () => {
    const { checkEvalThreshold } = await import('@/lib/model-governance/eval-gate');
    const result = checkEvalThreshold(
      { results: [{ success: true }, { success: false }] },
      { threshold: 0.9 },
    );
    expect(result.score).toBe(0.5);
    expect(result.passed).toBe(false);
    expect(result.threshold).toBe(0.9);
  });

  it('passes evalRunId through to result', async () => {
    const { checkEvalThreshold } = await import('@/lib/model-governance/eval-gate');
    const result = checkEvalThreshold(
      { results: [{ success: true }] },
      { evalRunId: 'run-abc-123' },
    );
    expect(result.evalRunId).toBe('run-abc-123');
  });

  it('defaults evalRunId to null when not provided', async () => {
    const { checkEvalThreshold } = await import('@/lib/model-governance/eval-gate');
    const result = checkEvalThreshold({ results: [{ success: true }] });
    expect(result.evalRunId).toBeNull();
  });

  it('passes evalResultRef through to result', async () => {
    const { checkEvalThreshold } = await import('@/lib/model-governance/eval-gate');
    const result = checkEvalThreshold(
      { results: [{ success: true }] },
      { evalResultRef: 's3://bucket/result.json' },
    );
    expect(result.evalResultRef).toBe('s3://bucket/result.json');
  });

  it('defaults evalResultRef to null when not provided', async () => {
    const { checkEvalThreshold } = await import('@/lib/model-governance/eval-gate');
    const result = checkEvalThreshold({ results: [{ success: true }] });
    expect(result.evalResultRef).toBeNull();
  });

  it('passes both evalRunId and evalResultRef together', async () => {
    const { checkEvalThreshold } = await import('@/lib/model-governance/eval-gate');
    const result = checkEvalThreshold(
      { results: [{ success: true }, { success: true }] },
      { evalRunId: 'run-1', evalResultRef: 'ref-1', threshold: 0.5 },
    );
    expect(result.evalRunId).toBe('run-1');
    expect(result.evalResultRef).toBe('ref-1');
    expect(result.threshold).toBe(0.5);
    expect(result.passed).toBe(true);
  });

  it('reports threshold 0.8 and score 0 in no_eval_cases path', async () => {
    const { checkEvalThreshold } = await import('@/lib/model-governance/eval-gate');
    const result = checkEvalThreshold({ results: [] });
    expect(result.threshold).toBe(0.8);
    expect(result.score).toBe(0);
  });

  it('formats reason with 2-decimal score on fail', async () => {
    const { checkEvalThreshold } = await import('@/lib/model-governance/eval-gate');
    // 1 of 3 = 0.333... → toFixed(2) = '0.33'
    const result = checkEvalThreshold({
      results: [{ success: true }, { success: false }, { success: false }],
    });
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('0.33');
    expect(result.reason).toContain('<');
  });
});

describe('evalGatePassed (REQ-MODELGOV-005)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns true when eval passes', async () => {
    const { evalGatePassed } = await import('@/lib/model-governance/eval-gate');
    const passed = evalGatePassed({
      results: [{ success: true }, { success: true }, { success: true }, { success: true }],
    });
    expect(passed).toBe(true);
  });

  it('returns false when eval fails', async () => {
    const { evalGatePassed } = await import('@/lib/model-governance/eval-gate');
    const passed = evalGatePassed({
      results: [{ success: false }, { success: false }, { success: false }, { success: false }],
    });
    expect(passed).toBe(false);
  });

  it('returns false when no eval cases', async () => {
    const { evalGatePassed } = await import('@/lib/model-governance/eval-gate');
    const passed = evalGatePassed({ results: [] });
    expect(passed).toBe(false);
  });

  it('returns false when resultJson is null', async () => {
    const { evalGatePassed } = await import('@/lib/model-governance/eval-gate');
    const passed = evalGatePassed(null);
    expect(passed).toBe(false);
  });

  it('accepts custom threshold', async () => {
    const { evalGatePassed } = await import('@/lib/model-governance/eval-gate');
    // 1 of 2 = 0.5; threshold 0.4 → pass.
    const passed = evalGatePassed({ results: [{ success: true }, { success: false }] }, 0.4);
    expect(passed).toBe(true);
  });

  it('uses default threshold when threshold is undefined', async () => {
    const { evalGatePassed } = await import('@/lib/model-governance/eval-gate');
    // 3 of 4 = 0.75; default threshold 0.8 → fail.
    const passed = evalGatePassed({
      results: [{ success: true }, { success: true }, { success: true }, { success: false }],
    });
    expect(passed).toBe(false);
  });
});
