/**
 * SPEC-REGULA-LAUNCH-001 — REQ-LAUNCH-001, REQ-LAUNCH-002
 *
 * Verifies that the promptfoo eval harness skeleton is correctly installed and configured.
 *
 * RED phase: all tests fail until GREEN phase installs promptfoo and creates config.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');

// ---------------------------------------------------------------------------
// REQ-LAUNCH-001: promptfoo secure baseline in devDependencies
// ---------------------------------------------------------------------------
describe('REQ-LAUNCH-001: promptfoo devDependency', () => {
  it('lists promptfoo in package.json devDependencies', () => {
    const pkgPath = path.join(ROOT, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      devDependencies?: Record<string, string>;
    };
    expect(pkg.devDependencies).toBeDefined();
    expect(Object.keys(pkg.devDependencies ?? {})).toContain('promptfoo');
  });

  it('promptfoo version satisfies current security baseline', () => {
    const pkgPath = path.join(ROOT, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      devDependencies?: Record<string, string>;
    };
    const version = pkg.devDependencies?.promptfoo ?? '';
    const match = /^\^0\.(\d+)\.(\d+)$/.exec(version);
    expect(match).not.toBeNull();
    expect(Number(match?.[1] ?? 0)).toBeGreaterThanOrEqual(121);
  });

  it('package.json includes eval:ci script', () => {
    const pkgPath = path.join(ROOT, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.['eval:ci']).toBeDefined();
    expect(pkg.scripts?.['eval:ci']).toContain('promptfoo eval');
    expect(pkg.scripts?.['eval:ci']).toContain('tests/eval/promptfoo.config.yaml');
  });
});

// ---------------------------------------------------------------------------
// REQ-LAUNCH-002: tests/eval/promptfoo.config.yaml exists with correct structure
// ---------------------------------------------------------------------------
describe('REQ-LAUNCH-002: promptfoo.config.yaml structure', () => {
  const configPath = path.join(ROOT, 'tests', 'eval', 'promptfoo.config.yaml');

  it('config file exists', () => {
    expect(fs.existsSync(configPath)).toBe(true);
  });

  it('config is valid YAML (non-empty file without JSON-incompatible syntax)', () => {
    const raw = fs.readFileSync(configPath, 'utf-8');
    // Must be non-empty and not start with a BOM or binary
    expect(raw.trim().length).toBeGreaterThan(0);
    // Must not contain tab indentation (YAML spec violation)
    const lines = raw.split('\n');
    for (const line of lines) {
      expect(line.startsWith('\t')).toBe(false);
    }
  });

  it('config has a providers key', () => {
    const raw = fs.readFileSync(configPath, 'utf-8');
    // Simple key presence check — YAML top-level keys appear as "^key:" at start of line
    expect(raw).toMatch(/^providers:/m);
  });

  it('config has a tests or testSets key', () => {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const hasTests = /^tests:/m.test(raw) || /^testSets:/m.test(raw);
    expect(hasTests).toBe(true);
  });

  it('config has an evaluators key', () => {
    const raw = fs.readFileSync(configPath, 'utf-8');
    expect(raw).toMatch(/^evaluators:/m);
  });
});

// ---------------------------------------------------------------------------
// Directory structure
// ---------------------------------------------------------------------------
describe('Directory structure for eval harness', () => {
  it('tests/eval/datasets/ directory exists', () => {
    const dir = path.join(ROOT, 'tests', 'eval', 'datasets');
    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.statSync(dir).isDirectory()).toBe(true);
  });

  it('tests/eval/scorers/ directory exists', () => {
    const dir = path.join(ROOT, 'tests', 'eval', 'scorers');
    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.statSync(dir).isDirectory()).toBe(true);
  });
});
