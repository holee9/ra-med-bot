// SPEC-V3-IMPACT-001 M3: Layer 1 retestMatrix lookup engine.
// TDD RED Phase: Write failing test first.

import { describe, expect, it } from 'vitest';
import { calculateSignal, lookupRetestMatrix } from '../layer1-matrix-lookup';
import type { RetestMatrixCell } from '../retest-matrix-data';

describe('Layer 1: retestMatrix Lookup', () => {
  describe('AC-IMP-05: Layer 1 retestMatrix rule lookup', () => {
    it('should lookup bom-us cell correctly', () => {
      const result = lookupRetestMatrix('bom', 'us');
      expect(result).toBeDefined();
      expect(result.level).toBe('conditional');
      expect(result.ref).toBe('FDA Design Change §III.A');
      expect(result.note).toContain('Special 510(k)');
    });

    it('should lookup sw-eu cell correctly', () => {
      const result = lookupRetestMatrix('sw', 'eu');
      expect(result).toBeDefined();
      expect(result.level).toBe('required');
      expect(result.ref).toBe('MDR Art. 10(9), MDCG 2024-9');
      expect(result.note).toContain('CIP 없으면 TR 개정 필수');
    });

    it('should throw runtime error for missing cell', () => {
      expect(() => lookupRetestMatrix('invalid', 'us')).toThrow('retestMatrix 셀 누락');
      expect(() => lookupRetestMatrix('bom', 'invalid')).toThrow('retestMatrix 셀 누락');
    });

    it('should lookup all 5 markets for a change type', () => {
      const markets = ['us', 'eu', 'kr', 'cn', 'jp'];
      const results = markets.map((m) => lookupRetestMatrix('bom', m));

      expect(results).toHaveLength(5);
      for (const result of results) {
        expect(result).toBeDefined();
        expect(['required', 'conditional', 'not-required']).toContain(result.level);
      }
    });
  });

  describe('AC-IMP-09: Signal calculation', () => {
    it('should return Green when all markets are not-required', () => {
      const matrixResults: RetestMatrixCell[] = [
        { level: 'not-required', ref: '', note: '' },
        { level: 'not-required', ref: '', note: '' },
      ];

      const signal = calculateSignal(matrixResults, 85);
      expect(signal).toBe('green');
    });

    it('should return Yellow when some markets are conditional', () => {
      const matrixResults: RetestMatrixCell[] = [
        { level: 'not-required', ref: '', note: '' },
        { level: 'conditional', ref: '', note: '' },
        { level: 'not-required', ref: '', note: '' },
      ];

      const signal = calculateSignal(matrixResults, 90);
      expect(signal).toBe('yellow');
    });

    it('should return Red when any market is required', () => {
      const matrixResults: RetestMatrixCell[] = [
        { level: 'not-required', ref: '', note: '' },
        { level: 'required', ref: '', note: '' },
        { level: 'conditional', ref: '', note: '' },
      ];

      const signal = calculateSignal(matrixResults, 95);
      expect(signal).toBe('red');
    });

    it('should return Red when confidence < 70', () => {
      const matrixResults: RetestMatrixCell[] = [
        { level: 'not-required', ref: '', note: '' },
        { level: 'not-required', ref: '', note: '' },
      ];

      const signal = calculateSignal(matrixResults, 65);
      expect(signal).toBe('red');
    });

    it('should return Yellow when confidence < 90 (but >= 70) with conditional market', () => {
      const matrixResults: RetestMatrixCell[] = [
        { level: 'not-required', ref: '', note: '' },
        { level: 'conditional', ref: '', note: '' },
      ];

      const signal = calculateSignal(matrixResults, 85);
      expect(signal).toBe('yellow');
    });
  });
});
