// @MX:ANCHOR [AUTO] stale-propagation — BFS fan-out of stale_flags along edges.
// @MX:REASON fan_in >= 3 (delta-sync supersession hook, impact route hook,
//           edges route re-evaluation). Centralizes the idempotent fan-out so
//           callers never mark a node stale twice for the same reason.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-009)

import { staleFlags } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import type { EvidenceNode, TraceabilityDb } from './graph';
import { listEdgesForNode } from './graph';
import type { StaleReason } from './stale-reason';

export interface StalePropagationResult {
  /** Node ids that carry a fresh stale_flag after this call (incl. origin). */
  affectedNodeIds: string[];
}

/**
 * BFS-propagate stale_flags from `sourceNodeId` along every incident edge.
 * Idempotent: the unique index uq_stale_flags_node_reason guarantees each
 * (node, reason) pair is flagged exactly once even on concurrent calls.
 *
 * The origin node is flagged first, then each reachable neighbor via the
 * edge list. A visited set prevents infinite loops on cyclic graphs.
 *
 * @param opts.orgId      Caller org (IDOR scope — edges are org-filtered by listEdgesForNode).
 * @param opts.sourceNodeId The superseded node (source_section / regulatory_update).
 * @param opts.reason     superseded_source | superseded_regulation.
 * @param opts.onPropagate Optional callback per affected node (used by the
 *                        audit writer in the API/sync layer to emit a single
 *                        traceability.stale_propagated audit row).
 */
export async function propagateStaleFromNode(
  db: TraceabilityDb,
  opts: {
    orgId: string;
    sourceNodeId: string;
    reason: StaleReason;
    onPropagate?: (affected: string[]) => Promise<void> | void;
  },
): Promise<StalePropagationResult> {
  const visited = new Set<string>();
  const queue: string[] = [opts.sourceNodeId];
  const affected: string[] = [];

  let currentId: string | undefined;
  while (queue.length > 0) {
    currentId = queue.shift();
    if (currentId === undefined) break;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    // Idempotent upsert — ON CONFLICT (node_id, reason) DO NOTHING.
    await db
      .insert(staleFlags)
      .values({
        orgId: opts.orgId,
        nodeId: currentId,
        reason: opts.reason,
        propagatedFromNodeId: currentId === opts.sourceNodeId ? null : opts.sourceNodeId,
      })
      .onConflictDoNothing({
        target: [staleFlags.nodeId, staleFlags.reason],
      });
    affected.push(currentId);

    // Fan out: every incident edge leads to a neighbor that may need flagging.
    const edges = await listEdgesForNode(db, {
      orgId: opts.orgId,
      nodeId: currentId,
      direction: 'both',
    });
    for (const edge of edges) {
      const neighborId = edge.fromNodeId === currentId ? edge.toNodeId : edge.fromNodeId;
      if (!visited.has(neighborId)) {
        queue.push(neighborId);
      }
    }
  }

  if (opts.onPropagate) {
    await opts.onPropagate(affected);
  }
  return { affectedNodeIds: affected };
}

/**
 * Read-side helper: list all node ids currently flagged stale for an org.
 * Used by the matrix to decorate rows.
 */
export async function listStaleNodeIds(db: TraceabilityDb, orgId: string): Promise<Set<string>> {
  const rows = await db
    .select({ nodeId: staleFlags.nodeId })
    .from(staleFlags)
    .where(eq(staleFlags.orgId, orgId));
  return new Set(rows.map((r) => r.nodeId));
}

/**
 * Pure helper exposed for unit tests: given an adjacency list and a start
 * node, return the reachable set. This is the BFS core, factored out so it
 * can be tested without a DB. The DB-backed `propagateStaleFromNode` wraps it.
 */
export function bfsReachable(adjacency: Map<string, string[]>, start: string): string[] {
  const visited = new Set<string>();
  const queue: string[] = [start];
  const out: string[] = [];
  let cur: string | undefined;
  while (queue.length > 0) {
    cur = queue.shift();
    if (cur === undefined) break;
    if (visited.has(cur)) continue;
    visited.add(cur);
    out.push(cur);
    for (const n of adjacency.get(cur) ?? []) {
      if (!visited.has(n)) queue.push(n);
    }
  }
  return out;
}

// Convenience import re-export so callers can import StaleReason from here too.
void and;
void eq;
export type { StaleReason };
export type { EvidenceNode };
