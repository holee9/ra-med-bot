// @MX:NOTE: [AUTO] k6 production URL guard validation — REQ-LAUNCH-028
// @MX:SPEC: SPEC-REGULA-LAUNCH-001
// Verifies that k6-mock.js contains a production URL abort guard
// so it can never accidentally target production environments.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const k6MockPath = path.join(root, 'tests', 'load', 'k6-mock.js');

describe('tests/load/k6-mock.js — REQ-LAUNCH-028 production URL guard', () => {
  it('file exists', () => {
    expect(fs.existsSync(k6MockPath), `k6-mock.js not found at ${k6MockPath}`).toBe(true);
  });

  it('checks that BASE_URL does not contain a production domain', () => {
    const content = fs.readFileSync(k6MockPath, 'utf8');
    // Must check for at least one known production domain indicator
    const hasProductionCheck =
      content.includes('regula.') ||
      content.includes('vercel.app') ||
      content.includes('neon.tech') ||
      // Generic pattern: production guard that inspects BASE_URL
      (content.includes('BASE_URL') && content.includes('includes('));
    expect(hasProductionCheck).toBe(true);
  });

  it('throws or aborts if BASE_URL is a production URL', () => {
    const content = fs.readFileSync(k6MockPath, 'utf8');
    // Must contain a throw statement for the guard to be effective
    expect(content).toContain('throw new Error');
    // The error message must reference ABORT or production
    const hasAbortMessage = content.includes('ABORT') || content.includes('production');
    expect(hasAbortMessage).toBe(true);
  });

  it('guard executes at module-level (before export default)', () => {
    const content = fs.readFileSync(k6MockPath, 'utf8');
    const throwIndex = content.indexOf('throw new Error');
    const exportDefaultIndex = content.indexOf('export default function');
    // The guard throw must appear before the default export
    expect(throwIndex).toBeGreaterThan(-1);
    expect(exportDefaultIndex).toBeGreaterThan(-1);
    expect(throwIndex).toBeLessThan(exportDefaultIndex);
  });
});
