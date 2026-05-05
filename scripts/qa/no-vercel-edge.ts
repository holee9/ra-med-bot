#!/usr/bin/env node
// @MX:NOTE [AUTO] Static analysis — detects @vercel/edge or @vercel/og imports in Workers code.
// @MX:SPEC SPEC-REGULA-CLOUDFLARE-001 (REQ-CF-009)
//
// Exit code 0 = clean, Exit code 1 = violations found.
// Run: pnpm tsx scripts/qa/no-vercel-edge.ts

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from '../../lib/observability/logger.ts';

const _FORBIDDEN_IMPORTS = ['@vercel/edge', '@vercel/og'];

const SCAN_TARGETS = [join(process.cwd(), 'app'), join(process.cwd(), 'middleware-edge.ts')];

const IMPORT_PATTERN = /(?:import|from|require)\s*\(?['"](@vercel\/(?:edge|og))['"]/g;

function scanFile(filePath: string): string[] {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const violations: string[] = [];
    let match: RegExpExecArray | null;

    IMPORT_PATTERN.lastIndex = 0;
    // biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop
    while ((match = IMPORT_PATTERN.exec(content)) !== null) {
      violations.push(`${filePath}: imports '${match[1]}'`);
    }

    return violations;
  } catch {
    return [];
  }
}

function scanDirectory(dir: string): string[] {
  const violations: string[] = [];

  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip node_modules and .next
        if (entry === 'node_modules' || entry === '.next' || entry === '.git') {
          continue;
        }
        violations.push(...scanDirectory(fullPath));
      } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) {
        violations.push(...scanFile(fullPath));
      }
    }
  } catch {
    // Directory doesn't exist — skip
  }

  return violations;
}

function main(): void {
  const allViolations: string[] = [];

  for (const target of SCAN_TARGETS) {
    try {
      const stat = statSync(target);
      if (stat.isDirectory()) {
        allViolations.push(...scanDirectory(target));
      } else {
        allViolations.push(...scanFile(target));
      }
    } catch {
      // Target doesn't exist yet — skip
    }
  }

  if (allViolations.length > 0) {
    logger.error(
      'ERROR: @vercel/edge or @vercel/og imports detected in Workers code (REQ-CF-009):',
    );
    for (const v of allViolations) {
      logger.error(`  ${v}`);
    }
    process.exit(1);
  }
  process.exit(0);
}

main();
