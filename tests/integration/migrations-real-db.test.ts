// @MX:NOTE [AUTO] Real-DB migration integration test (L-007 extension).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001 / SPEC-REGULA-PROJECT-MEMORY-001
//
// Regression guard: enterprise-migrations.test.ts only parses SQL textually,
// so it could NOT catch the 0086 promoted_by text-vs-uuid FK type mismatch
// nor the 0087 inline WHERE-on-CONSTRAINT syntax error. Both bugs rolled
// back at runtime, leaving promoted_answers + project_memory ABSENT from
// the DB while the textual suite stayed green.
//
// This test connects to a live PostgreSQL (DATABASE_URL) and asserts that
// the fix-up migration 0089 — and therefore the canonical schemas for
// promoted_answers / project_memory — applies cleanly. It also verifies
// the specific shapes that were broken: promoted_by is uuid, and the
// one-active-per-key guard is a partial UNIQUE INDEX (not inline CONSTRAINT).
//
// Skipped when DATABASE_URL is unset (mirrors audit-immutability.test.ts).

import { logger } from '@/lib/observability/logger';
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';

const SKIP_REASON = 'Requires DATABASE_URL with pgvector + 0089 fix-up migration applied';

async function getDb() {
  const { db } = await import('@/lib/db/client');
  return db;
}

describe('migrations 0086/0087 fix-up — real-DB schema (Issues #50 / #51)', () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL) {
      logger.warn(`Skipping: ${SKIP_REASON}`);
    }
  });

  it.skipIf(!process.env.DATABASE_URL)(
    'promoted_answers table exists (0086/0089 CREATE TABLE succeeded)',
    async () => {
      const db = await getDb();
      const res = await db.execute(sql`
        SELECT to_regclass('public.promoted_answers') AS exists
      `);
      const row = res[0] as { exists: string | null } | undefined;
      expect(row?.exists, 'promoted_answers must exist in real DB').toBe('promoted_answers');
    },
  );

  it.skipIf(!process.env.DATABASE_URL)(
    'promoted_answers.promoted_by column is uuid, NOT text (0086 bug fix)',
    async () => {
      const db = await getDb();
      const res = await db.execute(sql`
        SELECT data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = 'promoted_answers' AND column_name = 'promoted_by'
      `);
      const row = res[0] as { data_type: string; udt_name: string } | undefined;
      expect(row, 'promoted_by column must exist').toBeDefined();
      expect(row?.udt_name).toBe('uuid');
    },
  );

  it.skipIf(!process.env.DATABASE_URL)(
    'promoted_answers.promoted_by FK to users(id) is present (type-compatible)',
    async () => {
      const db = await getDb();
      // If the FK type mismatch persisted, the constraint would not exist.
      const res = await db.execute(sql`
        SELECT 1 AS ok
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'promoted_answers'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'promoted_by'
      `);
      expect(res.length).toBeGreaterThan(0);
    },
  );

  it.skipIf(!process.env.DATABASE_URL)(
    'project_memory table exists (0087/0089 CREATE TABLE succeeded)',
    async () => {
      const db = await getDb();
      const res = await db.execute(sql`
        SELECT to_regclass('public.project_memory') AS exists
      `);
      const row = res[0] as { exists: string | null } | undefined;
      expect(row?.exists, 'project_memory must exist in real DB').toBe('project_memory');
    },
  );

  it.skipIf(!process.env.DATABASE_URL)(
    'project_memory partial UNIQUE INDEX exists (0087 bug fix: INDEX not inline CONSTRAINT)',
    async () => {
      const db = await getDb();
      const res = await db.execute(sql`
        SELECT indexdef
        FROM pg_indexes
        WHERE tablename = 'project_memory'
          AND indexname = 'project_memory_one_active_per_key'
      `);
      const row = res[0] as { indexdef: string } | undefined;
      expect(row?.indexdef, 'partial unique index must exist').toBeDefined();
      expect(row?.indexdef).toMatch(/CREATE UNIQUE INDEX/);
      expect(row?.indexdef).toMatch(/WHERE.*status = 'active'/);
    },
  );

  it.skipIf(!process.env.DATABASE_URL)(
    '0089 fix-up guard enforces uniqueness (unique index is valid)',
    async () => {
      // Belt-and-braces: the partial unique index is marked valid + unique.
      const db = await getDb();
      const res = await db.execute(sql`
        SELECT indisunique, indisvalid
        FROM pg_index
        WHERE indrelid = 'public.project_memory'::regclass
          AND indisunique = true
      `);
      const rows = res as unknown as Array<{ indisunique: boolean; indisvalid: boolean }>;
      const guard = rows.find((r) => r.indisunique === true);
      expect(guard, 'at least one UNIQUE index on project_memory').toBeDefined();
      expect(guard?.indisvalid, 'unique index must be valid (not invalid)').toBe(true);
    },
  );
});
