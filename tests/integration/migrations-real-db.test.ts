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
  const { db } = await import('@/lib/kernel/db/client');
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

// @MX:NOTE [AUTO] Real-DB regression for fix-up 0090 (L-010/L-011).
// @MX:SPEC SPEC-REGULA-RLHF-001 / SPEC-REGULA-SAMD-001
// @MX:REASON enterprise-migrations.test.ts only parses SQL textually, so it
//           could not catch the 0082 answer_feedback.user_id text-vs-uuid nor
//           the 0054 samd_assessments.org_id/created_by text-vs-uuid FK type
//           mismatches. Both CREATE TABLE statements rolled back at runtime,
//           leaving the tables ABSENT while the textual suite stayed green.
//           3 live /api/rlhf/* routes + 4 live /api/ra/samd/* routes 500'd.
//           This block asserts the 0090 fix-up created both tables with the
//           corrected uuid FK columns. Mirrors the 0089 regression pattern.
describe('migrations 0082/0054 fix-up — real-DB schema (Issues #56 RLHF / SaMD)', () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL) {
      logger.warn(`Skipping: ${SKIP_REASON}`);
    }
  });

  it.skipIf(!process.env.DATABASE_URL)(
    'answer_feedback table exists (0082/0090 CREATE TABLE succeeded)',
    async () => {
      const db = await getDb();
      const res = await db.execute(sql`
        SELECT to_regclass('public.answer_feedback') AS exists
      `);
      const row = res[0] as { exists: string | null } | undefined;
      expect(row?.exists, 'answer_feedback must exist in real DB').toBe('answer_feedback');
    },
  );

  it.skipIf(!process.env.DATABASE_URL)(
    'answer_feedback.user_id column is uuid, NOT text (0082 bug fix)',
    async () => {
      const db = await getDb();
      const res = await db.execute(sql`
        SELECT data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = 'answer_feedback' AND column_name = 'user_id'
      `);
      const row = res[0] as { data_type: string; udt_name: string } | undefined;
      expect(row, 'user_id column must exist').toBeDefined();
      expect(row?.udt_name, 'user_id must be uuid (users.id is uuid)').toBe('uuid');
    },
  );

  it.skipIf(!process.env.DATABASE_URL)(
    'answer_feedback.user_id FK to users(id) is present (type-compatible)',
    async () => {
      const db = await getDb();
      const res = await db.execute(sql`
        SELECT 1 AS ok
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'answer_feedback'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'user_id'
      `);
      expect(res.length, 'answer_feedback.user_id FK must exist').toBeGreaterThan(0);
    },
  );

  it.skipIf(!process.env.DATABASE_URL)(
    'samd_assessments table exists (0054/0090 CREATE TABLE succeeded)',
    async () => {
      const db = await getDb();
      const res = await db.execute(sql`
        SELECT to_regclass('public.samd_assessments') AS exists
      `);
      const row = res[0] as { exists: string | null } | undefined;
      expect(row?.exists, 'samd_assessments must exist in real DB').toBe('samd_assessments');
    },
  );

  it.skipIf(!process.env.DATABASE_URL)(
    'samd_assessments.org_id column is uuid, NOT text (0054 bug fix)',
    async () => {
      const db = await getDb();
      const res = await db.execute(sql`
        SELECT data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = 'samd_assessments' AND column_name = 'org_id'
      `);
      const row = res[0] as { data_type: string; udt_name: string } | undefined;
      expect(row, 'org_id column must exist').toBeDefined();
      expect(row?.udt_name, 'org_id must be uuid (organizations.id is uuid)').toBe('uuid');
    },
  );

  it.skipIf(!process.env.DATABASE_URL)(
    'samd_assessments.org_id FK to organizations(id) is present (type-compatible)',
    async () => {
      const db = await getDb();
      const res = await db.execute(sql`
        SELECT 1 AS ok
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'samd_assessments'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'org_id'
      `);
      expect(res.length, 'samd_assessments.org_id FK must exist').toBeGreaterThan(0);
    },
  );

  it.skipIf(!process.env.DATABASE_URL)(
    'samd_assessments.created_by column is uuid, NOT text (0054 bug fix — same text-vs-uuid class)',
    async () => {
      const db = await getDb();
      const res = await db.execute(sql`
        SELECT udt_name
        FROM information_schema.columns
        WHERE table_name = 'samd_assessments' AND column_name = 'created_by'
      `);
      const row = res[0] as { udt_name: string } | undefined;
      expect(row, 'created_by column must exist').toBeDefined();
      expect(row?.udt_name, 'created_by must be uuid (users.id is uuid)').toBe('uuid');
    },
  );
});
