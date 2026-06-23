// @MX:ANCHOR [AUTO] evidence-packet assembly — tree traversal + issue surfacing.
// @MX:REASON fan_in >= 2 (packet route + export route). Produces the structured
//           packet that both the viewer UI and the PDF/MD exporter consume.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-007, REQ-TRACEABILITY-006)

import { evidenceEdges, evidenceNodes } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import type { EvidenceEdge, EvidenceNode, TraceabilityDb } from './graph';

export interface PacketIssue {
  kind: 'missing_citation' | 'stale_source' | 'unresolved_review';
  detail: string;
}

export interface EvidencePacketNode {
  id: string;
  nodeType: EvidenceNode['nodeType'];
  refTable: string;
  refId: string;
  authority: string | null;
  version: string | null;
  effectiveDate: Date | null;
  artifactHash: string | null;
  relation: EvidenceEdge['relation'] | 'root';
  stale: boolean;
  children: EvidencePacketNode[];
}

export interface EvidencePacket {
  deliverable: EvidencePacketNode;
  issues: PacketIssue[];
}

/**
 * Assemble an evidence packet for a deliverable node by BFS-traversing
 * incoming edges (upstream evidence) and outgoing edges (downstream
 * reviews/exports). Surfaces missing citations, stale sources, and
 * unresolved reviews (REQ-TRACEABILITY-006).
 *
 * @returns null if the deliverable node is not found in the caller org.
 */
export async function getEvidencePacket(
  db: TraceabilityDb,
  opts: { orgId: string; deliverableId: string; staleNodeIds?: Set<string> },
): Promise<EvidencePacket | null> {
  const rootRows = await db
    .select()
    .from(evidenceNodes)
    .where(and(eq(evidenceNodes.id, opts.deliverableId), eq(evidenceNodes.orgId, opts.orgId)))
    .limit(1);
  const root = rootRows[0] as unknown as EvidenceNode | undefined;
  if (!root) return null;

  const stale = opts.staleNodeIds ?? new Set<string>();

  // BFS upstream: collect all nodes reachable from root via any edge.
  const visited = new Set<string>();
  const nodeMap = new Map<string, EvidenceNode>();
  nodeMap.set(root.id, root);
  const edgeMap = new Map<string, EvidenceEdge[]>(); // nodeId → incident edges

  const queue: string[] = [root.id];
  let cur: string | undefined;
  while (queue.length > 0) {
    cur = queue.shift();
    if (cur === undefined) break;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const edges = await db
      .select()
      .from(evidenceEdges)
      .where(and(eq(evidenceEdges.orgId, opts.orgId), inArray(evidenceEdges.fromNodeId, [cur])));
    const edgesTo = await db
      .select()
      .from(evidenceEdges)
      .where(and(eq(evidenceEdges.orgId, opts.orgId), inArray(evidenceEdges.toNodeId, [cur])));
    const incident = [
      ...(edges as unknown as EvidenceEdge[]),
      ...(edgesTo as unknown as EvidenceEdge[]),
    ];
    edgeMap.set(cur, incident);
    for (const e of incident) {
      const neighborId = e.fromNodeId === cur ? e.toNodeId : e.fromNodeId;
      if (!visited.has(neighborId) && !nodeMap.has(neighborId)) {
        const nRows = await db
          .select()
          .from(evidenceNodes)
          .where(and(eq(evidenceNodes.id, neighborId), eq(evidenceNodes.orgId, opts.orgId)))
          .limit(1);
        const n = nRows[0] as unknown as EvidenceNode | undefined;
        if (n) {
          nodeMap.set(neighborId, n);
          queue.push(neighborId);
        }
      }
    }
  }

  // Build the tree from root, upstream edges become children.
  const buildTree = (
    nodeId: string,
    relation: EvidencePacketNode['relation'],
    seen: Set<string>,
  ): EvidencePacketNode => {
    const n = nodeMap.get(nodeId);
    if (!n) {
      // Should not happen — buildTree is only called with ids already in nodeMap.
      throw new Error(`buildTree: node ${nodeId} missing from nodeMap`);
    }
    const incident = edgeMap.get(nodeId) ?? [];
    const childEdges = incident.filter((e) => e.toNodeId === nodeId && e.fromNodeId !== nodeId);
    const children: EvidencePacketNode[] = [];
    for (const e of childEdges) {
      if (seen.has(e.fromNodeId)) continue;
      seen.add(e.fromNodeId);
      if (nodeMap.has(e.fromNodeId)) {
        children.push(buildTree(e.fromNodeId, e.relation, seen));
      }
    }
    return {
      id: n.id,
      nodeType: n.nodeType,
      refTable: n.refTable,
      refId: n.refId,
      authority: n.authority,
      version: n.version,
      effectiveDate: n.effectiveDate,
      artifactHash: n.artifactHash,
      relation,
      stale: stale.has(n.id),
      children,
    };
  };

  const deliverable = buildTree(root.id, 'root', new Set([root.id]));

  // Issue surfacing (REQ-TRACEABILITY-006).
  const issues: PacketIssue[] = [];
  const upstreamEvidenceEdges = (edgeMap.get(root.id) ?? []).filter(
    (e) => e.toNodeId === root.id && (e.relation === 'derived_from' || e.relation === 'cites'),
  );
  if (upstreamEvidenceEdges.length === 0) {
    issues.push({ kind: 'missing_citation', detail: 'deliverable has no upstream evidence edge' });
  }
  for (const n of nodeMap.values()) {
    if (stale.has(n.id)) {
      issues.push({ kind: 'stale_source', detail: `node ${n.id} flagged stale` });
    }
  }
  const reviewEdge = (edgeMap.get(root.id) ?? []).find((e) => e.relation === 'reviewed_by');
  if (reviewEdge) {
    const reviewer = nodeMap.get(reviewEdge.fromNodeId);
    if (!reviewer?.reviewerId) {
      issues.push({ kind: 'unresolved_review', detail: 'review node has no reviewer_id' });
    }
  }

  return { deliverable, issues };
}
