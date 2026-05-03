/**
 * SPEC-REGULA-LAUNCH-001 — REQ-LAUNCH-005 (TASK-004)
 *
 * Validates that the eval execution script and env example exist and
 * contain the required commands/content.
 *
 * RED phase: fails until GREEN phase creates scripts/run-eval.sh and .env.eval.example.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function fileContent(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

// ---------------------------------------------------------------------------
// REQ-LAUNCH-005: scripts/run-eval.sh exists and is correctly structured
// ---------------------------------------------------------------------------
describe('REQ-LAUNCH-005: scripts/run-eval.sh', () => {
  it('scripts/run-eval.sh exists', () => {
    expect(fileExists('scripts/run-eval.sh')).toBe(true);
  });

  it('scripts/run-eval.sh has bash shebang', () => {
    const content = fileContent('scripts/run-eval.sh');
    expect(content).toMatch(/^#!\/usr\/bin\/env bash/);
  });

  it('scripts/run-eval.sh uses set -euo pipefail', () => {
    const content = fileContent('scripts/run-eval.sh');
    expect(content).toContain('set -euo pipefail');
  });

  it('scripts/run-eval.sh references promptfoo.config.yaml', () => {
    const content = fileContent('scripts/run-eval.sh');
    expect(content).toContain('tests/eval/promptfoo.config.yaml');
  });

  it('scripts/run-eval.sh contains promptfoo eval command', () => {
    const content = fileContent('scripts/run-eval.sh');
    expect(content).toContain('promptfoo eval');
  });

  it('scripts/run-eval.sh handles --ci flag', () => {
    const content = fileContent('scripts/run-eval.sh');
    expect(content).toContain('--ci');
  });

  it('scripts/run-eval.sh outputs JSON in CI mode', () => {
    const content = fileContent('scripts/run-eval.sh');
    expect(content).toContain('json');
  });

  it('scripts/run-eval.sh has error handling for missing config', () => {
    const content = fileContent('scripts/run-eval.sh');
    // Must check for config file existence
    expect(content).toMatch(/if.*!.*-f/);
  });
});

// ---------------------------------------------------------------------------
// REQ-LAUNCH-005: .env.eval.example exists and contains required vars
// ---------------------------------------------------------------------------
describe('REQ-LAUNCH-005: .env.eval.example', () => {
  it('.env.eval.example exists', () => {
    expect(fileExists('.env.eval.example')).toBe(true);
  });

  it('.env.eval.example contains ANTHROPIC_API_KEY_EVAL', () => {
    const content = fileContent('.env.eval.example');
    expect(content).toContain('ANTHROPIC_API_KEY_EVAL');
  });

  it('.env.eval.example contains Langfuse env vars', () => {
    const content = fileContent('.env.eval.example');
    expect(content).toContain('LANGFUSE_PUBLIC_KEY');
    expect(content).toContain('LANGFUSE_SECRET_KEY');
  });
});

// ---------------------------------------------------------------------------
// REQ-LAUNCH-001 regression: package.json eval:ci script exists
// ---------------------------------------------------------------------------
describe('package.json eval:ci script (regression)', () => {
  it('eval:ci script exists in package.json', () => {
    const pkgPath = path.join(ROOT, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.['eval:ci']).toBeDefined();
    expect(pkg.scripts?.['eval:ci']).toContain('promptfoo eval');
  });
});
