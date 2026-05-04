import { describe, expect, it } from 'vitest';
import { getStepState } from '../../../../components/workflows/WorkflowStepProgress';

describe('getStepState', () => {
  const steps = ['draft', 'review', 'approve', 'submit'];

  it('completed steps are correctly identified', () => {
    const completedSteps = ['draft', 'review'];
    expect(getStepState('draft', 'approve', completedSteps)).toBe('completed');
    expect(getStepState('review', 'approve', completedSteps)).toBe('completed');
  });

  it('current step is correctly identified', () => {
    const completedSteps = ['draft', 'review'];
    expect(getStepState('approve', 'approve', completedSteps)).toBe('current');
  });

  it('pending steps are correctly identified', () => {
    const completedSteps = ['draft'];
    expect(getStepState('submit', 'review', completedSteps)).toBe('pending');
  });

  it('handles null currentStep — all non-completed steps are pending', () => {
    const completedSteps: string[] = [];
    for (const step of steps) {
      expect(getStepState(step, null, completedSteps)).toBe('pending');
    }
  });

  it('completed step is not affected by being the current step', () => {
    // If a step is in completedSteps, it should be 'completed' even if it matches currentStep
    const completedSteps = ['draft', 'review'];
    expect(getStepState('draft', 'draft', completedSteps)).toBe('completed');
  });

  it('handles empty completedSteps with a current step', () => {
    const completedSteps: string[] = [];
    expect(getStepState('draft', 'draft', completedSteps)).toBe('current');
    expect(getStepState('review', 'draft', completedSteps)).toBe('pending');
  });
});
