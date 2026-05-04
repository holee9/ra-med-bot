import {
  INDICATION_IMPACT_STEPS,
  getNextStep,
  getStepIndex,
  isValidStep,
} from '@/lib/workflows/indication-impact/steps';
import { describe, expect, it } from 'vitest';

describe('indication-impact/steps', () => {
  describe('INDICATION_IMPACT_STEPS', () => {
    it('has exactly 6 steps', () => {
      expect(INDICATION_IMPACT_STEPS).toHaveLength(6);
    });

    it('contains all expected steps in order', () => {
      expect(INDICATION_IMPACT_STEPS).toEqual([
        'indication_comparison',
        'regulatory_pathway_assessment',
        'predicate_impact_analysis',
        'clinical_data_gap_analysis',
        'market_specific_requirements',
        'impact_report_generation',
      ]);
    });
  });

  describe('getStepIndex', () => {
    it('returns 0 for indication_comparison', () => {
      expect(getStepIndex('indication_comparison')).toBe(0);
    });

    it('returns 1 for regulatory_pathway_assessment', () => {
      expect(getStepIndex('regulatory_pathway_assessment')).toBe(1);
    });

    it('returns 2 for predicate_impact_analysis', () => {
      expect(getStepIndex('predicate_impact_analysis')).toBe(2);
    });

    it('returns 3 for clinical_data_gap_analysis', () => {
      expect(getStepIndex('clinical_data_gap_analysis')).toBe(3);
    });

    it('returns 4 for market_specific_requirements', () => {
      expect(getStepIndex('market_specific_requirements')).toBe(4);
    });

    it('returns 5 for impact_report_generation', () => {
      expect(getStepIndex('impact_report_generation')).toBe(5);
    });
  });

  describe('isValidStep', () => {
    it('returns true for each valid step', () => {
      for (const step of INDICATION_IMPACT_STEPS) {
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
    it('returns regulatory_pathway_assessment after indication_comparison', () => {
      expect(getNextStep('indication_comparison')).toBe('regulatory_pathway_assessment');
    });

    it('returns predicate_impact_analysis after regulatory_pathway_assessment', () => {
      expect(getNextStep('regulatory_pathway_assessment')).toBe('predicate_impact_analysis');
    });

    it('returns clinical_data_gap_analysis after predicate_impact_analysis', () => {
      expect(getNextStep('predicate_impact_analysis')).toBe('clinical_data_gap_analysis');
    });

    it('returns market_specific_requirements after clinical_data_gap_analysis', () => {
      expect(getNextStep('clinical_data_gap_analysis')).toBe('market_specific_requirements');
    });

    it('returns impact_report_generation after market_specific_requirements', () => {
      expect(getNextStep('market_specific_requirements')).toBe('impact_report_generation');
    });

    it('returns null for the last step (impact_report_generation)', () => {
      expect(getNextStep('impact_report_generation')).toBeNull();
    });
  });
});
