import {
  AUDIT_RESPONSE_STEPS,
  getNextStep,
  getStepIndex,
  isValidStep,
} from '@/lib/workflows/audit-response/steps';
import { describe, expect, it } from 'vitest';

describe('audit-response/steps', () => {
  describe('AUDIT_RESPONSE_STEPS', () => {
    it('has exactly 6 steps', () => {
      expect(AUDIT_RESPONSE_STEPS).toHaveLength(6);
    });

    it('contains all expected steps in order', () => {
      expect(AUDIT_RESPONSE_STEPS).toEqual([
        'deficiency_analysis',
        'root_cause_identification',
        'corrective_action_plan',
        'regulatory_reference_mapping',
        'response_drafting',
        'legal_review_gate',
      ]);
    });
  });

  describe('getStepIndex', () => {
    it('returns 0 for deficiency_analysis', () => {
      expect(getStepIndex('deficiency_analysis')).toBe(0);
    });

    it('returns 1 for root_cause_identification', () => {
      expect(getStepIndex('root_cause_identification')).toBe(1);
    });

    it('returns 2 for corrective_action_plan', () => {
      expect(getStepIndex('corrective_action_plan')).toBe(2);
    });

    it('returns 3 for regulatory_reference_mapping', () => {
      expect(getStepIndex('regulatory_reference_mapping')).toBe(3);
    });

    it('returns 4 for response_drafting', () => {
      expect(getStepIndex('response_drafting')).toBe(4);
    });

    it('returns 5 for legal_review_gate', () => {
      expect(getStepIndex('legal_review_gate')).toBe(5);
    });
  });

  describe('isValidStep', () => {
    it('returns true for each valid step', () => {
      for (const step of AUDIT_RESPONSE_STEPS) {
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
    it('returns root_cause_identification after deficiency_analysis', () => {
      expect(getNextStep('deficiency_analysis')).toBe('root_cause_identification');
    });

    it('returns corrective_action_plan after root_cause_identification', () => {
      expect(getNextStep('root_cause_identification')).toBe('corrective_action_plan');
    });

    it('returns regulatory_reference_mapping after corrective_action_plan', () => {
      expect(getNextStep('corrective_action_plan')).toBe('regulatory_reference_mapping');
    });

    it('returns response_drafting after regulatory_reference_mapping', () => {
      expect(getNextStep('regulatory_reference_mapping')).toBe('response_drafting');
    });

    it('returns legal_review_gate after response_drafting', () => {
      expect(getNextStep('response_drafting')).toBe('legal_review_gate');
    });

    it('returns null for the last step (legal_review_gate)', () => {
      expect(getNextStep('legal_review_gate')).toBeNull();
    });
  });
});
