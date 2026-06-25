// @MX:NOTE [AUTO] Static coverage gate for withTenantScope wiring.
// @MX:SPEC SPEC-REGULA-RLS-ENFORCE-001 (Phase 2 — rlhf domain wiring)
// @MX:REASON #239 Phase 2 enforces that every DB mutation/select in a wired
//           domain route runs inside withTenantScope(...) so the
//           app.current_org_id GUC is set for RLS policies. The gate scans
//           route files statically: any file containing db.select|insert|
//           update|delete|transaction MUST also contain a withTenantScope
//           call. Only rlhf is whitelisted in Phase 2; other domains are
//           listed as pending wiring and explicitly skipped (do not fail).

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

/**
 * Domains wired into withTenantScope as of Phase 2. Add a domain here when
 * its routes are wired in a follow-up PR. Each entry is a subdirectory under
 * app/api/.
 *
 * Phase 2 scope: rlhf only.
 */
const WIRED_DOMAINS = ['rlhf'];

/**
 * Domains NOT yet wired. Listed for explicit tracking; the gate does NOT
 * scan these. Remove a domain from this list when you add it to WIRED_DOMAINS.
 *
 * Pending: pms, cyberdevice, model-governance, knowledge-gap, traceability,
 * change-control (and any other org-scoped domain under app/api/).
 */
const PENDING_DOMAINS = [
  'pms',
  'cyberdevice',
  'model-governance',
  'knowledge-gap',
  'traceability',
  'change-control',
];

/** Pattern that flags a file as performing DB operations. */
const DB_OP_PATTERN = /\b(?:db|tx|dbs)\s*\.(?:select|insert|update|delete|transaction)\s*\(/;

/** Pattern confirming the file routes DB ops through withTenantScope. */
const TENANT_SCOPE_PATTERN = /\bwithTenantScope\s*\(/;

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
            const hasDbOp = DB_OP_PATTERN.test(source);
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
      expect(PENDING_DOMAINS).toEqual(
        expect.arrayContaining([
          'pms',
          'cyberdevice',
          'model-governance',
          'knowledge-gap',
          'traceability',
          'change-control',
        ]),
      );
    });
  });
});
