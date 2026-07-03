/**
 * CI Gate: Migration Sequence Checker
 *
 * Reads the migrations/ directory and validates that migration files
 * are sequentially numbered with no gaps and no duplicates.
 *
 * Exit 0: Migrations are sequential.
 * Exit 1: Gap or duplicate detected.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { logger } from '../../lib/observability/logger.ts';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');

function getMigrationFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    logger.error(`migrations/ directory not found at ${MIGRATIONS_DIR}`);
    process.exit(1);
  }
  return fs.readdirSync(MIGRATIONS_DIR);
}

function parseMigrationNumbers(files: string[]): number[] {
  return files
    // Skip `*_rollback.sql` companions — they intentionally share the primary
    // migration number (e.g. 0102_foo.sql + 0102_foo_rollback.sql) per project
    // convention. Only primary migrations participate in the sequence.
    .filter((f) => /^\d{4}_.*\.sql$/.test(f) && !/_rollback\.sql$/u.test(f))
    .map((f) => Number.parseInt(f.slice(0, 4), 10))
    .sort((a, b) => a - b);
}

function checkSequential(numbers: number[]): { ok: boolean; error?: string } {
  if (numbers.length === 0) {
    return { ok: true };
  }

  // Check duplicates first
  const seen = new Set<number>();
  const duplicates: number[] = [];
  for (const n of numbers) {
    if (seen.has(n)) duplicates.push(n);
    seen.add(n);
  }
  if (duplicates.length > 0) {
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

function main(): void {
  const files = getMigrationFiles();
  const numbers = parseMigrationNumbers(files);

  if (numbers.length === 0) {
    process.exit(0);
  }

  const result = checkSequential(numbers);

  if (!result.ok) {
    logger.error(`Migration sequence error: ${result.error}`);
    process.exit(1);
  }

  const _first = String(numbers[0]).padStart(4, '0');
  const _last = String(numbers[numbers.length - 1]).padStart(4, '0');
  process.exit(0);
}

main();
