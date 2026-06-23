// @MX:NOTE [AUTO] Typed client + response shapes for the traceability API.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-004..008, REQ-012)
//
// Shapes mirror the backend contracts EXACTLY:
//   - MatrixRow.exportMeta (not `export`) — see lib/traceability/matrix.ts
//   - MatrixRow.gaps tuple + MatrixRow.stale boolean
//   - EvidencePacket.deliverable is a recursive tree (EvidencePacketNode.children)
//   - EvidencePacket.issues surfaces missing_citation / stale_source / unresolved_review
//
// These types are shared between the RSC pages (server-side fetch) and the
// client islands (edge manage / packet export). The server path passes the
// already-fetched data as props to avoid a double fetch.

import type { EvidenceEdgeRelation, EvidenceNodeType } from './graph';

// ---------------------------------------------------------------------------
// Response shapes — match lib/traceability/matrix.ts and evidence-packet.ts.
// ---------------------------------------------------------------------------

export type MatrixGapKind = 'missing_citation' | 'stale_source' | 'unresolved_review';

export interface MatrixRow {
  nodeType: EvidenceNodeType;
  refId: string;
  label: string;
  evidence: { nodeType: EvidenceNodeType; authority: string | null; version: string | null }[];
  answer: { messageId: string | null; status: string };
  reviewer: { userId: string | null; status: string };
  exportMeta: { submissionPackageId: string | null; version: string | null };
  gaps: MatrixGapKind[];
  stale: boolean;
}

export interface MatrixResult {
  rows: MatrixRow[];
  summary: { totalRows: number; withGaps: number; stale: number };
}

export interface MatrixFilters {
  projectId?: string;
  jurisdiction?: string;
  product?: string;
  packageId?: string;
  riskLevel?: 'acceptable' | 'alarp' | 'unacceptable' | 'unacc';
  stale?: 'only' | 'exclude';
}

export type PacketIssueKind = 'missing_citation' | 'stale_source' | 'unresolved_review';

export interface PacketIssue {
  kind: PacketIssueKind;
  detail: string;
}

export interface EvidencePacketNode {
  id: string;
  nodeType: EvidenceNodeType;
  refTable: string;
  refId: string;
  authority: string | null;
  version: string | null;
  effectiveDate: string | null; // ISO — JSON-serialized over the wire
  artifactHash: string | null;
  relation: EvidenceEdgeRelation | 'root';
  stale: boolean;
  children: EvidencePacketNode[];
}

export interface EvidencePacket {
  deliverable: EvidencePacketNode;
  issues: PacketIssue[];
}

// ---------------------------------------------------------------------------
// Edge write contract — matches app/api/traceability/edges/route.ts Zod schema.
// ---------------------------------------------------------------------------

export const EDGE_RELATIONS = [
  'derived_from',
  'cites',
  'reviewed_by',
  'exported_in',
  'mitigates',
  'satisfies',
] as const satisfies readonly EvidenceEdgeRelation[];

export type EdgeRelation = (typeof EDGE_RELATIONS)[number];

export interface EdgeWriteInput {
  fromNodeId: string;
  toNodeId: string;
  relation: EdgeRelation;
  action: 'create' | 'delete';
  staleReason?: 'superseded_source' | 'superseded_regulation';
}

// ---------------------------------------------------------------------------
// Client functions — thin fetch wrappers used by client islands.
// The RSC pages call the lib helpers directly (buildMatrix / getEvidencePacket)
// to avoid a self-fetch; islands use these for mutations + downloads.
// ---------------------------------------------------------------------------

/**
 * POST /api/traceability/edges — create or delete an edge (ra-lead only).
 * Returns `{ created: boolean }` for create, `{ deleted: boolean }` for delete.
 */
export async function writeEdge(
  input: EdgeWriteInput,
): Promise<{ created?: boolean; deleted?: boolean }> {
  const res = await fetch('/api/traceability/edges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * GET /api/traceability/[deliverableId]/export?format=pdf|md — triggers a
 * browser download of the evidence packet. The route responds with a file
 * attachment (Content-Disposition: attachment).
 */
export async function exportPacket(deliverableId: string, format: 'pdf' | 'md'): Promise<void> {
  const res = await fetch(
    `/api/traceability/${encodeURIComponent(deliverableId)}/export?format=${format}`,
    { method: 'GET' },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  // Pull the filename the server attached; fall back to a sensible default.
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const filename = match?.[1] ?? `evidence-packet-${deliverableId}.${format}`;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
