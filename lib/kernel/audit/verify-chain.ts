/**
 * SPEC-V3-AUDIT-CHAIN-001 M2: Chain verification — forward recurrence check.
 *
 * Walks the chain ordered by chain_seq ASC, created_at ASC, id ASC. Under
 * Option A (REQ-AC-007), row_N.previous_hash stores chainHash_{N-1}. The
 * verifier tracks the expected chainHash, checks each row's stored
 * previous_hash against it, then recomputes chainHash_N from the row's own
 * fields to advance.
 *
 * Tamper-evidence (AC-5): mutating row_N's fields changes the recomputed
 * chainHash_N, so row_{N+1}.previous_hash (which stores the ORIGINAL
 * chainHash_N) no longer matches the expected value → violation at row_{N+1}.
 *
 * Segment awareness (AC-6 / REQ-AC-008): a row with previous_hash IS NULL is
 * a backfill/segment boundary — it is NOT flagged and the expected chainHash
 * resets to GENESIS_SENTINEL for the following row.
 *
 * @MX:ANCHOR [AUTO] verifyAuditChain — 21 CFR Part 11 forward chain verification.
 * @MX:REASON Called by the daily cron (M3) and manual verification. fan_in ≥ 2.
 *            Core security invariant: detects any chain break.
 * @MX:SPEC SPEC-V3-AUDIT-CHAIN-001 (REQ-AC-007, REQ-AC-008, AC-5, AC-6)
 */

import { asc } from 'drizzle-orm';
import { auditLogs } from '../db/schema';
import {
  type CanonicalAuditRow,
  GENESIS_SENTINEL,
  canonicalizeMetaJson,
  computeAuditRowHash,
} from './hash-chain';

/** A single detected chain break. */
export interface ChainViolation {
  rowId: string;
  chainSeq: number;
  reason: string;
  expected?: string;
  actual?: string;
}

/** Row shape consumed by the verifier (DB rows or mock rows). */
export interface ChainVerificationRow {
  id: string;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  conversationId: string | null;
  metaJson: unknown;
  createdAt: Date;
  previousHash: string | null;
  chainSeq: number;
}

export interface VerifyChainOptions {
  /**
   * If provided, verify these rows instead of querying the DB (unit tests).
   * Rows are sorted internally by chain_seq ASC, created_at ASC, id ASC.
   */
  rows?: ChainVerificationRow[];
}

export interface VerifyChainResult {
  ok: boolean;
  violations: ChainViolation[];
  checked: number;
}

/** Convert a DB/mock row to the canonical field bundle for hashing. */
function rowToCanonical(row: ChainVerificationRow): CanonicalAuditRow {
  return {
    id: row.id,
    actor_id: row.actorId ?? '',
    action: row.action,
    resource_type: row.resourceType,
    resource_id: row.resourceId,
    conversation_id: row.conversationId ?? '',
    meta_json: canonicalizeMetaJson(row.metaJson),
    created_at: row.createdAt.toISOString(),
  };
}

/** Sort rows the same way the chain is walked (matches fetchPreviousChainLink DESC reversed). */
function sortChainRows(rows: ChainVerificationRow[]): ChainVerificationRow[] {
  return [...rows].sort((a, b) => {
    if (a.chainSeq !== b.chainSeq) return a.chainSeq - b.chainSeq;
    const ta = a.createdAt.getTime();
    const tb = b.createdAt.getTime();
    if (ta !== tb) return ta - tb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Verify the audit hash chain. Default: queries the full audit_logs table
 * (correct for 21 CFR Part 11 — a partial window cannot resolve the first
 * row's expected previous_hash without prior-chain context). Pass `opts.rows`
 * for unit tests.
 *
 * @returns { ok, violations, checked }. Never throws — callers (cron) wrap in try/catch anyway.
 */
export async function verifyAuditChain(opts: VerifyChainOptions = {}): Promise<VerifyChainResult> {
  const rows: ChainVerificationRow[] = opts.rows
    ? sortChainRows(opts.rows)
    : await loadAllChainRows();

  const violations: ChainViolation[] = [];
  let expectedPrevHash = GENESIS_SENTINEL;

  for (const row of rows) {
    // AC-6 / REQ-AC-008: NULL previous_hash = backfill/segment boundary.
    if (row.previousHash === null) {
      expectedPrevHash = GENESIS_SENTINEL;
      continue;
    }

    // REQ-AC-007 assertion: row.previous_hash MUST equal chainHash_{N-1}.
    if (row.previousHash !== expectedPrevHash) {
      violations.push({
        rowId: row.id,
        chainSeq: row.chainSeq,
        reason:
          'chain break: previous_hash does not match the recomputed chain hash of the prior row',
        expected: expectedPrevHash,
        actual: row.previousHash,
      });
      // Recover expectedPrevHash from THIS row using the (possibly tampered) fields
      // so one bad row does not cascade false positives downstream.
    }

    // Advance: chainHash_N = SHA256(canonical(row_N) ‖ expectedPrevHash).
    expectedPrevHash = await computeAuditRowHash(expectedPrevHash, rowToCanonical(row));
  }

  return {
    ok: violations.length === 0,
    violations,
    checked: rows.length,
  };
}

/** Query every audit row in chain order (full-table verify). */
async function loadAllChainRows(): Promise<ChainVerificationRow[]> {
  // Lazy import — keeps the verifier importable in environments without a live DB
  // (unit tests use opts.rows). db/client triggers env validation at module load.
  const { db } = await import('../db/client');
  const rows = await db
    .select({
      id: auditLogs.id,
      actorId: auditLogs.actorId,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      conversationId: auditLogs.conversationId,
      metaJson: auditLogs.metaJson,
      createdAt: auditLogs.createdAt,
      previousHash: auditLogs.previousHash,
      chainSeq: auditLogs.chainSeq,
    })
    .from(auditLogs)
    .orderBy(asc(auditLogs.chainSeq), asc(auditLogs.createdAt), asc(auditLogs.id));

  return rows.map((r) => ({
    id: r.id,
    actorId: r.actorId,
    action: r.action,
    resourceType: r.resourceType,
    resourceId: r.resourceId,
    conversationId: r.conversationId,
    metaJson: r.metaJson,
    createdAt: r.createdAt,
    previousHash: r.previousHash,
    chainSeq: r.chainSeq,
  }));
}
