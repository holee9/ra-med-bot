// @MX:NOTE [AUTO] Real-DB RLS enforce canary — general (non-sources) FORCE table.
// @MX:SPEC SPEC-REGULA-RLS-ENFORCE-001 (Issue #239, BLOCK-3) / runbook §6
//
// Why this exists (L-013): the sources/source_sections canary (#317,
// tests/integration/rls-sources-real-db.test.ts) proves the regula_app RLS
// mechanism for ONE domain. This extends the guarantee to a second FORCE RLS
// table (knowledge_sources) so the runbook §6 cutover canary is exercised for
// the general org-isolation case — confirming FORCE RLS + app.current_org_id
// GUC + NOBYPASSRLS role enforces tenant isolation AND fail-closes outside
// withTenantScope, not just for sources.
//
// Connection discipline mirrors #317: ONE dedicated postgres-js client
// (max:1, prepare:false) so SET ROLE / set_config / query / RESET share a
// single connection (drizzle's pooled tx cannot guarantee SET ROLE lands on
// the same connection as the query).
//
// Skipped when DATABASE_URL is unset.

import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SKIP = !process.env.DATABASE_URL;

// Distinct seed IDs (avoid colliding with real rows / #317's orgs).
const ORG_A = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const ORG_B = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const USER_A = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

// biome-ignore lint/suspicious/noExplicitAny: suite-scoped client initialized in beforeAll
let client: any;

/** Run `fn` under regula_app (NOBYPASSRLS) with a given org GUC, then reset. */
async function asRegulaApp(orgId: string | null, fn: () => Promise<void>): Promise<void> {
  await client`SET ROLE regula_app`;
  // set_config(name, value, is_local=false) is session-scoped. NULL value →
  // current_setting(..., true) returns NULL → policy's ::uuid cast yields NULL
  // → every row filtered out (fail-closed). RESET leaves "" which raises on cast.
  const gucValue: string | null = orgId ?? null;
  await client`SELECT set_config('app.current_org_id', ${gucValue}, false)`;
  try {
    await fn();
  } finally {
    await client`RESET ROLE`;
    await client`SELECT set_config('app.current_org_id', ${null}, false)`;
  }
}

describe.skipIf(SKIP)(
  'RLS enforce canary — knowledge_sources (general FORCE table, #239 BLOCK-3)',
  () => {
    beforeAll(async () => {
      if (SKIP) return;
      client = postgres(process.env.DATABASE_URL as string, { max: 1, prepare: false });
      // Clean stale seed (superuser), then seed fresh.
      await client`DELETE FROM knowledge_sources WHERE git_url LIKE 'https://github.com/canary-%'`;
      await client`DELETE FROM users WHERE id = ${USER_A}`;
      await client`DELETE FROM organizations WHERE id IN (${ORG_A}, ${ORG_B})`;
      await client`
      INSERT INTO organizations (id, name) VALUES
        (${ORG_A}, 'RLS Enforce Canary Org A'),
        (${ORG_B}, 'RLS Enforce Canary Org B')
    `;
      await client`
      INSERT INTO users (id, email, name) VALUES
        (${USER_A}, 'rls-canary@example.test', 'RLS Canary User')
    `;
      await client`
      INSERT INTO knowledge_sources (organization_id, git_url, branch, created_by) VALUES
        (${ORG_A}, 'https://github.com/canary-org-a/repo', 'main', ${USER_A}),
        (${ORG_B}, 'https://github.com/canary-org-b/repo', 'main', ${USER_A})
    `;
    });

    afterAll(async () => {
      if (SKIP) return;
      // Leave no trace on the shared DB.
      await client`DELETE FROM knowledge_sources WHERE git_url LIKE 'https://github.com/canary-%'`;
      await client`DELETE FROM users WHERE id = ${USER_A}`;
      await client`DELETE FROM organizations WHERE id IN (${ORG_A}, ${ORG_B})`;
      await client.end();
    });

    it('returns only the caller org rows when GUC is set (positive isolation)', async () => {
      let rows: Array<{ git_url: string }> = [];
      await asRegulaApp(ORG_A, async () => {
        const res = await client`SELECT git_url FROM knowledge_sources`;
        rows = res as Array<{ git_url: string }>;
      });
      expect(rows.length).toBe(1);
      expect(rows[0]?.git_url).toBe('https://github.com/canary-org-a/repo');
    });

    it('returns 0 rows (fail-closed) when GUC is unset outside withTenantScope', async () => {
      let rows: unknown[] = [];
      await asRegulaApp(null, async () => {
        const res = await client`SELECT git_url FROM knowledge_sources`;
        rows = res as unknown[];
      });
      expect(rows.length).toBe(0);
    });
  },
);
