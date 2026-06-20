// @MX:NOTE [AUTO] Unit tests for residual-risk.ts — SPEC-REGULA-RISK-001 Phase 1 (T1.5).

import { describe, expect, it } from 'vitest';
import { evaluateResidualRisk } from '../residual-risk';

describe('evaluateResidualRisk', () => {
  it('acc residual → no further action, valid', () => {
    const result = evaluateResidualRisk(1, 1);
    expect(result.level).toBe('acc');
    expect(result.requiresFurtherAction).toBe(false);
    expect(result.isValid).toBe(true);
  });

  it('unacc residual → requiresFurtherAction true', () => {
    const result = evaluateResidualRisk(5, 5);
    expect(result.level).toBe('unacc');
    expect(result.requiresFurtherAction).toBe(true);
    expect(result.isValid).toBe(true);
  });

  it('alarp with justification → valid', () => {
    const result = evaluateResidualRisk(
      2,
      3,
      'ALARP justified: cost-benefit analysis shows further reduction impractical',
    );
    expect(result.level).toBe('alarp');
    expect(result.requiresFurtherAction).toBe(false);
    expect(result.isValid).toBe(true);
  });

  it('alarp without justification → isValid false', () => {
    const result = evaluateResidualRisk(2, 3);
    expect(result.level).toBe('alarp');
    expect(result.isValid).toBe(false);
  });

  it('invalid severity → throws', () => {
    expect(() => evaluateResidualRisk(0, 1)).toThrow();
  });

  it('invalid probability → throws', () => {
    expect(() => evaluateResidualRisk(1, 6)).toThrow();
  });
});
