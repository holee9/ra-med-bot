/**
 * module-boundaries.test.ts — REQ-ENTERPRISE-053
 *
 * Verifies that observability modules do NOT import from the audit system.
 * Observability (engineering metrics) must remain separate from audit logs
 * (21 CFR Part 11 compliance).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const OBS_DIR = path.join(process.cwd(), 'lib', 'observability');
const FORBIDDEN_PATTERNS = ['writeAudit', 'lib/audit'];

function checkFile(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  return FORBIDDEN_PATTERNS.filter((pattern) => content.includes(pattern));
}

describe('module boundaries (REQ-ENTERPRISE-053)', () => {
  it('observability dir should exist', () => {
    expect(fs.existsSync(OBS_DIR)).toBe(true);
  });

  it('no observability file should import writeAudit or lib/audit', () => {
    if (!fs.existsSync(OBS_DIR)) return;
    const files = fs
      .readdirSync(OBS_DIR)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
      .map((f) => path.join(OBS_DIR, f));

    const violations: string[] = [];
    for (const file of files) {
      const found = checkFile(file);
      if (found.length > 0) {
        violations.push(`${path.basename(file)}: imports [${found.join(', ')}]`);
      }
    }

    expect(violations).toHaveLength(0);
  });

  it('sentry.ts should not import from audit', () => {
    const filePath = path.join(OBS_DIR, 'sentry.ts');
    if (!fs.existsSync(filePath)) return;
    expect(checkFile(filePath)).toHaveLength(0);
  });

  it('posthog.ts should not import from audit', () => {
    const filePath = path.join(OBS_DIR, 'posthog.ts');
    if (!fs.existsSync(filePath)) return;
    expect(checkFile(filePath)).toHaveLength(0);
  });

  it('langfuse.ts should not import from audit', () => {
    const filePath = path.join(OBS_DIR, 'langfuse.ts');
    if (!fs.existsSync(filePath)) return;
    expect(checkFile(filePath)).toHaveLength(0);
  });
});
