// @MX:NOTE [AUTO] Deployment documentation shape test — verifies REQ-LAUNCH-039.
// @MX:SPEC SPEC-REGULA-LAUNCH-001 (REQ-LAUNCH-039)
// Reads markdown files at docs/deployment/ and asserts required sections exist.
// No runtime app code imports; runs before any application code changes.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const deployDoc = (name: string) => path.join(root, 'docs/deployment', name);
const readDoc = (name: string) => readFileSync(deployDoc(name), 'utf-8');

describe('Deployment documentation (REQ-LAUNCH-039)', () => {
  it('env-matrix.md exists', () => {
    expect(existsSync(deployDoc('env-matrix.md'))).toBe(true);
  });

  it('env-matrix.md covers dev/preview/production', () => {
    const content = readDoc('env-matrix.md');
    expect(content).toContain('development');
    expect(content).toContain('preview');
    expect(content).toContain('production');
  });

  it('env-matrix.md covers required env vars', () => {
    const content = readDoc('env-matrix.md');
    expect(content).toContain('DATABASE_URL');
    expect(content).toContain('ANTHROPIC_API_KEY');
    expect(content).toContain('AUTH_SECRET');
  });

  it('dns-setup.md exists', () => {
    expect(existsSync(deployDoc('dns-setup.md'))).toBe(true);
  });

  it('dns-setup.md has CNAME and HSTS sections', () => {
    const content = readDoc('dns-setup.md');
    expect(content).toContain('CNAME');
    expect(content).toMatch(/HSTS|Strict-Transport/i);
  });
});
