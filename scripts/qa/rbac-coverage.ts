#!/usr/bin/env tsx
// @MX:NOTE [AUTO] RBAC coverage CI script — validates every route.ts has withPermission wrapping.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-019)
//
// Usage: pnpm tsx scripts/qa/rbac-coverage.ts
// Exits 1 if any non-whitelisted handler lacks withPermission wrapping.
// Exits 0 if all handlers are covered.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { logger } from '../../lib/observability/logger';

// HTTP method exports that could appear in route.ts files.
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

// Pattern for plain (non-wrapped) async function exports.
// Matches: export async function GET|POST|...
const PLAIN_EXPORT_REGEX = new RegExp(
  `export\\s+async\\s+function\\s+(${HTTP_METHODS.join('|')})\\b`,
);

/**
 * Checks if a file path matches any of the exempt glob patterns.
 * Supports `**` suffix patterns (prefix match) and exact match.
 */
export function isExempt(filePath: string, patterns: string[]): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  for (const pattern of patterns) {
    if (pattern.endsWith('/**')) {
      const prefix = pattern.slice(0, -3);
      if (normalized.startsWith(`${prefix}/`) || normalized === prefix) {
        return true;
      }
    } else if (normalized === pattern) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true if the file content has no unprotected HTTP method exports.
 * A file is compliant when:
 *   - It has no HTTP method exports at all, OR
 *   - Every HTTP method export is wrapped with withPermission (no plain exports)
 */
export function isCompliant(content: string): boolean {
  return !PLAIN_EXPORT_REGEX.test(content);
}

/**
 * Extracts exempt_patterns array from a whitelist JSON object.
 */
export function parseExemptPatterns(whitelist: unknown): string[] {
  if (
    whitelist &&
    typeof whitelist === 'object' &&
    'exempt_patterns' in whitelist &&
    Array.isArray((whitelist as Record<string, unknown>).exempt_patterns)
  ) {
    return (whitelist as { exempt_patterns: string[] }).exempt_patterns;
  }
  return [];
}

/**
 * Recursively finds all route.ts files under a directory.
 * Returns paths relative to `rootDir`.
 */
export function findRouteFiles(dir: string, rootDir: string): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      results.push(...findRouteFiles(fullPath, rootDir));
    } else if (entry === 'route.ts') {
      results.push(path.relative(rootDir, fullPath).replace(/\\/g, '/'));
    }
  }
  return results;
}

// CLI entry point — only runs when this file is executed directly via tsx.
const isMainModule =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('rbac-coverage.ts') || process.argv[1].endsWith('rbac-coverage'));

if (isMainModule) {
  const projectRoot = path.resolve(process.cwd());
  const whitelistPath = path.join(projectRoot, 'scripts/qa/rbac-whitelist.json');

  let exemptPatterns: string[] = [];
  try {
    const raw = readFileSync(whitelistPath, 'utf-8');
    exemptPatterns = parseExemptPatterns(JSON.parse(raw));
  } catch {
    logger.warn('[rbac-coverage] Could not read whitelist, using defaults.');
    exemptPatterns = ['app/api/auth/**', 'app/api/health/**'];
  }

  const apiDir = path.join(projectRoot, 'app/api');
  const routeFiles = findRouteFiles(apiDir, projectRoot);
  const violations: string[] = [];

  for (const file of routeFiles) {
    if (isExempt(file, exemptPatterns)) {
      continue;
    }

    const content = readFileSync(path.join(projectRoot, file), 'utf-8');
    if (!isCompliant(content)) {
      violations.push(file);
    }
  }

  if (violations.length === 0) {
    process.exit(0);
  } else {
    logger.error('[rbac-coverage] RBAC violations found:');
    for (const v of violations) {
      logger.error(`  - ${v}`);
    }
    process.exit(1);
  }
}
