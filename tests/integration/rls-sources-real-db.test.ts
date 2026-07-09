// @MX:NOTE [AUTO] Real-DB RLS canary for sources/source_sections.
// @MX:SPEC SPEC-REGULA-RLS-SOURCES-001 (Issue #317)
//
// Why this exists (L-013): enterprise-migrations.test.ts parses migration SQL
// textually only — it cannot prove that `SET ROLE regula_app` + GUC actually
// enforces org isolation at runtime. This canary connects to a live PostgreSQL
// (DATABASE_URL) and verifies migration 0114's RLS policies behave correctly
// under a NOBYPASSRLS role.
//
// Connection discipline: SET ROLE is session-level and survives tx rollback,
// and drizzle's pooled db.transaction cannot guarantee SET ROLE lands on the
// same connection as the subsequent query. So we open ONE dedicated postgres-js
// client (max: 1, prepare: false) for the whole suite — every SET ROLE /
// set_config / query / RESET shares that single connection, eliminating pool
// contamination (the uuid:"" + "scope begin" errors seen with the pooled path).
//
// Skipped when DATABASE_URL is unset (mirrors migrations-real-db.test.ts).

import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SKIP = !process.env.DATABASE_URL;

// Unique seed orgs (distinct from any real row, e.g. ...0010).
const ORG_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ORG_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

// biome-ignore lint/suspicious/noExplicitAny: suite-scoped client initialized in beforeAll
let client: any;

/** Run `fn` under regula_app (NOBYPASSRLS) with a given org GUC, then reset. */
async function asRegulaApp(orgId: string | null, fn: () => Promise<void>): Promise<void> {
  await client`SET ROLE regula_app`;
  // set_config(name, value, is_local=false) is session-scoped. A NULL value
  // makes current_setting(..., true) return NULL (not ""), so the policy's
  // `...::uuid` cast yields NULL and every row is filtered out (fail-closed).
  // RESET would leave "" which raises on the ::uuid cast.
  const gucValue: string | null = orgId ?? null;
  await client`SELECT set_config('app.current_org_id', ${gucValue}, false)`;
  try {
    await fn();
  } finally {
    await client`RESET ROLE`;
    await client`SELECT set_config('app.current_org_id', ${null}, false)`;
  }
}

describe('RLS sources/source_sections — real-DB canary (SPEC-REGULA-RLS-SOURCES-001, #317)', () => {
  beforeAll(async () => {
    if (SKIP) return;
    client = postgres(process.env.DATABASE_URL as string, { max: 1, prepare: false });
    // Clean any stale seed from prior failed runs, then seed fresh (superuser).
    await client`DELETE FROM sources WHERE org_label IN ('canary-a', 'canary-b')`;
    await client`DELETE FROM organizations WHERE id IN (${ORG_A}, ${ORG_B})`;
    await client`
      INSERT INTO organizations (id, name) VALUES
        (${ORG_A}, 'RLS Canary Org A'),
        (${ORG_B}, 'RLS Canary Org B')
    `;
    await client`
      INSERT INTO sources (organization_id, org_label, title, type) VALUES
        (${ORG_A}, 'canary-a', 'Canary Source A', 'Internal'),
        (${ORG_B}, 'canary-b', 'Canary Source B', 'Internal')
    `;
    await client`
      INSERT INTO source_sections (source_id, anchor, heading, text)
      SELECT id, 'sec-1', 'Section 1', 'canary section text'
      FROM sources WHERE org_label IN ('canary-a', 'canary-b')
    `;
  });

  afterAll(async () => {
    if (SKIP) return;
    await client`DELETE FROM sources WHERE org_label IN ('canary-a', 'canary-b')`;
    await client`DELETE FROM organizations WHERE id IN (${ORG_A}, ${ORG_B})`;
    await client.end();
  });

  // ---- AC1: migration 0114 structure (ENABLE + FORCE + 2 policies) ----

  it.skipIf(SKIP)('sources: ENABLE + FORCE ROW LEVEL SECURITY (AC1)', async () => {
    const rows = await client`
      SELECT relrowsecurity AS enabled, relforcerowsecurity AS forced
      FROM pg_class WHERE relname = 'sources'
    `;
    expect(rows[0]?.enabled, 'sources must have RLS enabled').toBe(true);
    expect(rows[0]?.forced, 'sources must FORCE RLS').toBe(true);
  });

  it.skipIf(SKIP)('source_sections: ENABLE + FORCE ROW LEVEL SECURITY (AC1)', async () => {
    const rows = await client`
      SELECT relrowsecurity AS enabled, relforcerowsecurity AS forced
      FROM pg_class WHERE relname = 'source_sections'
    `;
    expect(rows[0]?.enabled, 'source_sections must have RLS enabled').toBe(true);
    expect(rows[0]?.forced, 'source_sections must FORCE RLS').toBe(true);
  });

  it.skipIf(SKIP)('sources/source_sections: org-isolation policies exist (AC2)', async () => {
    const rows = await client`
      SELECT tablename, policyname FROM pg_policies
      WHERE tablename IN ('sources', 'source_sections') ORDER BY tablename
    `;
    const names = rows.map(
      (r: { tablename: string; policyname: string }) => `${r.tablename}.${r.policyname}`,
    );
    expect(names, JSON.stringify(names)).toContain('sources.sources_org_isolated');
    expect(names).toContain('source_sections.source_sections_org_isolated');
  });

  // ---- AC3: canary under regula_app role ----

  it.skipIf(SKIP)(
    'regula_app + GUC set: own-org sources visible, other-org blocked (AC3)',
    async () => {
      await asRegulaApp(ORG_A, async () => {
        const rows = await client`
        SELECT organization_id AS org FROM sources WHERE org_label IN ('canary-a', 'canary-b')
      `;
        expect(
          rows.map((r: { org: string }) => r.org),
          JSON.stringify(rows),
        ).toEqual([ORG_A]);
      });
    },
  );

  it.skipIf(SKIP)('regula_app + GUC unset: fail-closed (0 rows) (AC3)', async () => {
    await asRegulaApp(null, async () => {
      const rows = await client`SELECT count(*)::int AS n FROM sources`;
      expect(Number(rows[0]?.n), 'no GUC ⇒ RLS must hide ALL rows (fail-closed)').toBe(0);
    });
  });

  it.skipIf(SKIP)('regula_app cross-org INSERT blocked by WITH CHECK (AC2)', async () => {
    await expect(
      asRegulaApp(ORG_A, async () => {
        await client`
          INSERT INTO sources (organization_id, org_label, title, type)
          VALUES (${ORG_B}, 'canary-sneak', 'Should Be Blocked', 'Internal')
        `;
      }),
    ).rejects.toThrow(/row-level security|violates/i);
  });

  it.skipIf(SKIP)(
    'source_sections EXISTS subquery: scoped to parent source org (REQ-RLS-SRC-003)',
    async () => {
      // Superuser sanity: confirm beforeAll seeded exactly one section per canary
      // source. CI runs all real-db suites sequentially on one DB — a prior suite
      // (e.g. rlhf) can leave source_sections rows or alter state. This pre-check
      // isolates "beforeAll seed leak" from "RLS scoping" before asserting under role.
      const seeded = await client`
        SELECT s.org_label AS lbl FROM source_sections ss
        JOIN sources s ON s.id = ss.source_id
        WHERE s.org_label IN ('canary-a', 'canary-b')
        ORDER BY s.org_label
      `;
      expect(
        seeded.map((r: { lbl: string }) => r.lbl),
        `superuser seed sanity: ${JSON.stringify(seeded)}`,
      ).toEqual(['canary-a', 'canary-b']);

      await asRegulaApp(ORG_A, async () => {
        const rows = await client`
        SELECT s.org_label AS lbl FROM source_sections ss
        JOIN sources s ON s.id = ss.source_id
        WHERE s.org_label IN ('canary-a', 'canary-b')
      `;
        expect(
          rows.map((r: { lbl: string }) => r.lbl),
          JSON.stringify(rows),
        ).toEqual(['canary-a']);
      });
      await asRegulaApp(ORG_B, async () => {
        const rows = await client`
        SELECT s.org_label AS lbl FROM source_sections ss
        JOIN sources s ON s.id = ss.source_id
        WHERE s.org_label IN ('canary-a', 'canary-b')
      `;
        expect(
          rows.map((r: { lbl: string }) => r.lbl),
          JSON.stringify(rows),
        ).toEqual(['canary-b']);
      });
    },
  );

  // ---- AC3 negative: superuser bypasses RLS (confirms the inert-today framing) ----

  it.skipIf(SKIP)(
    'superuser bypasses RLS (no GUC) — confirms runtime inert until regula_app switch',
    async () => {
      const rows = await client`
      SELECT count(*)::int AS n FROM sources WHERE org_label IN ('canary-a', 'canary-b')
    `;
      expect(Number(rows[0]?.n), 'superuser must see all canary rows regardless of RLS').toBe(2);
    },
  );
});
