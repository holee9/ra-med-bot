// SPEC-REGULA-DHF-001 — completeness score algorithm unit tests.
import { describe, it, expect } from 'vitest';
import { computeCompleteness } from '@/lib/dhf/completeness';

const baseDhf = { intendedUse: 'Monitors cardiac rhythm for arrhythmia detection.' };

describe('computeCompleteness', () => {
  it('returns 0 for a brand-new empty DHF', () => {
    const result = computeCompleteness(
      { intendedUse: '' },
      [],
      [],
      [],
    );
    expect(result.score).toBe(0);
    expect(result.breakdown).toEqual({});
  });

  it('awards +10 for a non-empty intended use', () => {
    const result = computeCompleteness(baseDhf, [], [], []);
    expect(result.score).toBe(10);
    expect(result.breakdown['has_device_description']).toBe(10);
  });

  it('awards +15 for >= 3 design inputs', () => {
    const inputs = [
      { inputType: 'user_need' },
      { inputType: 'regulatory' },
      { inputType: 'standards' },
    ];
    const result = computeCompleteness(baseDhf, inputs, [], []);
    expect(result.breakdown['has_3_or_more_inputs']).toBe(15);
  });

  it('does not award the +15 for only 2 inputs', () => {
    const inputs = [{ inputType: 'user_need' }, { inputType: 'regulatory' }];
    const result = computeCompleteness(baseDhf, inputs, [], []);
    expect(result.breakdown['has_3_or_more_inputs']).toBeUndefined();
  });

  it('awards +10 for user_need type inputs', () => {
    const result = computeCompleteness(baseDhf, [{ inputType: 'user_need' }], [], []);
    expect(result.breakdown['has_user_need_inputs']).toBe(10);
  });

  it('awards +10 for regulatory type inputs', () => {
    const result = computeCompleteness(baseDhf, [{ inputType: 'regulatory' }], [], []);
    expect(result.breakdown['has_regulatory_inputs']).toBe(10);
  });

  it('awards +15 for at least one verification', () => {
    const result = computeCompleteness(baseDhf, [], [{ result: null }], []);
    expect(result.breakdown['has_verification']).toBe(15);
  });

  it('awards +10 when all verifications have a result', () => {
    const verifications = [{ result: 'pass' }, { result: 'fail' }];
    const result = computeCompleteness(baseDhf, [], verifications, []);
    expect(result.breakdown['all_verifications_have_result']).toBe(10);
  });

  it('does not award +10 if any verification has null result', () => {
    const verifications = [{ result: 'pass' }, { result: null }];
    const result = computeCompleteness(baseDhf, [], verifications, []);
    expect(result.breakdown['all_verifications_have_result']).toBeUndefined();
  });

  it('awards +15 for an approved design review', () => {
    const reviews = [{ reviewStage: 'preliminary', approvedBy: 'Dr. Smith' }];
    const result = computeCompleteness(baseDhf, [], [], reviews);
    expect(result.breakdown['has_approved_review']).toBe(15);
  });

  it('does not award approved review credit for unapproved review', () => {
    const reviews = [{ reviewStage: 'preliminary', approvedBy: null }];
    const result = computeCompleteness(baseDhf, [], [], reviews);
    expect(result.breakdown['has_approved_review']).toBeUndefined();
  });

  it('awards +5 for preliminary, +5 critical, +5 final review stages', () => {
    const reviews = [
      { reviewStage: 'preliminary', approvedBy: null },
      { reviewStage: 'critical', approvedBy: null },
      { reviewStage: 'final', approvedBy: null },
    ];
    const result = computeCompleteness(baseDhf, [], [], reviews);
    expect(result.breakdown['has_preliminary_review']).toBe(5);
    expect(result.breakdown['has_critical_review']).toBe(5);
    expect(result.breakdown['has_final_review']).toBe(5);
  });

  it('computes 100% for a fully complete DHF', () => {
    const inputs = [
      { inputType: 'user_need' },
      { inputType: 'regulatory' },
      { inputType: 'standards' },
    ];
    const verifications = [{ result: 'pass' }, { result: 'pass' }];
    const reviews = [
      { reviewStage: 'preliminary', approvedBy: 'Alice' },
      { reviewStage: 'critical', approvedBy: null },
      { reviewStage: 'final', approvedBy: null },
    ];
    const result = computeCompleteness(baseDhf, inputs, verifications, reviews);
    expect(result.score).toBe(100);
  });

  it('score never exceeds 100', () => {
    const manyInputs = Array.from({ length: 10 }, () => ({ inputType: 'user_need' }));
    const manyVerifications = Array.from({ length: 5 }, () => ({ result: 'pass' }));
    const manyReviews = [
      { reviewStage: 'preliminary', approvedBy: 'Alice' },
      { reviewStage: 'critical', approvedBy: null },
      { reviewStage: 'final', approvedBy: null },
    ];
    const result = computeCompleteness(baseDhf, manyInputs, manyVerifications, manyReviews);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
