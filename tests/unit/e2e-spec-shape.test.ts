// @MX:NOTE: [AUTO] Meta-test: validates E2E spec file structure for SPEC-REGULA-LAUNCH-001
// @MX:SPEC: REQ-LAUNCH-015..021

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const e2eDir = path.join(root, 'tests', 'e2e');
const fixturesDir = path.join(e2eDir, 'fixtures');

const SPEC_FILES = [
  'auth.spec.ts',
  'consultation.spec.ts',
  'expert-review.spec.ts',
  'project-switch.spec.ts',
  'citation-click.spec.ts',
  'i18n.spec.ts',
  'a11y.spec.ts',
] as const;

const FIXTURE_FILES = ['msw-sse.ts', 'auth.ts'] as const;

describe('E2E spec files existence (TASK-007 + TASK-008)', () => {
  for (const file of SPEC_FILES) {
    it(`${file} exists under tests/e2e/`, () => {
      expect(fs.existsSync(path.join(e2eDir, file))).toBe(true);
    });
  }

  for (const file of FIXTURE_FILES) {
    it(`fixtures/${file} exists under tests/e2e/fixtures/`, () => {
      expect(fs.existsSync(path.join(fixturesDir, file))).toBe(true);
    });
  }
});

describe('E2E spec files structure', () => {
  for (const file of SPEC_FILES) {
    it(`${file} imports from @playwright/test`, () => {
      const filePath = path.join(e2eDir, file);
      if (!fs.existsSync(filePath)) {
        expect.fail(`File does not exist: ${file}`);
      }
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('@playwright/test');
    });

    it(`${file} contains test.describe`, () => {
      const filePath = path.join(e2eDir, file);
      if (!fs.existsSync(filePath)) {
        expect.fail(`File does not exist: ${file}`);
      }
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toMatch(/test\.describe\s*\(/);
    });
  }

  it('a11y.spec.ts imports @axe-core/playwright', () => {
    const filePath = path.join(e2eDir, 'a11y.spec.ts');
    if (!fs.existsSync(filePath)) {
      expect.fail('File does not exist: a11y.spec.ts');
    }
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('@axe-core/playwright');
  });

  it('a11y.spec.ts covers all 6 required routes', () => {
    const filePath = path.join(e2eDir, 'a11y.spec.ts');
    if (!fs.existsSync(filePath)) {
      expect.fail('File does not exist: a11y.spec.ts');
    }
    const content = fs.readFileSync(filePath, 'utf8');
    // Routes appear as string literals in the source; match with or without surrounding quotes.
    const requiredRoutes = [
      '/',
      '/chat',
      '/projects',
      '/expert-review',
      '/settings',
      '/compliance',
    ];
    for (const route of requiredRoutes) {
      expect(content, `Missing route: ${route}`).toContain(route);
    }
  });

  it('consultation.spec.ts references REQ-LAUNCH-016', () => {
    const filePath = path.join(e2eDir, 'consultation.spec.ts');
    if (!fs.existsSync(filePath)) {
      expect.fail('File does not exist: consultation.spec.ts');
    }
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('REQ-LAUNCH-016');
  });
});

describe('E2E fixture files structure', () => {
  it('fixtures/auth.ts exports a test fixture', () => {
    const filePath = path.join(fixturesDir, 'auth.ts');
    if (!fs.existsSync(filePath)) {
      expect.fail('File does not exist: fixtures/auth.ts');
    }
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('@playwright/test');
    expect(content).toContain('export');
  });

  it('fixtures/msw-sse.ts exports a test fixture', () => {
    const filePath = path.join(fixturesDir, 'msw-sse.ts');
    if (!fs.existsSync(filePath)) {
      expect.fail('File does not exist: fixtures/msw-sse.ts');
    }
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('@playwright/test');
    expect(content).toContain('export');
  });
});
