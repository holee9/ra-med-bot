// @MX:NOTE [AUTO] CI shape test for security workflow files — REQ-LAUNCH-032, REQ-LAUNCH-033.
// @MX:SPEC SPEC-REGULA-LAUNCH-001 (REQ-LAUNCH-032, REQ-LAUNCH-033)
// Verifies that .github/workflows/security.yml and .gitleaks.toml exist and
// contain the expected CI configuration keys.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..');

const securityWorkflow = path.join(ROOT, '.github/workflows/security.yml');
const gitleaksConfig = path.join(ROOT, '.gitleaks.toml');

describe('Security CI workflow shape (REQ-LAUNCH-032)', () => {
  it('.github/workflows/security.yml exists', () => {
    expect(existsSync(securityWorkflow)).toBe(true);
  });

  it('security.yml contains dependency-audit job', () => {
    const content = readFileSync(securityWorkflow, 'utf-8');
    expect(content).toContain('dependency-audit');
  });

  it('security.yml runs pnpm audit --audit-level=high', () => {
    const content = readFileSync(securityWorkflow, 'utf-8');
    expect(content).toContain('pnpm audit');
    expect(content).toContain('audit-level=high');
  });

  it('security.yml triggers on pull_request to main', () => {
    const content = readFileSync(securityWorkflow, 'utf-8');
    expect(content).toContain('pull_request');
    expect(content).toContain('main');
  });

  it('security.yml includes a scheduled cron trigger', () => {
    const content = readFileSync(securityWorkflow, 'utf-8');
    expect(content).toContain('schedule');
    expect(content).toContain('cron');
  });
});

describe('Gitleaks secret scan shape (REQ-LAUNCH-033)', () => {
  it('.gitleaks.toml exists', () => {
    expect(existsSync(gitleaksConfig)).toBe(true);
  });

  it('security.yml contains secret-scan job using gitleaks', () => {
    const content = readFileSync(securityWorkflow, 'utf-8');
    expect(content).toContain('secret-scan');
    expect(content).toContain('gitleaks');
  });

  it('.gitleaks.toml extends the default ruleset', () => {
    const content = readFileSync(gitleaksConfig, 'utf-8');
    expect(content).toContain('useDefault');
  });

  it('.gitleaks.toml has allowlist section', () => {
    const content = readFileSync(gitleaksConfig, 'utf-8');
    expect(content).toContain('allowlist');
  });

  it('.gitleaks.toml allows .env example files', () => {
    const content = readFileSync(gitleaksConfig, 'utf-8');
    expect(content).toContain('.env');
  });
});
