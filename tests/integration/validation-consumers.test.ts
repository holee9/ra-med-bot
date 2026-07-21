// @MX:NOTE [AUTO] Real-DB integration tests for VALIDATION-002 consumers (AC-1, AC-3).
// @MX:SPEC SPEC-REGULA-VALIDATION-002 (M0 consumers, #372 follow-up)
// @MX:REASON L-013 — consumer window query + dashboard snapshot are verified
//   against a live PostgreSQL, not just mocked unit tests. classify-changes
//   script-spawn integration (AC-2 evalRunId, AC-9 stderr) is covered by unit
//   tests in tests/unit/validation/; this file covers the DB-backed consumers.

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const SKIP_REASON = 'Requires DATABASE_URL with pgvector + 0089/0112 migrations applied';

async function getDb() {
  const { db } = await import('@/lib/kernel/db/client');
  return db;
}

async function getTestOrg(): Promise<string> {
  const db = await getDb();
  const { organizations } = await import('@/lib/kernel/db/schema');
  const [org] = await db.select({ id: organizations.id }).from(organizations).limit(1);
  if (!org) throw new Error('test DB has no organization row — seed required');
  return org.id;
}

describe.skipIf(!process.env.DATABASE_URL)('SPEC-REGULA-VALIDATION-002 consumers (real-db)', () => {
  let orgId: string;
  let db: Awaited<ReturnType<typeof getDb>>;
  const changeRequestIds: string[] = [];
  const sourceIds: string[] = [];

  beforeAll(async () => {
    db = await getDb();
    orgId = await getTestOrg();
  });

  afterEach(async () => {
    const { changeRequest, sources } = await import('@/lib/kernel/db/schema');
    const { inArray } = await import('drizzle-orm');
    if (changeRequestIds.length > 0) {
      await db.delete(changeRequest).where(inArray(changeRequest.id, [...changeRequestIds]));
      changeRequestIds.length = 0;
    }
    if (sourceIds.length > 0) {
      await db.delete(sources).where(inArray(sources.id, [...sourceIds]));
      sourceIds.length = 0;
    }
  });

  afterAll(() => {
    // DB pool cleanup is handled by the vitest worker process exit; the shared
    // postgres-js pool is reaped when the node test worker terminates.
  });

  it('AC-1: fetchWindowScopedChangeRequests returns ONLY rows within [windowStart, windowEnd)', async () => {
    const { changeRequest } = await import('@/lib/kernel/db/schema');
    const { fetchWindowScopedChangeRequests } = await import(
      '@/lib/validation/consumers/model-governance'
    );

    const now = new Date();
    const DAY = 24 * 60 * 60 * 1000;
    const windowStart = new Date(now.getTime() - 10 * DAY); // 10 days ago
    const windowEnd = new Date(now.getTime() + DAY); // tomorrow (exclusive upper bound)

    // Inside window (recent) — should be returned.
    const insideRows = await db
      .insert(changeRequest)
      .values({
        orgId,
        promptId: null,
        modelPinId: null,
        approvalStatus: 'approved',
        createdAt: new Date(now.getTime() - 5 * DAY),
      })
      .returning({ id: changeRequest.id });
    const inside = insideRows[0];
    if (!inside) throw new Error('seed failed: inside change_request');
    changeRequestIds.push(inside.id);

    // Outside window (ancient) — should be excluded.
    const outsideRows = await db
      .insert(changeRequest)
      .values({
        orgId,
        promptId: null,
        modelPinId: null,
        approvalStatus: 'approved',
        createdAt: new Date(now.getTime() - 365 * DAY),
      })
      .returning({ id: changeRequest.id });
    const outside = outsideRows[0];
    if (!outside) throw new Error('seed failed: outside change_request');
    changeRequestIds.push(outside.id);

    const rows = await fetchWindowScopedChangeRequests({ orgId, windowStart, windowEnd });

    // AC-1: only the inside-window row is returned.
    const returnedIds = rows.map((r) => r.id);
    expect(returnedIds).toContain(inside.id);
    expect(returnedIds).not.toContain(outside.id);
    expect(rows).toHaveLength(1);
  });

  it('AC-1 EC-1: empty window returns 0 rows (no crash)', async () => {
    const { fetchWindowScopedChangeRequests } = await import(
      '@/lib/validation/consumers/model-governance'
    );
    const futureWindowStart = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const futureWindowEnd = new Date(futureWindowStart.getTime() + 24 * 60 * 60 * 1000);
    const rows = await fetchWindowScopedChangeRequests({
      orgId,
      windowStart: futureWindowStart,
      windowEnd: futureWindowEnd,
    });
    expect(rows).toHaveLength(0);
  });

  it('AC-3: snapshotSourceGovernance returns counts shape (approved/pendingReview/stale/superseded)', async () => {
    const { snapshotSourceGovernance } = await import(
      '@/lib/validation/consumers/source-governance'
    );
    const dashboard = await snapshotSourceGovernance({ orgId });
    // AC-3: counts shape — approved/pendingReview/stale/superseded present.
    expect(dashboard.counts).toHaveProperty('approved');
    expect(dashboard.counts).toHaveProperty('pendingReview');
    expect(dashboard.counts).toHaveProperty('stale');
    expect(dashboard.counts).toHaveProperty('superseded');
    expect(typeof dashboard.counts.approved).toBe('number');
    // reviewDue + staleCitationArtifacts arrays (may be empty).
    expect(Array.isArray(dashboard.reviewDue)).toBe(true);
    expect(Array.isArray(dashboard.staleCitationArtifacts)).toBe(true);
  });
});
