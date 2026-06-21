import { describe, it, expect } from 'vitest';
import {
  getUatScenarioScript,
  generateUatSignoffDocument,
  checkUatCitationAccuracy,
} from '../../../scripts/qa/gate-4-domain-uat';

describe('gate-4-domain-uat', () => {
  describe('getUatScenarioScript', () => {
    it('returns a non-empty string', () => {
      const script = getUatScenarioScript();
      expect(typeof script).toBe('string');
      expect(script.length).toBeGreaterThan(0);
    });

    it('contains key sections', () => {
      const script = getUatScenarioScript();
      expect(script).toContain('Scenario 1');
      expect(script).toContain('Scenario 2');
      expect(script).toContain('Scenario 3');
      expect(script).toContain('Scenario 4');
      expect(script).toContain('Citation');
      expect(script).toContain('Audit Trail');
    });
  });

  describe('generateUatSignoffDocument', () => {
    it('produces valid markdown containing tester names', () => {
      const doc = generateUatSignoffDocument({
        testers: ['Dr. Kim', 'Dr. Park', 'Dr. Lee'],
        date: '2026-06-21',
        scenariosRun: ['Query Validation', 'Citation Verification', 'Audit Trail Review'],
        defectsFound: [],
        citationAccuracy: 0.96,
        sourceLicenseReviewed: true,
        decision: 'accept',
      });

      expect(doc).toContain('Dr. Kim');
      expect(doc).toContain('Dr. Park');
      expect(doc).toContain('Dr. Lee');
      expect(doc).toContain('ACCEPT');
      expect(doc).toContain('2026-06-21');
      expect(doc).toContain('96.0%');
    });

    it('shows REJECT when decision is reject', () => {
      const doc = generateUatSignoffDocument({
        testers: ['Dr. Kim'],
        date: '2026-06-21',
        scenariosRun: ['Query Validation'],
        defectsFound: ['Critical: Citation mismatch on methotrexate dosage'],
        citationAccuracy: 0.90,
        sourceLicenseReviewed: false,
        decision: 'reject',
      });

      expect(doc).toContain('REJECT');
      expect(doc).toContain('Critical: Citation mismatch');
    });
  });

  describe('checkUatCitationAccuracy', () => {
    it('48/50 = 96% meets threshold', () => {
      const result = checkUatCitationAccuracy(50, 48);
      expect(result.accuracy).toBeCloseTo(0.96, 5);
      expect(result.meetsThreshold).toBe(true);
    });

    it('47/50 = 94% fails threshold', () => {
      const result = checkUatCitationAccuracy(50, 47);
      expect(result.accuracy).toBeCloseTo(0.94, 5);
      expect(result.meetsThreshold).toBe(false);
    });

    it('exactly 50/50 = 100% meets threshold', () => {
      const result = checkUatCitationAccuracy(50, 50);
      expect(result.accuracy).toBe(1.0);
      expect(result.meetsThreshold).toBe(true);
    });
  });
});
