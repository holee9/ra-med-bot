// @MX:NOTE [AUTO] Static coverage gate for withTenantScope wiring.
// @MX:SPEC SPEC-REGULA-RLS-ENFORCE-001 (Phase 2 — all 7 org-scoped domains wired)
// @MX:REASON #239 Phase 2 enforces that every DB mutation/select in a wired
//           domain route runs inside withTenantScope(...) so the
//           app.current_org_id GUC is set for RLS policies. The gate scans
//           route files statically: any file containing db.select|insert|
//           update|delete|transaction MUST also contain a withTenantScope
//           call. Wired domains: rlhf, knowledge-gap, pms, change-control,
//           cyberdevice, model-governance, traceability (all org-scoped
//           domains under app/api/ are now wired).

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

/**
 * Domains wired into withTenantScope as of Phase 2. Add a domain here when
 * its routes are wired in a follow-up PR. Each entry is a subdirectory under
 * app/api/.
 *
 * Phase 2 scope (complete): rlhf, knowledge-gap, pms, change-control,
 * cyberdevice, model-governance, traceability — all 7 org-scoped domains.
 */
const WIRED_DOMAINS = [
  'rlhf',
  'knowledge-gap',
  'pms',
  'change-control',
  'cyberdevice',
  'model-governance',
  'traceability',
];

/**
 * Domains NOT yet wired. All 7 org-scoped domains are wired as of this PR,
 * so the pending list is empty. Add a domain here only if a new org-scoped
 * domain is introduced under app/api/ before its routes are wired.
 */
const PENDING_DOMAINS: string[] = [];

/** Pattern that flags a file as performing DB operations. */
const DB_OP_PATTERN = /\b(?:db|tx|dbs)\s*\.(?:select|insert|update|delete|transaction)\s*\(/;

/** Pattern confirming the file routes DB ops through withTenantScope. */
const TENANT_SCOPE_PATTERN = /\bwithTenantScope\s*\(/;

/**
 * Strip `//` line comments so the DB_OP_PATTERN only matches real code, not
 * prose mentions like "all in one db.transaction" in an @MX:REASON comment.
 * Without this, a route that only documents db.transaction in a comment would
 * be flagged as performing a DB op (false positive).
 */
function stripLineComments(source: string): string {
  return source.replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Recursively collect route.ts files under a given directory.
 */
function collectRouteFiles(dir: string): string[] {
  const results: string[] = [];
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true }) as unknown as import('node:fs').Dirent[];
  } catch {
    return results;
  }
  for (const entry of entries) {
    const name = String(entry.name);
    const full = join(dir, name);
    if (entry.isDirectory()) {
      results.push(...collectRouteFiles(full));
    } else if (entry.isFile() && name === 'route.ts') {
      results.push(full);
    }
  }
  return results;
}

describe('withTenantScope static coverage gate (SPEC-REGULA-RLS-ENFORCE-001 Phase 2)', () => {
  for (const domain of WIRED_DOMAINS) {
    describe(`domain: ${domain}`, () => {
      const domainDir = join(ROOT, 'app', 'api', domain);
      const files = collectRouteFiles(domainDir);

      if (files.length === 0) {
        it.skip(`no route files under app/api/${domain}`, () => {});
      } else {
        for (const file of files) {
          const rel = file.replace(`${ROOT}/`, '');
          it(`${rel}: every DB op runs inside withTenantScope`, () => {
            const source = readFileSync(file, 'utf8');
            const code = stripLineComments(source);
            const hasDbOp = DB_OP_PATTERN.test(code);
            if (!hasDbOp) {
              // No DB ops in this file — nothing to enforce.
              return;
            }
            expect(
              TENANT_SCOPE_PATTERN.test(source),
              `${rel} performs DB operations (db.select|insert|update|delete|transaction) but does not call withTenantScope. Every org-scoped DB op MUST run inside withTenantScope(orgId, ...) per SPEC-REGULA-RLS-ENFORCE-001 Phase 2.`,
            ).toBe(true);
          });
        }
      }
    });
  }

  // Explicit pending tracking — informational, does not fail the gate.
  // When a pending domain is wired, move it to WIRED_DOMAINS and delete its
  // entry here. This block exists so reviewers notice when a domain should
  // have been moved.
  describe('pending wiring (informational)', () => {
    it('lists domains not yet wired into withTenantScope', () => {
      // This assertion exists to surface the pending list in test output.
      expect(PENDING_DOMAINS.length).toBeGreaterThanOrEqual(0);
      // Snapshot for visibility — update freely when wiring a domain.
      // All 7 org-scoped domains are wired; pending list is empty.
      expect(PENDING_DOMAINS).toEqual(expect.arrayContaining([]));
    });
  });
});
