/**
 * module-boundaries.ts — REQ-ENTERPRISE-053
 *
 * Checks that observability modules do NOT import from the audit system.
 * Observability (engineering metrics) must remain separate from audit logs
 * (21 CFR Part 11 compliance).
 *
 * Exit 0 if no violations; exit 1 if any violations found.
 *
 * Usage: pnpm ci:module-boundaries
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { logger } from '../../lib/observability/logger';

const OBS_DIR = path.join(process.cwd(), 'lib', 'observability');
const FORBIDDEN_PATTERNS = ['writeAudit', 'lib/audit'];

function checkFile(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  return FORBIDDEN_PATTERNS.filter((pattern) => content.includes(pattern));
}

function main(): void {
  if (!fs.existsSync(OBS_DIR)) {
    process.exit(0);
  }

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

  const count = files.length;
  if (violations.length > 0) {
    logger.error(`Module boundaries check: ${count} files checked. VIOLATION:`);
    for (const v of violations) {
      logger.error(`  - ${v}`);
    }
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
