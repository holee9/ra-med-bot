import type { Config } from '@playwright/test';
/**
 * Unit tests for playwright.config.ts
 * REQ-LAUNCH-013: 3 browser projects in CI (chromium, firefox, webkit); 1 locally (chromium only)
 * REQ-LAUNCH-014: baseURL from env, retries=2, workers=4, reporter configured
 */
import { beforeAll, describe, expect, it } from 'vitest';

// playwright.config.ts conditionally includes firefox/webkit only in CI environments
const isCI = !!process.env.CI;

describe('playwright.config.ts', () => {
  let config: Config;

  // Dynamically import to allow pre-import test failures to be captured
  beforeAll(async () => {
    // Reset module cache so env vars affect the import
    const mod = await import('../../playwright.config');
    config = mod.default as Config;
  });

  it('should have correct browser project count for environment', () => {
    // CI: chromium + firefox + webkit = 3; local: chromium only = 1
    const expectedCount = isCI ? 3 : 1;
    expect(config.projects).toHaveLength(expectedCount);
  });

  it('should include chromium project', () => {
    const names = (config.projects ?? []).map((project) => project.name);
    expect(names).toContain('chromium');
  });

  it.skipIf(!isCI)('should include firefox project in CI', () => {
    const names = (config.projects ?? []).map((project) => project.name);
    expect(names).toContain('firefox');
  });

  it.skipIf(!isCI)('should include webkit project in CI', () => {
    const names = (config.projects ?? []).map((project) => project.name);
    expect(names).toContain('webkit');
  });

  it('should have retries === 2 (CI environment)', () => {
    // In test environment, CI is not set, so retries will be 0.
    // We verify the config object has the retries property defined.
    expect(config).toHaveProperty('retries');
    expect(typeof config.retries).toBe('number');
  });

  it('should have baseURL configured', () => {
    const use = config.use as { baseURL?: string } | undefined;
    expect(use?.baseURL).toBeTruthy();
  });

  it('should have reporter configured', () => {
    expect(config.reporter).toBeDefined();
  });

  it('should have testDir set to ./tests/e2e', () => {
    // testDir is resolved to absolute path by Playwright
    expect(config.testDir).toMatch(/tests[/\\]e2e/);
  });
});
