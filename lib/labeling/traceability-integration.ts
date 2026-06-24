// @MX:NOTE [AUTO] REQ-003 — claim ↔ evidence traceability integration.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-003, AC-02)
//
// REUSE (L-002): lib/traceability/graph.ts upsertNode already supports
// arbitrary refTable/refId pairs. We create a 'claim' node per labeling claim
// so the evidence graph links claims → citations (as evidence edges). This
// mirrors how change-control verdicts integrate with traceability.

import { type EvidenceNodeType, type TraceabilityDb, upsertNode } from '@/lib/traceability/graph';

/** refTable constant for labeling claims (traceability node). */
export const LABELING_CLAIM_REF_TABLE = 'labeling_claims';

/**
 * REQ-003: upsert a traceability node for a labeling claim so its citations
 * can be linked as evidence edges (via the existing createEdge API).
 *
 * Returns the node id. Idempotent: re-invoking with the same claim id returns
 * the existing node (upsertNode contract).
 */
export async function upsertClaimTraceabilityNode(params: {
  db: TraceabilityDb;
  orgId: string;
  projectId: string;
  claimId: string;
  claimNodeType: EvidenceNodeType;
  createdBy: string;
}): Promise<string> {
  const node = await upsertNode(params.db, {
    orgId: params.orgId,
    projectId: params.projectId,
    nodeType: params.claimNodeType,
    refTable: LABELING_CLAIM_REF_TABLE,
    refId: params.claimId,
    createdBy: params.createdBy,
  });
  return node.id;
}
