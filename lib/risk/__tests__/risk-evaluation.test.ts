// @MX:NOTE [AUTO] Unit tests for risk-evaluation.ts — SPEC-REGULA-RISK-001 Phase 1 (T1.2~T1.4).
// Tests exhaust all 25 cells of the 5×5 ISO 14971 Annex E risk matrix.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RISK_MATRIX,
  evaluateRiskLevel,
  requiresControl,
  validateScale,
} from '../risk-evaluation';

// ---------------------------------------------------------------------------
// T1.2 / T1.3 — DEFAULT_RISK_MATRIX structure
// ---------------------------------------------------------------------------
describe('DEFAULT_RISK_MATRIX', () => {
  it('has 5 severity rows', () => {
    expect(DEFAULT_RISK_MATRIX).toHaveLength(5);
  });

  it('each row has 5 probability columns', () => {
    for (const row of DEFAULT_RISK_MATRIX) {
      expect(row).toHaveLength(5);
    }
  });

  it('all values are acc | alarp | unacc', () => {
    const valid = new Set(['acc', 'alarp', 'unacc']);
    for (const row of DEFAULT_RISK_MATRIX) {
      for (const cell of row) {
        expect(valid.has(cell)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// T1.2 — evaluateRiskLevel: exhaustive 25-cell matrix test
// ISO 14971 Annex E matrix (severity=row index+1, probability=col index+1)
// Expected layout (S5..S1, P1..P5):
//   S5: alarp unacc unacc unacc unacc
//   S4: acc   alarp unacc unacc unacc
//   S3: acc   alarp alarp unacc unacc
//   S2: acc   acc   alarp alarp unacc
//   S1: acc   acc   acc   alarp alarp
// ---------------------------------------------------------------------------
describe('evaluateRiskLevel — 25-cell exhaustive', () => {
  type Level = 'acc' | 'alarp' | 'unacc';
  const expected: Level[][] = [
    // S1 (index 0), P1..P5
    ['acc', 'acc', 'acc', 'alarp', 'alarp'],
    // S2
    ['acc', 'acc', 'alarp', 'alarp', 'unacc'],
    // S3
    ['acc', 'alarp', 'alarp', 'unacc', 'unacc'],
    // S4
    ['acc', 'alarp', 'unacc', 'unacc', 'unacc'],
    // S5
    ['alarp', 'unacc', 'unacc', 'unacc', 'unacc'],
  ];

  for (let s = 1; s <= 5; s++) {
    for (let p = 1; p <= 5; p++) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const cell = expected[s - 1]![p - 1]!;
      it(`S${s}×P${p} → ${cell}`, () => {
        expect(evaluateRiskLevel(s, p)).toBe(cell);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// T1.2 — custom matrix override
// ---------------------------------------------------------------------------
describe('evaluateRiskLevel — custom matrix', () => {
  const customMatrix: Array<Array<'acc' | 'alarp' | 'unacc'>> = [
    ['unacc', 'unacc', 'unacc', 'unacc', 'unacc'],
    ['unacc', 'unacc', 'unacc', 'unacc', 'unacc'],
    ['unacc', 'unacc', 'unacc', 'unacc', 'unacc'],
    ['unacc', 'unacc', 'unacc', 'unacc', 'unacc'],
    ['unacc', 'unacc', 'unacc', 'unacc', 'unacc'],
  ];

  it('uses custom matrix when provided', () => {
    expect(evaluateRiskLevel(1, 1, customMatrix)).toBe('unacc');
  });
});

// ---------------------------------------------------------------------------
// T1.3 — validateScale
// ---------------------------------------------------------------------------
describe('validateScale', () => {
  it('returns true for 1', () => expect(validateScale(1)).toBe(true));
  it('returns true for 5', () => expect(validateScale(5)).toBe(true));
  it('returns true for 3', () => expect(validateScale(3)).toBe(true));
  it('returns false for 0', () => expect(validateScale(0)).toBe(false));
  it('returns false for 6', () => expect(validateScale(6)).toBe(false));
  it('returns false for -1', () => expect(validateScale(-1)).toBe(false));
  it('returns false for 1.5 (non-integer)', () => expect(validateScale(1.5)).toBe(false));
});

// ---------------------------------------------------------------------------
// T1.4 — requiresControl
// ---------------------------------------------------------------------------
describe('requiresControl', () => {
  it('acc → false (acceptable risk, no control required)', () => {
    expect(requiresControl('acc')).toBe(false);
  });

  it('alarp → true (control measures must be considered)', () => {
    expect(requiresControl('alarp')).toBe(true);
  });

  it('unacc → true (unacceptable, control mandatory)', () => {
    expect(requiresControl('unacc')).toBe(true);
  });
});
