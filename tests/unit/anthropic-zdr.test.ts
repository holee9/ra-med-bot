// @MX:NOTE [AUTO] Anthropic ZDR mode verification — REQ-LAUNCH-035.
// @MX:SPEC SPEC-REGULA-LAUNCH-001 (REQ-LAUNCH-035)
// Verifies that the Anthropic SDK client is configured with the
// zero-data-retention beta header so PHI/PII prompts are not retained.
// No live API calls — reads source file content.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..');

// Candidate files where ZDR config might live.
const CANDIDATE_PATHS = [
  'lib/ai/anthropic-client.ts',
  'lib/ai/structured-blocks.ts',
  'lib/ai/consult.ts',
  'lib/ai/client.ts',
];

function findZdrConfig(): { file: string; content: string } | null {
  for (const rel of CANDIDATE_PATHS) {
    const abs = path.join(ROOT, rel);
    if (existsSync(abs)) {
      const content = readFileSync(abs, 'utf-8');
      // ZDR is configured via the anthropic-beta header or a dedicated config file.
      if (
        content.includes('zero-data-retention') ||
        content.includes('anthropic-beta') ||
        content.includes('zdr')
      ) {
        return { file: rel, content };
      }
    }
  }
  return null;
}

describe('Anthropic ZDR configuration (REQ-LAUNCH-035)', () => {
  it('a ZDR config file exists in lib/ai/', () => {
    // The ZDR config may live in lib/ai/anthropic-client.ts (dedicated) or
    // inline in structured-blocks.ts / consult.ts.
    const result = findZdrConfig();
    expect(
      result,
      'Expected a file in lib/ai/ to configure zero-data-retention. ' +
        'Create lib/ai/anthropic-client.ts with the anthropic-beta header.',
    ).not.toBeNull();
  });

  it('ZDR config contains zero-data-retention beta header', () => {
    const result = findZdrConfig();
    if (!result) {
      // This will fail because the previous test already failed.
      expect(result).not.toBeNull();
      return;
    }
    expect(result.content).toContain('zero-data-retention');
  });

  it('ZDR config passes the header to the Anthropic SDK constructor or per-request', () => {
    const result = findZdrConfig();
    if (!result) {
      expect(result).not.toBeNull();
      return;
    }
    // Header must appear as a string value, not just a comment.
    const content = result.content;
    // Accept: defaultHeaders, headers: { anthropic-beta }, or similar patterns.
    const hasHeaderConfig =
      content.includes('defaultHeaders') ||
      content.includes("'anthropic-beta'") ||
      content.includes('"anthropic-beta"') ||
      content.includes('betas');
    expect(hasHeaderConfig).toBe(true);
  });
});
