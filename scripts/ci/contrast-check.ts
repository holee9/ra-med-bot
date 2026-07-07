/**
 * contrast-check.ts — REQ-ENTERPRISE-048 (thin routing wrapper).
 *
 * Implementation lives in lib/qa/contrast-check.ts (#368 thin split,
 * SPEC-REGULA-CICD-001 coding-standards thin command pattern).
 *
 * Exit 0: all pairs pass or tokens not found (non-blocking).
 * Exit 1: a pair fails WCAG AA contrast.
 *
 * Usage: pnpm ci:contrast
 */

import * as path from 'node:path';
import { logger } from '../../lib/observability/logger.ts';
import { runContrastCheck } from '../../lib/qa/contrast-check.ts';

const TOKENS_FILE = path.join(process.cwd(), 'styles', 'tokens.css');

const result = runContrastCheck(TOKENS_FILE);

for (const w of result.warnings) logger.warn(w);
for (const f of result.failures) logger.error(f);

if (result.failures.length > 0) {
  process.exit(1);
}

process.exit(0);
