// @MX:NOTE [AUTO] Integration test: audit_logs immutability — REQ-LAUNCH-030.
// @MX:SPEC SPEC-REGULA-LAUNCH-001 (REQ-LAUNCH-030)
// Verifies that UPDATE / DELETE / TRUNCATE on audit_logs are rejected by the
// database-level immutability trigger (SPEC-REGULA-FOUNDATION-001 REQ-FND-044).
// Requires a live DATABASE_URL; all cases are skipped otherwise.

import { logger } from '@/lib/observability/logger';
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';

const SKIP_REASON = 'Requires DATABASE_URL and FOUNDATION audit trigger (REQ-FND-044)';

// Lazily resolve db so the test file can be imported without a live connection.
async function getDb() {
  const { db } = await import('@/lib/kernel/db/client');
  return db;
}

describe('audit_logs immutability (REQ-LAUNCH-030)', () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL) {
      logger.warn(`Skipping: ${SKIP_REASON}`);
    }
  });

  it.skipIf(!process.env.DATABASE_URL)('UPDATE on audit_logs is rejected by trigger', async () => {
    const db = await getDb();
    await expect(
      db.execute(
        sql`UPDATE audit_logs SET event_type = 'tampered' WHERE id = (SELECT id FROM audit_logs LIMIT 1)`,
      ),
    ).rejects.toThrow();
  });

  it.skipIf(!process.env.DATABASE_URL)('DELETE on audit_logs is rejected by trigger', async () => {
    const db = await getDb();
    await expect(
      db.execute(sql`DELETE FROM audit_logs WHERE id = (SELECT id FROM audit_logs LIMIT 1)`),
    ).rejects.toThrow();
  });

  it.skipIf(!process.env.DATABASE_URL)(
    'TRUNCATE on audit_logs is rejected by trigger',
    async () => {
      const db = await getDb();
      await expect(db.execute(sql`TRUNCATE TABLE audit_logs`)).rejects.toThrow();
    },
  );
});
