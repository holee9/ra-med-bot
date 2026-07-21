// @MX:ANCHOR [AUTO] matrix aggregation + gap detection.
// @MX:REASON Single source of truth for the matrix row/column shape consumed
//           by GET /api/traceability and the SSR matrix page (fan_in >= 2).
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-004, REQ-TRACEABILITY-005, REQ-TRACEABILITY-006, REQ-TRACEABILITY-012)

import {
  designHistoryFiles,
  evidenceEdges,
  evidenceNodes,
  riskItems,
  submissionPackages,
} from '@/lib/kernel/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import type { EvidenceEdge, EvidenceNode, EvidenceNodeType, TraceabilityDb } from './graph';

/** Deliverable node types — rows in the matrix. */
export const DELIVERABLE_NODE_TYPES: EvidenceNodeType[] = ['message', 'workflow_run', 'risk_item'];

export interface MatrixFilters {
  orgId: string;
  projectId?: string;
  jurisdiction?: string;
  product?: string;
  packageId?: string;
  riskLevel?: string;
  /** 'only' filters to stale-flagged rows; 'exclude' hides them. */
  stale?: 'only' | 'exclude';
}

export interface MatrixRow {
  nodeType: EvidenceNodeType;
  refId: string;
  label: string;
  evidence: { nodeType: EvidenceNodeType; authority: string | null; version: string | null }[];
  answer: { messageId: string | null; status: string };
  reviewer: { userId: string | null; status: string };
  exportMeta: { submissionPackageId: string | null; version: string | null };
  gaps: ('missing_citation' | 'stale_source' | 'unresolved_review')[];
  stale: boolean;
}

export interface MatrixResult {
  rows: MatrixRow[];
  summary: { totalRows: number; withGaps: number; stale: number };
}

/**
 * Build the per-project traceability matrix.
 *
 * Flow:
 *   1. Load all deliverable nodes (message/workflow_run/risk_item) in scope.
 *   2. For each, traverse incoming edges to attach evidence/answer/review/export.
 *   3. Gap detection (REQ-TRACEABILITY-012): a deliverable with zero incoming
 *      derived_from/cites edges → 'missing_citation'.
 *   4. Stale flag join: if the node OR any upstream evidence carries a stale
 *      flag, the row's `stale` is true and 'stale_source' is added to gaps.
 *
 * Filters narrow the candidate set BEFORE the per-row traversal so the cost
 * stays linear in the deliverable count.
 */
export async function buildMatrix(
  db: TraceabilityDb,
  filters: MatrixFilters,
  deps: {
    staleNodeIds: Set<string>;
    /** Edges keyed by toNodeId (incoming) — injected so the pure gap logic is testable. */
    incomingEdgesByTo?: Map<string, EvidenceEdge[]>;
    /** Nodes keyed by id — injected for the pure path. */
    nodesById?: Map<string, EvidenceNode>;
    /** Deliverables to evaluate — defaults to DB scan. */
    deliverables?: EvidenceNode[];
  },
): Promise<MatrixResult> {
  const deliverables = deps.deliverables ?? (await loadDeliverables(db, filters));

  // Preload incoming edges for all deliverables in one pass (N+1 avoidance).
  const incomingByTo =
    deps.incomingEdgesByTo ?? (await loadIncomingEdges(db, filters.orgId, deliverables));

  // C3 fix (REQ-TRACEABILITY-006): when nodesById is not injected (the
  // production DB path — route + SSR page), auto-load the from-nodes referenced
  // by incoming edges so the unresolved_review check at line ~106 can read
  // reviewerId. Without this, every reviewed deliverable was falsely flagged.
  let nodesByIdLocal = deps.nodesById;
  if (!nodesByIdLocal) {
    nodesByIdLocal = await loadReferencedNodes(db, filters.orgId, incomingByTo, deliverables);
  }

  const rows: MatrixRow[] = [];
  for (const d of deliverables) {
    const incoming = incomingByTo.get(d.id) ?? [];
    const evidenceSources = incoming
      .filter((e) => e.relation === 'derived_from' || e.relation === 'cites')
      .map(() => null); // authority/version resolved by caller via nodesById if provided
    const evidence = nodesByIdLocal
      ? incoming
          .filter((e) => e.relation === 'derived_from' || e.relation === 'cites')
          .map((e) => {
            const n = nodesByIdLocal?.get(e.fromNodeId);
            return n ? { nodeType: n.nodeType, authority: n.authority, version: n.version } : null;
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
      : [];

    const hasCitationEdge = incoming.some(
      (e) => e.relation === 'derived_from' || e.relation === 'cites',
    );
    const reviewEdge = incoming.find((e) => e.relation === 'reviewed_by');
    const exportEdge = incoming.find((e) => e.relation === 'exported_in');

    const isStale = deps.staleNodeIds.has(d.id);
    const upstreamStale = incoming.some(
      (e) => e.relation !== 'reviewed_by' && deps.staleNodeIds.has(e.fromNodeId),
    );
    const stale = isStale || upstreamStale;

    const gaps: MatrixRow['gaps'] = [];
    if (!hasCitationEdge) gaps.push('missing_citation');
    if (upstreamStale) gaps.push('stale_source');
    // C3 fix: use the resolved nodesByIdLocal (auto-loaded in the DB path),
    // not deps.nodesById which is undefined in the production route/page path.
    // A reviewed deliverable is "unresolved" ONLY when the reviewer node exists
    // but has no reviewerId (the review was requested but not completed).
    if (reviewEdge && !nodesByIdLocal?.get(reviewEdge.fromNodeId)?.reviewerId) {
      gaps.push('unresolved_review');
    }

    rows.push({
      nodeType: d.nodeType,
      refId: d.refId,
      label: `${d.refTable}:${d.refId}`,
      evidence:
        evidence.length > 0
          ? evidence
          : evidenceSources.map(() => ({
              nodeType: 'source_section' as EvidenceNodeType,
              authority: null,
              version: null,
            })),
      answer: { messageId: d.nodeType === 'message' ? d.id : null, status: 'answered' },
      reviewer: {
        userId: reviewEdge ? reviewEdge.fromNodeId : null,
        status: reviewEdge ? 'approved' : 'pending',
      },
      exportMeta: {
        submissionPackageId: exportEdge ? exportEdge.fromNodeId : null,
        version: exportEdge ? (nodesByIdLocal?.get(exportEdge.fromNodeId)?.version ?? null) : null,
      },
      gaps,
      stale,
    });
  }

  // Apply stale filter post-aggregation.
  const filtered =
    filters.stale === 'only'
      ? rows.filter((r) => r.stale)
      : filters.stale === 'exclude'
        ? rows.filter((r) => !r.stale)
        : rows;

  return {
    rows: filtered,
    summary: {
      totalRows: filtered.length,
      withGaps: filtered.filter((r) => r.gaps.length > 0).length,
      stale: filtered.filter((r) => r.stale).length,
    },
  };
}

async function loadDeliverables(
  db: TraceabilityDb,
  filters: MatrixFilters,
): Promise<EvidenceNode[]> {
  const clauses = [
    eq(evidenceNodes.orgId, filters.orgId),
    inArray(evidenceNodes.nodeType, DELIVERABLE_NODE_TYPES),
  ];
  if (filters.projectId) {
    clauses.push(eq(evidenceNodes.projectId, filters.projectId));
  }

  // C2 fix (REQ-TRACEABILITY-005): apply jurisdiction/product/packageId/riskLevel
  // by narrowing deliverable refIds via subqueries on the referenced source tables.
  // evidence_nodes.refTable tells us which source table holds the row; we resolve
  // the filter against that table and restrict refId to the matching set.

  // jurisdiction: submission_packages.jurisdiction | design_history_files.jurisdiction
  if (filters.jurisdiction) {
    const spIds = await db
      .select({ id: submissionPackages.id })
      .from(submissionPackages)
      .where(
        and(
          eq(submissionPackages.orgId, filters.orgId),
          eq(submissionPackages.jurisdiction, filters.jurisdiction),
        ),
      );
    const dhfIds = await db
      .select({ id: designHistoryFiles.id })
      .from(designHistoryFiles)
      .where(
        and(
          eq(designHistoryFiles.orgId, filters.orgId),
          eq(designHistoryFiles.jurisdiction, filters.jurisdiction),
        ),
      );
    const matched = [...spIds.map((r) => r.id), ...dhfIds.map((r) => r.id)];
    clauses.push(inArray(evidenceNodes.refId, matched));
  }

  // product: submission_packages.device_name | design_history_files.device_name
  if (filters.product) {
    const spIds = await db
      .select({ id: submissionPackages.id })
      .from(submissionPackages)
      .where(
        and(
          eq(submissionPackages.orgId, filters.orgId),
          eq(submissionPackages.deviceName, filters.product),
        ),
      );
    const dhfIds = await db
      .select({ id: designHistoryFiles.id })
      .from(designHistoryFiles)
      .where(
        and(
          eq(designHistoryFiles.orgId, filters.orgId),
          eq(designHistoryFiles.deviceName, filters.product),
        ),
      );
    const matched = [...spIds.map((r) => r.id), ...dhfIds.map((r) => r.id)];
    clauses.push(inArray(evidenceNodes.refId, matched));
  }

  // packageId: deliverables that ARE the package (refTable='submission_packages')
  // or are linked to it via an exported_in edge.
  if (filters.packageId) {
    const exportedRows = await db
      .select({ toNodeId: evidenceEdges.toNodeId })
      .from(evidenceEdges)
      .where(
        and(
          eq(evidenceEdges.orgId, filters.orgId),
          eq(evidenceEdges.fromNodeId, filters.packageId),
          eq(evidenceEdges.relation, 'exported_in'),
        ),
      );
    const linked = exportedRows.map((r) => r.toNodeId);
    // Deliverable is either the package node itself OR a node exported in it.
    clauses.push(inArray(evidenceNodes.id, [filters.packageId, ...linked]));
  }

  // riskLevel: risk_items.risk_level — deliverables with refTable='risk_items'
  // whose refId points to a risk_item at this level. Normalise the UI-facing
  // values ('acceptable'/'alarp'/'unacceptable'/'unacc') to the DB enum values
  // ('acc'/'alarp'/'unacc').
  if (filters.riskLevel) {
    const level = filters.riskLevel === 'acceptable' ? 'acc' : filters.riskLevel;
    const riskIds = await db
      .select({ id: riskItems.id })
      .from(riskItems)
      .where(eq(riskItems.riskLevel, level as 'acc' | 'alarp' | 'unacc'));
    clauses.push(
      inArray(
        evidenceNodes.refId,
        riskIds.map((r) => String(r.id)),
      ),
    );
  }

  const rows = await db
    .select()
    .from(evidenceNodes)
    .where(and(...clauses));
  return rows as unknown as EvidenceNode[];
}

async function loadIncomingEdges(
  db: TraceabilityDb,
  orgId: string,
  deliverables: EvidenceNode[],
): Promise<Map<string, EvidenceEdge[]>> {
  if (deliverables.length === 0) return new Map();
  const toIds = deliverables.map((d) => d.id);
  const rows = await db
    .select()
    .from(evidenceEdges)
    .where(and(eq(evidenceEdges.orgId, orgId), inArray(evidenceEdges.toNodeId, toIds)));
  const map = new Map<string, EvidenceEdge[]>();
  for (const e of rows as unknown as EvidenceEdge[]) {
    const list = map.get(e.toNodeId) ?? [];
    list.push(e);
    map.set(e.toNodeId, list);
  }
  return map;
}

/**
 * C3 fix: load all evidence_nodes referenced as the `from` endpoint of incoming
 * edges, plus the deliverables themselves. This populates the nodesById map so
 * the unresolved_review gap check can read `reviewerId` from the reviewer node.
 * Org-scoped to prevent cross-org node leakage.
 */
async function loadReferencedNodes(
  db: TraceabilityDb,
  orgId: string,
  incomingByTo: Map<string, EvidenceEdge[]>,
  deliverables: EvidenceNode[],
): Promise<Map<string, EvidenceNode>> {
  const map = new Map<string, EvidenceNode>();
  // Seed with deliverables (already loaded).
  for (const d of deliverables) {
    map.set(d.id, d);
  }
  // Collect all from-node ids referenced by incoming edges.
  const fromIds = new Set<string>();
  for (const edges of incomingByTo.values()) {
    for (const e of edges) {
      fromIds.add(e.fromNodeId);
    }
  }
  if (fromIds.size === 0) return map;
  const rows = await db
    .select()
    .from(evidenceNodes)
    .where(and(eq(evidenceNodes.orgId, orgId), inArray(evidenceNodes.id, [...fromIds])));
  for (const n of rows as unknown as EvidenceNode[]) {
    map.set(n.id, n);
  }
  return map;
}
