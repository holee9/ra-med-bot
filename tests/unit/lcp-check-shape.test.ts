import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../..');
const LCP_SCRIPT_PATH = resolve(ROOT, 'tests/load/lcp-check.js');

describe('lcp-check.js shape', () => {
  it('file exists', () => {
    expect(existsSync(LCP_SCRIPT_PATH)).toBe(true);
  });

  it('imports k6/experimental/browser chromium', () => {
    const content = readFileSync(LCP_SCRIPT_PATH, 'utf-8');
    expect(content).toContain("from 'k6/experimental/browser'");
    expect(content).toContain('chromium');
  });

  it('exports options with lcp_check scenario', () => {
    const content = readFileSync(LCP_SCRIPT_PATH, 'utf-8');
    expect(content).toContain('lcp_check');
    expect(content).toContain('shared-iterations');
  });

  it('has LCP threshold browser_web_vital_lcp under 2500ms', () => {
    const content = readFileSync(LCP_SCRIPT_PATH, 'utf-8');
    expect(content).toContain('browser_web_vital_lcp');
    expect(content).toContain('2500');
  });

  it('has FID threshold browser_web_vital_fid under 100ms', () => {
    const content = readFileSync(LCP_SCRIPT_PATH, 'utf-8');
    expect(content).toContain('browser_web_vital_fid');
    expect(content).toContain('100');
  });

  it('has CLS threshold browser_web_vital_cls under 0.1', () => {
    const content = readFileSync(LCP_SCRIPT_PATH, 'utf-8');
    expect(content).toContain('browser_web_vital_cls');
    expect(content).toContain('0.1');
  });

  it('uses PerformanceObserver for LCP measurement', () => {
    const content = readFileSync(LCP_SCRIPT_PATH, 'utf-8');
    expect(content).toContain('PerformanceObserver');
    expect(content).toContain('largest-contentful-paint');
  });

  it('exports default async function', () => {
    const content = readFileSync(LCP_SCRIPT_PATH, 'utf-8');
    expect(content).toContain('export default async function');
  });

  it('reads BASE_URL from environment', () => {
    const content = readFileSync(LCP_SCRIPT_PATH, 'utf-8');
    expect(content).toContain('BASE_URL');
    expect(content).toContain('__ENV');
  });

  it('has try/finally block to close browser resources', () => {
    const content = readFileSync(LCP_SCRIPT_PATH, 'utf-8');
    expect(content).toContain('try {');
    expect(content).toContain('} finally {');
    expect(content).toContain('browser.close()');
  });

  it('checks LCP is acceptable', () => {
    const content = readFileSync(LCP_SCRIPT_PATH, 'utf-8');
    expect(content).toContain('LCP is acceptable');
  });
});
