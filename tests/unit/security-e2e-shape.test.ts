// @MX:NOTE: [AUTO] Meta-test: validates security headers E2E spec file structure for SPEC-REGULA-LAUNCH-001
// @MX:SPEC: SPEC-REGULA-LAUNCH-001 (REQ-LAUNCH-034)

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const e2eDir = path.join(root, 'tests', 'e2e');
const securityDir = path.join(root, 'docs', 'security');

describe('Security headers E2E spec existence (TASK-017)', () => {
  it('security-headers.spec.ts exists under tests/e2e/', () => {
    expect(fs.existsSync(path.join(e2eDir, 'security-headers.spec.ts'))).toBe(true);
  });

  it('observatory-screenshot.md exists under docs/security/', () => {
    expect(fs.existsSync(path.join(securityDir, 'observatory-screenshot.md'))).toBe(true);
  });
});

describe('Security headers E2E spec structure (REQ-LAUNCH-034)', () => {
  const specFile = path.join(e2eDir, 'security-headers.spec.ts');

  it('security-headers.spec.ts imports from @playwright/test', () => {
    if (!fs.existsSync(specFile)) {
      expect.fail('File does not exist: security-headers.spec.ts');
    }
    const content = fs.readFileSync(specFile, 'utf8');
    expect(content).toContain('@playwright/test');
  });

  it('security-headers.spec.ts contains test.describe', () => {
    if (!fs.existsSync(specFile)) {
      expect.fail('File does not exist: security-headers.spec.ts');
    }
    const content = fs.readFileSync(specFile, 'utf8');
    expect(content).toMatch(/test\.describe\s*\(/);
  });

  it('security-headers.spec.ts checks X-Frame-Options header', () => {
    if (!fs.existsSync(specFile)) {
      expect.fail('File does not exist: security-headers.spec.ts');
    }
    const content = fs.readFileSync(specFile, 'utf8');
    expect(content).toContain('X-Frame-Options');
  });

  it('security-headers.spec.ts checks Strict-Transport-Security header', () => {
    if (!fs.existsSync(specFile)) {
      expect.fail('File does not exist: security-headers.spec.ts');
    }
    const content = fs.readFileSync(specFile, 'utf8');
    expect(content).toContain('Strict-Transport-Security');
  });

  it('security-headers.spec.ts checks X-Content-Type-Options header', () => {
    if (!fs.existsSync(specFile)) {
      expect.fail('File does not exist: security-headers.spec.ts');
    }
    const content = fs.readFileSync(specFile, 'utf8');
    expect(content).toContain('X-Content-Type-Options');
  });

  it('security-headers.spec.ts has production skip guard', () => {
    if (!fs.existsSync(specFile)) {
      expect.fail('File does not exist: security-headers.spec.ts');
    }
    const content = fs.readFileSync(specFile, 'utf8');
    expect(content).toContain('test.skip');
  });
});

describe('Observatory scan documentation structure', () => {
  const obsFile = path.join(securityDir, 'observatory-screenshot.md');

  it('observatory-screenshot.md contains Mozilla Observatory reference', () => {
    if (!fs.existsSync(obsFile)) {
      expect.fail('File does not exist: observatory-screenshot.md');
    }
    const content = fs.readFileSync(obsFile, 'utf8');
    expect(content).toContain('observatory.mozilla.org');
  });

  it('observatory-screenshot.md contains required grade instruction', () => {
    if (!fs.existsSync(obsFile)) {
      expect.fail('File does not exist: observatory-screenshot.md');
    }
    const content = fs.readFileSync(obsFile, 'utf8');
    expect(content).toContain('grade');
  });
});
