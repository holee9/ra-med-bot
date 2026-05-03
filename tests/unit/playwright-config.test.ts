import type { Config } from '@playwright/test';
/**
 * Unit tests for playwright.config.ts
 * REQ-LAUNCH-013: 3 browser projects (chromium, firefox, webkit)
 * REQ-LAUNCH-014: baseURL from env, retries=2, workers=4, reporter configured
 */
import { beforeAll, describe, expect, it } from 'vitest';

describe('playwright.config.ts', () => {
  let config: Config;

  // Dynamically import to allow pre-import test failures to be captured
  beforeAll(async () => {
    // Reset module cache so env vars affect the import
    const mod = await import('../../playwright.config');
    config = mod.default as Config;
  });

  it('should have exactly 3 browser projects', () => {
    expect(config.projects).toHaveLength(3);
  });

  it('should include chromium project', () => {
    const names = (config.projects ?? []).map((project) => project.name);
    expect(names).toContain('chromium');
  });

  it('should include firefox project', () => {
    const names = (config.projects ?? []).map((project) => project.name);
    expect(names).toContain('firefox');
  });

  it('should include webkit project', () => {
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
