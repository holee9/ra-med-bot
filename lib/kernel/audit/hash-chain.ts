/**
 * SPEC-V3-AUDIT-CHAIN-001 M1: Hash chain — pure computation primitives.
 *
 * 21 CFR Part 11 §11.10(e) tamper-evidence. Forward hash chain (Option A,
 * REQ-AC-007 normative): each row stores the PREVIOUS row's chain hash in
 * `previous_hash`. The genesis row stores the literal GENESIS_SENTINEL.
 *
 * C2 exact recurrence (REQ-AC-007 "unambiguous recurrence"):
 *   chainHash_0 = "<genesis>"  (literal sentinel)
 *   chainHash_N = SHA256( canonical(row_N.fields_without_previous_hash)
 *                         ‖ chainHash_{N-1} )                  for N ≥ 1
 *   Assertion: row_N.previous_hash MUST equal chainHash_{N-1}.
 *
 * Tamper-evidence (AC-5): mutating row_N's fields changes chainHash_N, which
 * is stored in row_{N+1}.previous_hash → the recomputed chainHash_N no longer
 * matches row_{N+1}.previous_hash → violation detected at row_{N+1}.
 *
 * Canonical field order (REQ-AC-005, EXACT — order-sensitive per AC-5b):
 *   previous_hash || id || actor_id || action || resource_type ||
 *   resource_id || conversation_id || meta_json (stable sorted keys) ||
 *   created_at (ISO-8601 UTC)
 *
 * NOTE (SPEC amendment candidate — see task #5 / sync phase): AC-5c literally
 * describes the genesis row's previous_hash as SHA256(canonical(row)‖'<genesis>')
 * (= chainHash_1, a hex). Under REQ-AC-007 the genesis row's previous_hash =
 * chainHash_0 = '<genesis>' literal. REQ-AC-007 is the normative EARS SHALL and
 * is the only reading consistent with the AC-5 detection-at-row_{N+1} mechanic,
 * the column name 'previous_hash', and the Bitcoin-style forward-chain pattern.
 * AC-5c/AC-1 should be amended to 'non-genesis rows' / 'genesis sentinel exception'.
 *
 * @MX:ANCHOR [AUTO] computeAuditRowHash — SHA-256 forward hash chain (21 CFR Part 11).
 * @MX:REASON Called by writeAudit (fan_in 192) and verifyAuditChain. Core tamper-evidence invariant.
 * @MX:SPEC SPEC-V3-AUDIT-CHAIN-001 (REQ-AC-005, REQ-AC-006, REQ-AC-007, NFR-AC-003, NFR-AC-004)
 */

import { desc } from 'drizzle-orm';
import { auditLogs } from '../db/schema';

/**
 * Genesis sentinel — chainHash_0. Stored verbatim in the genesis row's
 * `previous_hash` (the only row whose previous_hash is not a 64-char hex).
 * REQ-AC-003: empty-table first row starts a new chain segment here.
 */
export const GENESIS_SENTINEL = '<genesis>';

/**
 * Canonical row fields EXCLUDING previous_hash (the prev chain hash is passed
 * separately as `prevChainHash`). `meta_json` MUST be the canonicalized string
 * from canonicalizeMetaJson(). `created_at` MUST be ISO-8601 UTC.
 */
export interface CanonicalAuditRow {
  id: string;
  actor_id: string; // empty string for system/null actor
  action: string;
  resource_type: string;
  resource_id: string;
  conversation_id: string; // empty string for null
  meta_json: string; // canonicalizeMetaJson() output (sorted-key JSON string)
  created_at: string; // ISO-8601 UTC (e.g. "2026-07-06T12:00:00.000Z")
}

/**
 * Deep-sort the keys of a JSON-serializable value, then stringify.
 * Deterministic regardless of object key insertion order (NFR-AC-003).
 * Array element order is preserved (order is semantically meaningful in meta lists).
 */
export function canonicalizeMetaJson(value: unknown): string {
  return JSON.stringify(deepSortKeys(value));
}

function deepSortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(deepSortKeys);
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      out[k] = deepSortKeys(obj[k]);
    }
    return out;
  }
  return value;
}

/**
 * Compute chainHash_N for a row.
 *
 * chainHash_N = SHA256( canonical(row_N.fields_without_previous_hash) ‖ chainHash_{N-1} )
 *
 * Canonical form: JSON.stringify of an object whose keys are inserted in the
 * EXACT REQ-AC-005 order (V8 preserves string-key insertion order), so field
 * reordering changes the hash (AC-5b). JSON escaping handles arbitrary values.
 *
 * @param prevChainHash chainHash_{N-1} (or GENESIS_SENTINEL for the first row).
 * @returns 64-character lowercase hex string (REQ-AC-006, NFR-AC-004 WebCrypto).
 */
export async function computeAuditRowHash(
  prevChainHash: string,
  row: CanonicalAuditRow,
): Promise<string> {
  const canonical = JSON.stringify({
    previous_hash: prevChainHash,
    id: row.id,
    actor_id: row.actor_id,
    action: row.action,
    resource_type: row.resource_type,
    resource_id: row.resource_id,
    conversation_id: row.conversation_id,
    meta_json: row.meta_json,
    created_at: row.created_at,
  });

  const data = new TextEncoder().encode(canonical);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Full prior-row data needed to compute its chainHash and advance the chain.
 * `previous_hash` null means a backfill/segment boundary (REQ-AC-008).
 */
export interface PreviousChainLink {
  previous_hash: string | null;
  chain_seq: number;
  /** Canonical field values (meta_json canonicalized, created_at ISO). */
  fields: CanonicalAuditRow;
}

/** Select + orderBy-capable handle (db singleton or PgTransaction). */
type ChainSelectHandle = {
  select: typeof import('../db/client')['db']['select'];
};

/**
 * Fetch the most-recent chain link (full row) for prev-row hash computation.
 *
 * Query (REQ-AC-001.b):
 *   SELECT id, actor_id, action, resource_type, resource_id, conversation_id,
 *          meta_json, created_at, previous_hash, chain_seq
 *   FROM audit_logs
 *   ORDER BY chain_seq DESC, created_at DESC, id DESC
 *   LIMIT 1
 *
 * Returns null when the table is empty (genesis case, REQ-AC-003).
 */
export async function fetchPreviousChainLink(
  client: ChainSelectHandle,
): Promise<PreviousChainLink | null> {
  const rows = await client
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
    .orderBy(desc(auditLogs.chainSeq), desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  const r = rows[0];
  if (!r) {
    return null;
  }
  return {
    previous_hash: r.previousHash,
    chain_seq: r.chainSeq,
    fields: {
      id: r.id,
      actor_id: r.actorId ?? '',
      action: r.action,
      resource_type: r.resourceType,
      resource_id: r.resourceId,
      conversation_id: r.conversationId ?? '',
      meta_json: canonicalizeMetaJson(r.metaJson),
      created_at: r.createdAt.toISOString(),
    },
  };
}
