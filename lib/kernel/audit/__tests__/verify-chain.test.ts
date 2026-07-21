/**
 * TDD tests for SPEC-V3-AUDIT-CHAIN-001 M2: verifyAuditChain (Option A forward chain).
 *
 * Option A (REQ-AC-007): row_N.previous_hash stores chainHash_{N-1}. The verifier
 * tracks the expected chainHash, checks each row's stored previousHash against it,
 * then recomputes chainHash_N from the row's own fields to advance.
 *
 * Covers:
 * - AC-5: tamper row_N → violation at row_{N+1}
 * - AC-5b: field-order sensitivity
 * - AC-6 / REQ-AC-008: NULL previousHash = segment boundary, no false positive
 * - Clean chain validates; genesis-as-sentinel and genesis-as-null both handled
 */

import { describe, expect, it } from 'vitest';
import { GENESIS_SENTINEL, canonicalizeMetaJson, computeAuditRowHash } from '../hash-chain';
import { type ChainVerificationRow, verifyAuditChain } from '../verify-chain';

/** Build a ChainVerificationRow (camelCase) with deterministic defaults. */
function row(opts: {
  id: string;
  chainSeq: number;
  previousHash: string | null;
  createdAt?: Date;
  action?: string;
  actorId?: string | null;
  metaJson?: unknown;
}): ChainVerificationRow {
  return {
    id: opts.id,
    actorId: opts.actorId ?? 'actor-1',
    action: opts.action ?? 'llm.call',
    resourceType: 'message',
    resourceId: `res-${opts.id}`,
    conversationId: 'conv-1',
    metaJson: opts.metaJson ?? { test: 'data' },
    createdAt: opts.createdAt ?? new Date('2026-07-06T12:00:00.000Z'),
    previousHash: opts.previousHash,
    chainSeq: opts.chainSeq,
  };
}

/** Recompute the chainHash a row SHOULD have produced (for constructing clean chains). */
async function chainHash(prevChainHash: string, r: ChainVerificationRow): Promise<string> {
  return computeAuditRowHash(prevChainHash, {
    id: r.id,
    actor_id: r.actorId ?? '',
    action: r.action,
    resource_type: r.resourceType,
    resource_id: r.resourceId,
    conversation_id: r.conversationId ?? '',
    meta_json: canonicalizeMetaJson(r.metaJson),
    created_at: r.createdAt.toISOString(),
  });
}

describe('SPEC-V3-AUDIT-CHAIN-001 M2: verifyAuditChain', () => {
  it('accepts a clean chain where genesis uses the GENESIS_SENTINEL (Option A)', async () => {
    const r1 = row({ id: 'id-1', chainSeq: 1, previousHash: GENESIS_SENTINEL });
    const h1 = await chainHash(GENESIS_SENTINEL, r1);
    const r2 = row({ id: 'id-2', chainSeq: 2, previousHash: h1 });
    const h2 = await chainHash(h1, r2);
    const r3 = row({ id: 'id-3', chainSeq: 3, previousHash: h2 });

    const result = await verifyAuditChain({ rows: [r1, r2, r3] });

    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.checked).toBe(3);
  });

  it('detects tamper at row_{N+1} when row_N fields are mutated (AC-5)', async () => {
    // Build a correct 3-row chain.
    const r1 = row({ id: 'id-1', chainSeq: 1, previousHash: GENESIS_SENTINEL });
    const h1 = await chainHash(GENESIS_SENTINEL, r1);
    const r2 = row({ id: 'id-2', chainSeq: 2, previousHash: h1, action: 'llm.call' });
    const h2 = await chainHash(h1, r2);
    const r3 = row({ id: 'id-3', chainSeq: 3, previousHash: h2 });

    // Attacker mutates row2's content (action) but leaves row2.previousHash and
    // row3.previousHash at their original stored values. The recomputed chainHash_2
    // no longer matches row3.previousHash → violation reported at row3.
    const tamperedR2 = { ...r2, action: 'source.access' };

    const result = await verifyAuditChain({ rows: [r1, tamperedR2, r3] });

    expect(result.ok).toBe(false);
    const v = result.violations.find((x) => x.rowId === 'id-3');
    expect(v).toBeDefined();
    expect(v?.actual).toBe(h2); // row3 still stores the original chainHash_2
  });

  it('flags a row whose previousHash does not match the prior chain hash', async () => {
    const r1 = row({ id: 'id-1', chainSeq: 1, previousHash: GENESIS_SENTINEL });
    const r2 = row({
      id: 'id-2',
      chainSeq: 2,
      previousHash: 'deadbeef'.repeat(8), // wrong hash
    });

    const result = await verifyAuditChain({ rows: [r1, r2] });

    expect(result.ok).toBe(false);
    expect(result.violations.find((x) => x.rowId === 'id-2')).toBeDefined();
  });

  it('does NOT flag NULL previousHash as a violation (AC-6 / REQ-AC-008 segment boundary)', async () => {
    // Backfill rows: both have NULL previousHash (pre-chain legacy segment).
    const r1 = row({ id: 'legacy-1', chainSeq: 0, previousHash: null });
    const r2 = row({ id: 'legacy-2', chainSeq: 0, previousHash: null });

    const result = await verifyAuditChain({ rows: [r1, r2] });

    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('resets the expected chainHash to GENESIS after a NULL-segment row and resumes cleanly', async () => {
    // Legacy backfill row (NULL) then a fresh chain that restarts from genesis.
    const legacy = row({ id: 'legacy', chainSeq: 0, previousHash: null });
    const fresh1 = row({ id: 'fresh-1', chainSeq: 1, previousHash: GENESIS_SENTINEL });
    const h1 = await chainHash(GENESIS_SENTINEL, fresh1);
    const fresh2 = row({ id: 'fresh-2', chainSeq: 2, previousHash: h1 });

    const result = await verifyAuditChain({ rows: [legacy, fresh1, fresh2] });

    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('sorts rows by chain_seq ASC, created_at ASC, id ASC before verifying', async () => {
    const r1 = row({ id: 'id-1', chainSeq: 1, previousHash: GENESIS_SENTINEL });
    const h1 = await chainHash(GENESIS_SENTINEL, r1);
    const r2 = row({ id: 'id-2', chainSeq: 2, previousHash: h1 });

    // Pass in reverse order; verifier must sort.
    const result = await verifyAuditChain({ rows: [r2, r1] });

    expect(result.ok).toBe(true);
    expect(result.checked).toBe(2);
  });
});
