/**
 * module-boundaries.ts — REQ-ENTERPRISE-053
 *
 * Checks that observability modules do NOT import from the audit system.
 * Observability (engineering metrics) must remain separate from audit logs
 * (21 CFR Part 11 compliance).
 *
 * Also checks for cross-domain dependencies within lib/domains/.
 * Domains should not directly import from other domains (ARCH-003).
 *
 * Exit 0 if no violations; exit 1 if any violations found.
 *
 * Usage: pnpm ci:module-boundaries
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { logger } from '../../lib/observability/logger.ts';

const OBS_DIR = path.join(process.cwd(), 'lib', 'observability');
const FORBIDDEN_PATTERNS = ['writeAudit', 'lib/audit'];

const DOMAINS_DIR = path.join(process.cwd(), 'lib', 'domains');

/**
 * Intentional cross-domain dependencies (SPEC-approved reuse/wrapper).
 * @MX:NOTE: These are direct cross-domain imports but are intentional architecture
 * documented in SPEC. Add new entries ONLY with SPEC reference + justification.
 */
const ALLOWED_CROSS_DOMAIN: Record<string, readonly string[]> = {
  // SPEC-V3-CONSULT-001: run-consult.ts reuses runTriage (RAG pipeline wrapper + H-3 citation)
  consult: ['triage'],
};

function checkFile(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  return FORBIDDEN_PATTERNS.filter((pattern) => content.includes(pattern));
}

/**
 * Check for cross-domain dependencies in lib/domains/.
 * Detects direct imports from one domain to another (e.g., domains/auth importing domains/inbox).
 */
function checkCrossDomainDependencies(): string[] {
  const violations: string[] = [];

  if (!fs.existsSync(DOMAINS_DIR)) {
    return violations;
  }

  const domains = fs.readdirSync(DOMAINS_DIR).filter((f) => {
    const fullPath = path.join(DOMAINS_DIR, f);
    return fs.statSync(fullPath).isDirectory();
  });

  for (const domain of domains) {
    const domainPath = path.join(DOMAINS_DIR, domain);
    const files = fs
      .readdirSync(domainPath)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
      .map((f) => path.join(domainPath, f));

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');

      // Check for imports from other domains
      // Pattern: import ... from '@/lib/domains/{other_domain}'
      const allowed = ALLOWED_CROSS_DOMAIN[domain] ?? [];
      for (const otherDomain of domains) {
        if (otherDomain === domain) continue; // Skip self
        if (allowed.includes(otherDomain)) continue; // SPEC-approved reuse

        // Check both quoted and unquoted import patterns
        const patterns = [
          new RegExp(`from\\s+['"]@/lib/domains/${otherDomain}`, 'g'),
          new RegExp(`from\\s+['"]\\.\\.*/\\.\\.*/domains/${otherDomain}`, 'g'),
        ];

        for (const pattern of patterns) {
          if (pattern.test(content)) {
            const relative = path.relative(process.cwd(), file);
            violations.push(`${relative}: imports from domain ${otherDomain}`);
          }
        }
      }
    }
  }

  return violations;
}

function main(): void {
  const allViolations: string[] = [];

  // Original check: observability → audit
  if (fs.existsSync(OBS_DIR)) {
    const files = fs
      .readdirSync(OBS_DIR)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
      .map((f) => path.join(OBS_DIR, f));

    for (const file of files) {
      const found = checkFile(file);
      if (found.length > 0) {
        allViolations.push(`${path.basename(file)}: imports [${found.join(', ')}]`);
      }
    }
  }

  // New check: cross-domain dependencies
  const crossDomainViolations = checkCrossDomainDependencies();
  allViolations.push(...crossDomainViolations);

  if (allViolations.length > 0) {
    logger.error('Module boundaries check: VIOLATIONS FOUND:');
    for (const v of allViolations) {
      logger.error(`  - ${v}`);
    }
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
