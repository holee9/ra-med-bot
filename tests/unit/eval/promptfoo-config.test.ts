/**
 * SPEC-REGULA-QUALITY-001 — REQ-QUAL-006~010
 *
 * Verifies the promptfoo eval harness is wired for `pnpm eval:ci`:
 *  - all 6 datasets are referenced
 *  - outputPath is configured to tests/eval/results/latest.json
 *  - threshold is >= 0.80
 *  - each referenced dataset file exists on disk
 *  - results directory exists with baseline.json showing >= 80% pass rate
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const CONFIG_PATH = path.join(ROOT, 'tests', 'eval', 'promptfoo.config.yaml');
const EVAL_DIR = path.join(ROOT, 'tests', 'eval');
const RESULTS_DIR = path.join(EVAL_DIR, 'results');

const REQUIRED_DATASETS = [
  'fda.yaml',
  'eu-mdr.yaml',
  'mfds.yaml',
  'nmpa.yaml',
  'pmda.yaml',
  'internal-sop.yaml',
] as const;

describe('REQ-QUAL-006: promptfoo.config.yaml references all 6 datasets', () => {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');

  for (const ds of REQUIRED_DATASETS) {
    it(`references datasets/${ds}`, () => {
      expect(raw).toContain(`./datasets/${ds}`);
    });

    it(`datasets/${ds} exists on disk`, () => {
      const p = path.join(EVAL_DIR, 'datasets', ds);
      expect(fs.existsSync(p)).toBe(true);
      const stats = fs.statSync(p);
      expect(stats.size).toBeGreaterThan(0);
    });

    it(`datasets/${ds} contains >= 5 scenarios`, () => {
      const p = path.join(EVAL_DIR, 'datasets', ds);
      const text = fs.readFileSync(p, 'utf-8');
      const matches = text.match(/^- description:/gm) ?? [];
      expect(matches.length).toBeGreaterThanOrEqual(5);
    });
  }
});

describe('REQ-QUAL-007: outputPath configured for results persistence', () => {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');

  it('config declares outputPath', () => {
    expect(raw).toMatch(/^outputPath:\s*tests\/eval\/results\/latest\.json/m);
  });

  it('package.json eval:ci script writes to results/latest.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')) as {
      scripts?: Record<string, string>;
    };
    const script = pkg.scripts?.['eval:ci'] ?? '';
    expect(script).toContain('promptfoo eval');
    expect(script).toContain('tests/eval/promptfoo.config.yaml');
    expect(script).toContain('tests/eval/results/latest.json');
  });
});

describe('REQ-QUAL-008: threshold >= 0.80 (pass-rate gate)', () => {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');

  it('config declares a numeric threshold', () => {
    const match = raw.match(/^threshold:\s*([0-9.]+)/m);
    expect(match).not.toBeNull();
    const value = Number.parseFloat(match?.[1] ?? '0');
    expect(value).toBeGreaterThanOrEqual(0.8);
  });
});

describe('REQ-QUAL-009: results directory + baseline file', () => {
  it('tests/eval/results/ directory is tracked (.gitkeep)', () => {
    expect(fs.existsSync(path.join(RESULTS_DIR, '.gitkeep'))).toBe(true);
  });

  it('baseline.json exists with valid promptfoo-shaped structure', () => {
    const baselinePath = path.join(RESULTS_DIR, 'baseline.json');
    expect(fs.existsSync(baselinePath)).toBe(true);

    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8')) as {
      version: string;
      results: { stats: { successes: number; failures: number; totalTests: number } };
      passRate: number;
    };

    expect(baseline.version).toBeDefined();
    expect(baseline.results.stats.totalTests).toBeGreaterThan(0);
    expect(baseline.results.stats.successes + baseline.results.stats.failures).toBe(
      baseline.results.stats.totalTests,
    );
    expect(baseline.passRate).toBeGreaterThanOrEqual(0.8);
  });
});

describe('REQ-QUAL-010: total scenario count across all datasets', () => {
  it('aggregates >= 30 scenarios (production sufficiency floor)', () => {
    let total = 0;
    for (const ds of REQUIRED_DATASETS) {
      const text = fs.readFileSync(path.join(EVAL_DIR, 'datasets', ds), 'utf-8');
      total += (text.match(/^- description:/gm) ?? []).length;
    }
    expect(total).toBeGreaterThanOrEqual(30);
  });
});
