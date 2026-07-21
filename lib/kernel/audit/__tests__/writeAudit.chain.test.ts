/**
 * Integration tests for SPEC-V3-AUDIT-CHAIN-001 M1: writeAudit hash-chain population.
 *
 * Requires a live DATABASE_URL (L-010, L-013). Skipped otherwise.
 *
 * NOTE: audit_logs is append-only (migration 0001 — BEFORE UPDATE OR DELETE
 * trigger). These tests CANNOT clean up rows, so each case uses a unique
 * resource_id (crypto.randomUUID) to avoid collisions across runs.
 *
 * NOTE: writeAudit (lib/audit.ts) and db (lib/kernel/db/client) are imported LAZILY
 * inside each test so this file loads without a live env (matches the
 * audit-immutability.test.ts pattern); skipIf prevents the dynamic import when
 * DATABASE_URL is absent.
 *
 * Option A (REQ-AC-007): row_N.previous_hash stores chainHash_{N-1}. The
 * genesis row (empty table) stores the literal GENESIS_SENTINEL ('<genesis>');
 * every other row stores a 64-char hex hash.
 *
 * Covers AC-1 (format), AC-2 (chaining), AC-3 (tx rollback atomicity),
 * AC-9 (AuditDbHandle widening), AC-10 (advisory lock acquire path).
 */

import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { auditLogs } from '../../db/schema';
import { GENESIS_SENTINEL, canonicalizeMetaJson, computeAuditRowHash } from '../hash-chain';

const RUNS_TESTS = !!process.env.DATABASE_URL;

describe.skipIf(!RUNS_TESTS)('SPEC-V3-AUDIT-CHAIN-001 M1: writeAudit chain (integration)', () => {
  it('AC-1/AC-9: writes a row with chain_seq and a valid previous_hash (sentinel or hex)', async () => {
    const { writeAudit } = await import('../../audit');
    const { db } = await import('../../db/client');
    const rid = `audit-chain-test-${globalThis.crypto.randomUUID()}`;
    await writeAudit({
      actor_id: null,
      action: 'dashboard.view',
      resource_type: 'test',
      resource_id: rid,
      conversation_id: null,
      meta_json: { probe: 'ac1' },
    });

    const inserted = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.resourceId, rid))
      .limit(1);

    expect(inserted).toHaveLength(1);
    const r = inserted[0];
    if (!r) throw new Error('test setup: row not inserted');
    // previous_hash is either the genesis sentinel (if this row is the first ever)
    // or a 64-char hex chain link.
    expect(r.previousHash).toMatch(/^(<genesis>|[0-9a-f]{64})$/);
    expect(r.chainSeq).toBeGreaterThanOrEqual(1);
    // AC-9: the app-side UUID (C1) is now the explicit id.
    expect(r.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('AC-2: consecutive inserts chain — row2.previous_hash = chainHash(row1) and chainSeq increments', async () => {
    const { writeAudit } = await import('../../audit');
    const { db } = await import('../../db/client');
    const rid1 = `audit-chain-test-${globalThis.crypto.randomUUID()}`;
    const rid2 = `audit-chain-test-${globalThis.crypto.randomUUID()}`;

    await writeAudit({
      actor_id: null,
      action: 'dashboard.view',
      resource_type: 'test',
      resource_id: rid1,
      conversation_id: null,
      meta_json: { step: 1 },
    });
    const r1 = (
      await db.select().from(auditLogs).where(eq(auditLogs.resourceId, rid1)).limit(1)
    )[0];
    if (!r1) throw new Error('test setup: row 1 not inserted');

    await writeAudit({
      actor_id: null,
      action: 'dashboard.view',
      resource_type: 'test',
      resource_id: rid2,
      conversation_id: null,
      meta_json: { step: 2 },
    });
    const r2 = (
      await db.select().from(auditLogs).where(eq(auditLogs.resourceId, rid2)).limit(1)
    )[0];
    if (!r2) throw new Error('test setup: row 2 not inserted');

    // chainSeq strictly increments.
    expect(r2.chainSeq).toBe(r1.chainSeq + 1);

    // Option A: r2.previousHash = chainHash of r1 = SHA256(canonical(r1) ‖ (r1.previousHash ?? GENESIS)).
    const expectedR2Prev = await computeAuditRowHash(r1.previousHash ?? GENESIS_SENTINEL, {
      id: r1.id,
      actor_id: r1.actorId ?? '',
      action: r1.action,
      resource_type: r1.resourceType,
      resource_id: r1.resourceId,
      conversation_id: r1.conversationId ?? '',
      meta_json: canonicalizeMetaJson(r1.metaJson),
      created_at: r1.createdAt.toISOString(),
    });
    expect(r2.previousHash).toBe(expectedR2Prev);
  });

  it('AC-3: caller-tx rollback discards the audit row (atomicity, REQ-AC-002)', async () => {
    const { writeAudit } = await import('../../audit');
    const { db } = await import('../../db/client');
    const rid = `audit-chain-test-rollback-${globalThis.crypto.randomUUID()}`;

    await expect(
      db.transaction(async (tx) => {
        await writeAudit(
          {
            actor_id: null,
            action: 'dashboard.view',
            resource_type: 'test',
            resource_id: rid,
            conversation_id: null,
            meta_json: { will: 'rollback' },
          },
          tx,
        );
        throw new Error('intentional rollback');
      }),
    ).rejects.toThrow();

    const rows = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, rid));
    expect(rows).toHaveLength(0);
  });

  it('AC-10: advisory lock acquire path succeeds (concurrency serialization wiring)', async () => {
    const { writeAudit } = await import('../../audit');
    const { db } = await import('../../db/client');
    // Full concurrent-fork prevention requires a parallel-tx harness (M4 bench suite).
    // Here we verify the lock+insert path completes and produces a well-formed row.
    const rid = `audit-chain-test-lock-${globalThis.crypto.randomUUID()}`;
    await writeAudit({
      actor_id: null,
      action: 'dashboard.view',
      resource_type: 'test',
      resource_id: rid,
      conversation_id: null,
      meta_json: { probe: 'ac10' },
    });
    const r = (await db.select().from(auditLogs).where(eq(auditLogs.resourceId, rid)).limit(1))[0];
    if (!r) throw new Error('test setup: row not inserted');
    expect(r.previousHash).toMatch(/^(<genesis>|[0-9a-f]{64})$/);
    expect(r.chainSeq).toBeGreaterThanOrEqual(1);
  });
});
