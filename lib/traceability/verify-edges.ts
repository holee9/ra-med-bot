// @MX:NOTE [AUTO] verify-edges — REQ-011 replay/eval edge integrity verifier.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-011)
//
// Pure verifier called from the knowledge-gap replay path (and the radar
// delta-sync test harness) to confirm that an answer's cited message_sources
// have corresponding evidence_nodes and are not flagged stale. A broken or
// stale edge fails the replay (passed = false) with a structured reason.

import { evidenceNodes, staleFlags } from '@/lib/kernel/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import type { TraceabilityDb } from './graph';

export interface EdgeRef {
  /** message_sources.id or the ref_id used for the message_source node. */
  messageSourceRefId: string;
}

export interface NodeRef {
  nodeId: string;
  reason: 'missing_node' | 'stale';
}

export interface VerifyEdgesResult {
  intact: boolean;
  brokenEdges: EdgeRef[];
  staleNodes: NodeRef[];
}

/**
 * Verify that every cited message_source for a message has a corresponding
 * evidence_node and none are stale-flagged.
 *
 * @param opts.messageSourceRefIds The ref_id values of the message_sources the
 *        answer cited (typically message_sources.id cast to text).
 */
export async function verifyAnswerEdges(
  db: TraceabilityDb,
  opts: { orgId: string; messageSourceRefIds: string[] },
): Promise<VerifyEdgesResult> {
  if (opts.messageSourceRefIds.length === 0) {
    return { intact: true, brokenEdges: [], staleNodes: [] };
  }

  // Look up evidence_nodes with nodeType='message_source' for these refs.
  const nodes = await db
    .select()
    .from(evidenceNodes)
    .where(
      and(
        eq(evidenceNodes.orgId, opts.orgId),
        eq(evidenceNodes.nodeType, 'message_source'),
        inArray(evidenceNodes.refId, opts.messageSourceRefIds),
      ),
    );

  const foundRefIds = new Set((nodes as unknown as { refId: string }[]).map((n) => n.refId));
  const brokenEdges: EdgeRef[] = [];
  for (const refId of opts.messageSourceRefIds) {
    if (!foundRefIds.has(refId)) {
      brokenEdges.push({ messageSourceRefId: refId });
    }
  }

  // Stale check for the nodes that DO exist.
  const nodeIds = (nodes as unknown as { id: string }[]).map((n) => n.id);
  const staleRows = nodeIds.length
    ? ((await db
        .select({ nodeId: staleFlags.nodeId })
        .from(staleFlags)
        .where(
          and(eq(staleFlags.orgId, opts.orgId), inArray(staleFlags.nodeId, nodeIds)),
        )) as unknown as { nodeId: string }[])
    : [];
  const staleSet = new Set(staleRows.map((r) => r.nodeId));
  const staleNodes: NodeRef[] = (nodes as unknown as { id: string }[])
    .filter((n) => staleSet.has(n.id))
    .map((n) => ({ nodeId: n.id, reason: 'stale' as const }));

  return {
    intact: brokenEdges.length === 0 && staleNodes.length === 0,
    brokenEdges,
    staleNodes,
  };
}
