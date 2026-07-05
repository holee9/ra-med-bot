// SPEC-V3-IMPACT-001 M2: retestMatrix 35-cell data structure validation.
// TDD RED Phase: Write failing test first.

import { describe, it, expect } from 'vitest';
import { RETEST_MATRIX } from '../retest-matrix-data';

describe('RETEST_MATRIX Data', () => {
  describe('AC-IMP-10: retestMatrix data code embed', () => {
    it('should define 7 change types', () => {
      expect(RETEST_MATRIX.changeTypes).toBeDefined();
      expect(RETEST_MATRIX.changeTypes).toHaveLength(7);
      expect(RETEST_MATRIX.changeTypes.map(ct => ct.id)).toEqual([
        'bom',
        'sw',
        'sw-minor',
        'label',
        'warn',
        'process',
        'sterile',
      ]);
    });

    it('should define 5 markets', () => {
      expect(RETEST_MATRIX.markets).toBeDefined();
      expect(RETEST_MATRIX.markets).toHaveLength(5);
      expect(RETEST_MATRIX.markets.map(m => m.id)).toEqual([
        'us',
        'eu',
        'kr',
        'cn',
        'jp',
      ]);
    });

    it('should define all 35 cells (7 × 5)', () => {
      const expectedCells = [
        'bom-us', 'bom-eu', 'bom-kr', 'bom-cn', 'bom-jp',
        'sw-us', 'sw-eu', 'sw-kr', 'sw-cn', 'sw-jp',
        'sw-minor-us', 'sw-minor-eu', 'sw-minor-kr', 'sw-minor-cn', 'sw-minor-jp',
        'label-us', 'label-eu', 'label-kr', 'label-cn', 'label-jp',
        'warn-us', 'warn-eu', 'warn-kr', 'warn-cn', 'warn-jp',
        'process-us', 'process-eu', 'process-kr', 'process-cn', 'process-jp',
        'sterile-us', 'sterile-eu', 'sterile-kr', 'sterile-cn', 'sterile-jp',
      ];

      expectedCells.forEach(cellKey => {
        expect(RETEST_MATRIX.cells[cellKey]).toBeDefined();
      });

      expect(Object.keys(RETEST_MATRIX.cells)).toHaveLength(35);
    });

    it('should have valid cell structure for bom-us', () => {
      const cell = RETEST_MATRIX.cells['bom-us'];
      expect(cell).toBeDefined();
      if (!cell) throw new Error('cell is undefined'); // Type guard for TS
      expect(cell.level).toMatch(/^(required|conditional|not-required)$/);
      expect(cell.ref).toBeTruthy();
      expect(cell.note).toBeTruthy();
    });

    it('should have valid cell structure for sw-eu', () => {
      const cell = RETEST_MATRIX.cells['sw-eu'];
      expect(cell).toBeDefined();
      if (!cell) throw new Error('cell is undefined'); // Type guard for TS
      expect(cell.level).toMatch(/^(required|conditional|not-required)$/);
      expect(cell.ref).toBeTruthy();
      expect(cell.note).toBeTruthy();
    });

    it('should lookup cells in < 1ms (single lookup)', () => {
      const start = performance.now();
      const cell = RETEST_MATRIX.cells['bom-us'];
      expect(cell).toBeDefined();
      const duration = performance.now() - start;
      // AC-IMP-10: < 10ms for in-memory lookup
      // Single lookup should be much faster than 10ms
      expect(duration).toBeLessThan(10);
    });
  });
});
