import {
  SUBMISSION_DRAFTER_STEPS,
  getNextStep,
  getStepIndex,
  isValidStep,
} from '@/lib/workflows/submission-drafter/steps';
import { describe, expect, it } from 'vitest';

describe('submission-drafter/steps', () => {
  describe('SUBMISSION_DRAFTER_STEPS', () => {
    it('has exactly 6 steps', () => {
      expect(SUBMISSION_DRAFTER_STEPS).toHaveLength(6);
    });

    it('contains all expected steps in order', () => {
      expect(SUBMISSION_DRAFTER_STEPS).toEqual([
        'device_classification',
        'predicate_search',
        'substantial_equivalence',
        'performance_summary',
        'labeling_review',
        'submission_assembly',
      ]);
    });
  });

  describe('getStepIndex', () => {
    it('returns 0 for device_classification', () => {
      expect(getStepIndex('device_classification')).toBe(0);
    });

    it('returns 1 for predicate_search', () => {
      expect(getStepIndex('predicate_search')).toBe(1);
    });

    it('returns 2 for substantial_equivalence', () => {
      expect(getStepIndex('substantial_equivalence')).toBe(2);
    });

    it('returns 3 for performance_summary', () => {
      expect(getStepIndex('performance_summary')).toBe(3);
    });

    it('returns 4 for labeling_review', () => {
      expect(getStepIndex('labeling_review')).toBe(4);
    });

    it('returns 5 for submission_assembly', () => {
      expect(getStepIndex('submission_assembly')).toBe(5);
    });
  });

  describe('isValidStep', () => {
    it('returns true for each valid step', () => {
      for (const step of SUBMISSION_DRAFTER_STEPS) {
        expect(isValidStep(step)).toBe(true);
      }
    });

    it('returns false for invalid string', () => {
      expect(isValidStep('unknown_step')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isValidStep('')).toBe(false);
    });
  });

  describe('getNextStep', () => {
    it('returns predicate_search after device_classification', () => {
      expect(getNextStep('device_classification')).toBe('predicate_search');
    });

    it('returns substantial_equivalence after predicate_search', () => {
      expect(getNextStep('predicate_search')).toBe('substantial_equivalence');
    });

    it('returns performance_summary after substantial_equivalence', () => {
      expect(getNextStep('substantial_equivalence')).toBe('performance_summary');
    });

    it('returns labeling_review after performance_summary', () => {
      expect(getNextStep('performance_summary')).toBe('labeling_review');
    });

    it('returns submission_assembly after labeling_review', () => {
      expect(getNextStep('labeling_review')).toBe('submission_assembly');
    });

    it('returns null for the last step (submission_assembly)', () => {
      expect(getNextStep('submission_assembly')).toBeNull();
    });
  });
});
