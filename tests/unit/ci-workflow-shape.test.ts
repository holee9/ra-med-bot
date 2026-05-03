import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// REQ-LAUNCH-012: eval job triggered on PR
// REQ-LAUNCH-022: e2e job with browser matrix (chromium, firefox, webkit)
describe('CI workflow shape (REQ-LAUNCH-012, REQ-LAUNCH-022)', () => {
  const content = readFileSync('.github/workflows/ci.yml', 'utf-8');

  it('ci.yml has eval job', () => {
    expect(content).toContain('eval:');
  });

  it('eval job uses ANTHROPIC_API_KEY_EVAL secret', () => {
    expect(content).toContain('ANTHROPIC_API_KEY_EVAL');
  });

  it('ci.yml has e2e job', () => {
    expect(content).toContain('e2e:');
  });

  it('e2e job has browser matrix with chromium, firefox, webkit', () => {
    expect(content).toContain('chromium');
    expect(content).toContain('firefox');
    expect(content).toContain('webkit');
  });

  it('webkit uses continue-on-error for flaky tolerance', () => {
    expect(content).toContain('continue-on-error');
  });
});
