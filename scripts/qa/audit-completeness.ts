// @MX:NOTE [AUTO] Audit completeness static analysis script.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-032, REQ-ENTERPRISE-033)
//
// Scans app/api/**/route.ts files for state-mutating HTTP handlers
// (POST, PATCH, PUT, DELETE) and verifies each calls writeAudit().
// Also scans lib/ files containing audit wrappers for PII leaks.
// Also scans writeAudit() meta_json arguments for PII key patterns.
//
// Override: add `/* audit-check-ignore: <justification> */` on the same
// line or the line immediately preceding the export to skip the handler.
//
// Exit code 1 if any violations are found.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// HTTP methods that mutate state — GET/HEAD/OPTIONS are read-only and exempt.
const MUTABLE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Maximum allowed string literal length inside writeAudit meta arguments.
const MAX_META_STRING_LENGTH = 500;

const DIRECT_AUDIT_CALL_PATTERN = /writeAudit\s*\(/;

const APPROVED_AUDIT_WRAPPER_NAMES = [
  'auditAssessmentCreated',
  'auditCerCreated',
  'auditCerExported',
  'auditCerLiteratureSearch',
  'auditCerStageCompleted',
  'auditPccpAlgorithmChangeTriggered',
  'auditPccpComponentCompleted',
  'auditPccpCreated',
  'auditPccpExpertApproved',
  'auditPccpStatusChanged',
  'auditReportDrafted',
  'auditReportabilityAssessed',
  'auditVigilanceEventCreated',
  'analyzeImpact',
];

const APPROVED_AUDIT_WRAPPER_PATTERN = new RegExp(
  `(?:${APPROVED_AUDIT_WRAPPER_NAMES.join('|')})\\s*\\(`,
);

function hasAuditCall(content: string): boolean {
  return DIRECT_AUDIT_CALL_PATTERN.test(content) || APPROVED_AUDIT_WRAPPER_PATTERN.test(content);
}

/**
 * Check a single file's content for missing writeAudit calls in mutable handlers.
 *
 * @param content - Source text of the file
 * @param filePath - File path for violation messages
 * @returns Array of violation strings (empty = compliant)
 */
export function checkFileForAuditCoverage(content: string, filePath: string): string[] {
  const violations: string[] = [];

  // If the file has a blanket ignore comment, skip entirely.
  if (/\/\*\s*audit-check-ignore[^*]*\*\//.test(content)) {
    return violations;
  }

  for (const method of MUTABLE_METHODS) {
    // Pattern 1: export async function METHOD(
    const funcPattern = new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`, 'g');
    // Pattern 2: export const METHOD = withPermission(
    const constPattern = new RegExp(
      `export\\s+const\\s+${method}\\s*=\\s*withPermission\\s*\\(`,
      'g',
    );

    const hasFuncExport = funcPattern.test(content);
    const hasConstExport = constPattern.test(content);

    if (!hasFuncExport && !hasConstExport) {
      // This method is not exported from the file — nothing to check.
      continue;
    }

    // Check whether writeAudit( or an approved audit wrapper appears anywhere in the file body.
    if (!hasAuditCall(content)) {
      violations.push(`${filePath}: ${method} handler missing writeAudit() call`);
    }
  }

  return violations;
}

/**
 * Check a single file's content for PII leaks in writeAudit meta_json arguments.
 *
 * @param content - Source text of the file
 * @param filePath - File path for violation messages
 * @returns Array of PII violation strings (empty = compliant)
 */
export function checkFileForPiiLeaks(content: string, filePath: string): string[] {
  const violations: string[] = [];

  // Find all writeAudit( call sites.
  const writeAuditCallRegex = /writeAudit\s*\(\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;

  // Use matchAll to avoid assignment-in-expression lint rule.
  for (const match of content.matchAll(writeAuditCallRegex)) {
    const callBody = match[1] ?? '';

    // Check for PII key names (e.g. question:, "email":, 'phone':).
    const keyPattern = /['"]\s*(question|answer|email|phone|ssn|dob)\s*['"]\s*:/gi;
    const bareKeyPattern = /\b(question|answer|email|phone|ssn|dob)\s*:/gi;

    for (const keyMatch of callBody.matchAll(keyPattern)) {
      const key = keyMatch[1];
      if (key) {
        violations.push(
          `${filePath}: writeAudit meta_json contains PII key '${key.toLowerCase()}'`,
        );
      }
    }
    for (const keyMatch of callBody.matchAll(bareKeyPattern)) {
      const key = keyMatch[1];
      if (key) {
        violations.push(
          `${filePath}: writeAudit meta_json contains PII key '${key.toLowerCase()}'`,
        );
      }
    }

    // Check for string literals longer than MAX_META_STRING_LENGTH.
    const stringLiteralRegex = /['"]([^'"]{501,})['"]/g;
    for (const _strMatch of callBody.matchAll(stringLiteralRegex)) {
      violations.push(
        `${filePath}: writeAudit meta_json contains string value longer than ${MAX_META_STRING_LENGTH} chars`,
      );
    }
  }

  return violations;
}

/**
 * Recursively collect all route.ts files under a directory.
 */
function collectRouteFiles(dir: string, results: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectRouteFiles(full, results);
    } else if (entry.isFile() && entry.name === 'route.ts') {
      results.push(full);
    }
  }
  return results;
}

/**
 * Recursively collect all TypeScript files under lib/ that contain audit wrapper calls.
 * This ensures lib/ domain audit wrappers are also checked for coverage.
 */
function collectLibAuditFiles(dir: string, results: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectLibAuditFiles(full, results);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      // Only include files that actually use audit wrappers
      const content = fs.readFileSync(full, 'utf-8');
      if (hasAuditCall(content)) {
        results.push(full);
      }
    }
  }
  return results;
}

/**
 * Run the full audit completeness check across all route files in apiDir.
 *
 * @param apiDir - Root directory to scan (default: app/api)
 * @returns Object containing coverage violations and PII violations
 */
export async function runAuditCheck(
  apiDir: string,
  libDir: string,
): Promise<{ violations: string[]; piiViolations: string[] }> {
  const violations: string[] = [];
  const piiViolations: string[] = [];

  // Check route files (existing behavior - MUTABLE_METHODS only)
  const routeFiles = collectRouteFiles(apiDir);

  for (const filePath of routeFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relative = path.relative(process.cwd(), filePath);

    const coverageViolations = checkFileForAuditCoverage(content, relative);
    violations.push(...coverageViolations);

    const pii = checkFileForPiiLeaks(content, relative);
    piiViolations.push(...pii);
  }

  // Check lib/ files with audit wrappers (PII only - no MUTABLE_METHODS check)
  const libFiles = collectLibAuditFiles(libDir);

  for (const filePath of libFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relative = path.relative(process.cwd(), filePath);

    // Only PII check for lib files (they already call audit wrappers)
    const pii = checkFileForPiiLeaks(content, relative);
    piiViolations.push(...pii);
  }

  return { violations, piiViolations };
}

// ---------------------------------------------------------------------------
// CLI entry point — executed when run directly via ts-node / tsx
// ---------------------------------------------------------------------------
const isDirectRun =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const apiDir = path.resolve(process.cwd(), 'app', 'api');
  const libDir = path.resolve(process.cwd(), 'lib');
  runAuditCheck(apiDir, libDir).then(({ violations, piiViolations }) => {
    const allViolations = [...violations, ...piiViolations];

    if (violations.length > 0) {
      process.stderr.write('\nAudit coverage violations:\n');
      for (const v of violations) {
        process.stderr.write(`  ✗ ${v}\n`);
      }
    }
    if (piiViolations.length > 0) {
      process.stderr.write('\nPII leak violations:\n');
      for (const v of piiViolations) {
        process.stderr.write(`  ✗ ${v}\n`);
      }
    }
    if (allViolations.length > 0) {
      process.exit(1);
    } else {
      process.stdout.write('Audit completeness check: PASS\n');
    }
  });
}
