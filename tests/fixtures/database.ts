// @MX:NOTE [AUTO] Real-DB test fixtures for integration tests (Issue #364 / L-013).
// @MX:SPEC SPEC-REGULA-FOUNDATION-001 (REQ-FND-044 immutability) + Issue #364
// @MX:REASON [AUTO] L-013: static + CI-mock + self-report triple blind spot.
//           These fixtures let data/schema-dependent integration tests run against
//           a LIVE PostgreSQL (DATABASE_URL) so FK type mismatches and schema
//           drift — the class of bugs the mock layer hides — surface at test time
//           instead of in production INSERTs.
//
// Usage contract (mirrors tests/integration/migrations-real-db.test.ts +
// audit-immutability.test.ts precedents):
//   1. Gate every case with `it.skipIf(!HAS_DATABASE_URL)`.
//   2. `beforeAll`: seed FK prerequisites (e.g. seedCoreActors).
//   3. `beforeEach`: truncate ONLY the table(s) under test for isolation.
//   4. audit_logs is EXCLUDED from truncation — the FOUNDATION immutability
//      trigger (REQ-FND-044) rejects TRUNCATE/DELETE/UPDATE on audit_logs.
//      Tests that exercise writeAudit must mock @/lib/audit rather than rely on
//      truncating the audit table.

import { organizations, projects, users } from '@/lib/kernel/db/schema';
import { sql } from 'drizzle-orm';

/**
 * True when a live DATABASE_URL is available. Mirrors the `it.skipIf` guard used
 * by migrations-real-db.test.ts / audit-immutability.test.ts, so data tests skip
 * gracefully in environments without a test DB (e.g. local unit runs) while
 * running for real in CI (where DATABASE_URL points at regula_ci).
 */
export const HAS_DATABASE_URL = Boolean(process.env.DATABASE_URL);

/**
 * Lazily resolve the Drizzle `db` client. Importing lazily (rather than at module
 * top) lets this module — and tests that import it — load without a live
 * connection; the connection is only established on first use inside a
 * DATABASE_URL-guarded case.
 */
export async function getDb() {
  const { db } = await import('@/lib/kernel/db/client');
  return db;
}

/**
 * Truncate the given table(s) for per-test isolation. The listed tables are
 * truncated together in ONE statement, which satisfies mutual FK constraints
 * among the set without CASCADE (Postgres checks references only from tables
 * NOT in the truncate list).
 *
 * RESTART IDENTITY resets any sequences so re-seeded surrogate keys are stable.
 *
 * When a table under test has FK dependents the test does not own (e.g.
 * workflow_runs is referenced by 7 workflow-domain child tables), pass
 * `{ cascade: true }` to reset the whole dependent subtree. CASCADE is
 * domain-scoped to the listed tables' dependents — it does NOT touch the
 * shared reference tables (users/organizations/projects) unless they are listed.
 *
 * @MX:WARN [AUTO] Never pass audit_logs here — the immutability trigger rejects it.
 * @MX:REASON audit_logs TRUNCATE throws (REQ-FND-044); see audit-immutability.test.ts.
 *
 * @param tableNames - physical Postgres table names (test-controlled constants,
 *   never user input), so they are safe to interpolate into the TRUNCATE list.
 * @param options.cascade - when true, append CASCADE to also truncate FK
 *   dependents of the listed tables (domain-scoped reset).
 */
export async function truncateTables(
  tableNames: readonly string[],
  options?: { cascade?: boolean },
): Promise<void> {
  if (tableNames.length === 0) return;
  const db = await getDb();
  const list = tableNames.join(', ');
  const cascade = options?.cascade ? ' CASCADE' : '';
  await db.execute(sql.raw(`TRUNCATE TABLE ${list} RESTART IDENTITY${cascade}`));
}

/**
 * Seed the core actor rows a workflow run depends on: a user, its organization,
 * and a project owned by that organization. workflow_runs has NOT NULL FKs to
 * all three (lib/kernel/db/schema.ts REQ-WF-049), so a real INSERT fails fast on a
 * dangling id — the L-013 guarantee.
 *
 * Idempotent: onConflictDoNothing lets beforeAll re-run without unique/email
 * collisions across test invocations against the shared DB.
 *
 * @MX:NOTE [AUTO] Required columns: users(email,name), organizations(name),
 *                 projects(organizationId,name).
 */
export interface CoreActors {
  userId: string;
  userEmail: string;
  userName: string;
  orgId: string;
  orgName: string;
  projectId: string;
  projectName: string;
}

export async function seedCoreActors(actors: CoreActors): Promise<void> {
  const db = await getDb();
  await db
    .insert(organizations)
    .values({ id: actors.orgId, name: actors.orgName })
    .onConflictDoNothing();
  await db
    .insert(users)
    .values({ id: actors.userId, email: actors.userEmail, name: actors.userName })
    .onConflictDoNothing();
  await db
    .insert(projects)
    .values({
      id: actors.projectId,
      organizationId: actors.orgId,
      name: actors.projectName,
    })
    .onConflictDoNothing();
}
