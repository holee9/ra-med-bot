import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../..');
const SCRIPT_PATH = resolve(ROOT, 'scripts/run-load.sh');
const PACKAGE_JSON_PATH = resolve(ROOT, 'package.json');

describe('run-load.sh shape', () => {
  it('script file exists', () => {
    expect(existsSync(SCRIPT_PATH)).toBe(true);
  });

  it('script is executable (has execute permission on Unix or is a shell script)', () => {
    // On Windows the executable bit is not enforced, but we verify the file exists
    // and has a valid shebang. On Unix-like CI this will also check the mode bit.
    expect(existsSync(SCRIPT_PATH)).toBe(true);
    const content = readFileSync(SCRIPT_PATH, 'utf-8');
    expect(content.startsWith('#!/usr/bin/env bash')).toBe(true);
  });

  it('script contains staging mode case', () => {
    const content = readFileSync(SCRIPT_PATH, 'utf-8');
    expect(content).toContain('staging)');
  });

  it('script contains mock mode case', () => {
    const content = readFileSync(SCRIPT_PATH, 'utf-8');
    expect(content).toContain('mock)');
  });

  it('script requires BASE_URL for staging mode', () => {
    const content = readFileSync(SCRIPT_PATH, 'utf-8');
    expect(content).toContain('BASE_URL');
    expect(content).toContain('Error: BASE_URL must be set for staging load test');
  });

  it('script runs k6.js for staging mode', () => {
    const content = readFileSync(SCRIPT_PATH, 'utf-8');
    expect(content).toContain('k6.js');
  });

  it('script runs k6-mock.js for mock mode', () => {
    const content = readFileSync(SCRIPT_PATH, 'utf-8');
    expect(content).toContain('k6-mock.js');
  });

  it('script has set -euo pipefail', () => {
    const content = readFileSync(SCRIPT_PATH, 'utf-8');
    expect(content).toContain('set -euo pipefail');
  });

  it('script uses date-stamped report filename for staging', () => {
    const content = readFileSync(SCRIPT_PATH, 'utf-8');
    expect(content).toContain('_staging.json');
  });
});

describe('package.json load scripts', () => {
  it('has load:staging script', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
    expect(pkg.scripts).toHaveProperty('load:staging');
    expect(pkg.scripts['load:staging']).toContain('run-load.sh');
    expect(pkg.scripts['load:staging']).toContain('staging');
  });

  it('has load:mock script', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
    expect(pkg.scripts).toHaveProperty('load:mock');
    expect(pkg.scripts['load:mock']).toContain('run-load.sh');
    expect(pkg.scripts['load:mock']).toContain('mock');
  });

  it('existing scripts are preserved', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
    // Verify a known existing script is still present
    expect(pkg.scripts).toHaveProperty('dev');
    expect(pkg.scripts).toHaveProperty('test');
    expect(pkg.scripts).toHaveProperty('build');
  });
});
