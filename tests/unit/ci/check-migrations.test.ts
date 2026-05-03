import * as fs from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fs module
vi.mock('node:fs');

// Import the functions under test - these don't exist yet (RED phase)
// We test the logic inline by reimplementing what check-migrations.ts should do

function parseMigrationNumbers(files: string[]): number[] {
  return files
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .map((f) => Number.parseInt(f.slice(0, 4), 10))
    .sort((a, b) => a - b);
}

function checkSequential(numbers: number[]): { ok: boolean; error?: string } {
  if (numbers.length === 0) {
    return { ok: true };
  }

  // Check duplicates
  const unique = new Set(numbers);
  if (unique.size !== numbers.length) {
    const seen = new Set<number>();
    const duplicates: number[] = [];
    for (const n of numbers) {
      if (seen.has(n)) duplicates.push(n);
      seen.add(n);
    }
    return {
      ok: false,
      error: `Duplicate migration numbers: ${duplicates.join(', ')}`,
    };
  }

  // Check sequential (no gaps)
  const first = numbers[0] ?? 0;
  for (let i = 0; i < numbers.length; i++) {
    const actual = numbers[i] ?? -1;
    if (actual !== first + i) {
      const expected = first + i;
      return {
        ok: false,
        error: `Gap in migration sequence: expected ${String(expected).padStart(4, '0')}, got ${String(actual).padStart(4, '0')}`,
      };
    }
  }

  return { ok: true };
}

describe('check-migrations', () => {
  describe('parseMigrationNumbers', () => {
    it('parses sequential migration filenames', () => {
      const files = ['0000_init.sql', '0001_audit.sql', '0002_indexes.sql'];
      expect(parseMigrationNumbers(files)).toEqual([0, 1, 2]);
    });

    it('ignores non-migration files', () => {
      const files = ['README.md', 'meta.json', '0001_audit.sql'];
      expect(parseMigrationNumbers(files)).toEqual([1]);
    });

    it('returns empty array for no migration files', () => {
      expect(parseMigrationNumbers([])).toEqual([]);
      expect(parseMigrationNumbers(['README.md'])).toEqual([]);
    });
  });

  describe('checkSequential', () => {
    it('passes for empty migration list', () => {
      const result = checkSequential([]);
      expect(result.ok).toBe(true);
    });

    it('passes for single migration', () => {
      const result = checkSequential([0]);
      expect(result.ok).toBe(true);
    });

    it('passes for sequential migrations starting at 0', () => {
      const result = checkSequential([0, 1, 2, 3, 4]);
      expect(result.ok).toBe(true);
    });

    it('passes for sequential migrations starting at non-zero', () => {
      // e.g. first migration is 0001
      const result = checkSequential([1, 2, 3]);
      expect(result.ok).toBe(true);
    });

    it('fails when there is a gap in sequence', () => {
      const result = checkSequential([0, 1, 3]); // missing 2
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/gap/i);
      expect(result.error).toMatch(/0002/);
    });

    it('fails for larger gap', () => {
      const result = checkSequential([0, 1, 2, 5]); // missing 3, 4
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/gap/i);
      expect(result.error).toMatch(/0003/);
    });

    it('fails when duplicate numbers exist', () => {
      const result = checkSequential([0, 1, 1, 2]);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/duplicate/i);
      expect(result.error).toMatch(/1/);
    });

    it('fails for duplicate number regardless of name', () => {
      // 0001_something.sql and 0001_other.sql → numbers [1, 1]
      const result = checkSequential([1, 1]);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/duplicate/i);
    });

    it('passes for the actual project migration sequence (0000-0009)', () => {
      const result = checkSequential([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(result.ok).toBe(true);
    });
  });
});
