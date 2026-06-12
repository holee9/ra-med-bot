// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-016)

import { describe, expect, it } from 'vitest';
import type { PccpComponentType } from '../types';
import { assertPccpComplete, validatePccpCompleteness } from '../validator';
import type { ComponentCompletionRecord } from '../validator';

const ALL_TYPES: PccpComponentType[] = [
  'modification_description',
  'sps',
  'acp',
  'impact_assessment',
  'performance_testing',
];

const completed = (type: PccpComponentType): ComponentCompletionRecord => ({
  componentType: type,
  completedAt: new Date('2026-01-01'),
});

const pending = (type: PccpComponentType): ComponentCompletionRecord => ({
  componentType: type,
  completedAt: null,
});

describe('validatePccpCompleteness', () => {
  it('returns isComplete=true when all 5 components are completed', () => {
    const result = validatePccpCompleteness(ALL_TYPES.map(completed));
    expect(result.isComplete).toBe(true);
    expect(result.missingComponents).toHaveLength(0);
    expect(result.completionPercentage).toBe(100);
  });

  it('returns isComplete=false when any component is missing', () => {
    const records = [
      completed('modification_description'),
      completed('sps'),
      pending('acp'),
      pending('impact_assessment'),
      pending('performance_testing'),
    ];
    const result = validatePccpCompleteness(records);
    expect(result.isComplete).toBe(false);
    expect(result.missingComponents).toContain('acp');
    expect(result.completionPercentage).toBe(40);
  });

  it('returns 0% when no components exist', () => {
    const result = validatePccpCompleteness([]);
    expect(result.isComplete).toBe(false);
    expect(result.completionPercentage).toBe(0);
    expect(result.missingComponents).toHaveLength(5);
  });

  it('ignores null completedAt as not completed', () => {
    const result = validatePccpCompleteness(ALL_TYPES.map(pending));
    expect(result.isComplete).toBe(false);
  });
});

describe('assertPccpComplete', () => {
  it('does not throw when all components are completed', () => {
    expect(() => assertPccpComplete(ALL_TYPES.map(completed))).not.toThrow();
  });

  it('throws with missing component names in the error message', () => {
    const records = [
      completed('modification_description'),
      pending('sps'),
      pending('acp'),
      pending('impact_assessment'),
      pending('performance_testing'),
    ];
    expect(() => assertPccpComplete(records)).toThrow(/sps/);
  });
});
