// @MX:NOTE [AUTO] Security documentation shape test — verifies REQ-LAUNCH-029.
// @MX:SPEC SPEC-REGULA-LAUNCH-001 (REQ-LAUNCH-029)
// Reads markdown files at docs/security/ and asserts required sections exist.
// No runtime app code imports; runs before any application code changes.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const securityDoc = (name: string) => path.join(root, 'docs/security', name);
const readDoc = (name: string) => readFileSync(securityDoc(name), 'utf-8');

// OWASP Top 10 2021 category IDs
const OWASP_IDS = ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10'];

describe('Security documentation shape (REQ-LAUNCH-029)', () => {
  it('owasp-top10-2025.md exists and has all 10 OWASP 2021 categories', () => {
    expect(existsSync(securityDoc('owasp-top10-2025.md'))).toBe(true);
    const content = readDoc('owasp-top10-2025.md');
    for (const id of OWASP_IDS) {
      expect(content, `OWASP category ${id} must appear in the document`).toContain(id);
    }
  });

  it('owasp-top10-2025.md contains a Status column', () => {
    const content = readDoc('owasp-top10-2025.md');
    expect(content).toContain('Status');
  });

  it('threat-model.md exists and has required sections', () => {
    expect(existsSync(securityDoc('threat-model.md'))).toBe(true);
    const content = readDoc('threat-model.md');
    expect(content).toContain('Threat');
    expect(content).toContain('Mitigation');
  });

  it('threat-model.md covers A04 Insecure Design', () => {
    const content = readDoc('threat-model.md');
    expect(content).toContain('A04');
  });

  it('pentest-plan.md exists and has meaningful content', () => {
    expect(existsSync(securityDoc('pentest-plan.md'))).toBe(true);
    const content = readDoc('pentest-plan.md');
    expect(content.length).toBeGreaterThan(200);
  });

  it('pentest-plan.md contains scope and timeline sections', () => {
    const content = readDoc('pentest-plan.md');
    expect(content).toContain('Scope');
    expect(content).toContain('Timeline');
  });
});
