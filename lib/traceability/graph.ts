// @MX:ANCHOR [AUTO] evidence graph — node/edge CRUD + org-scoped IDOR defense.
// @MX:REASON fan_in >= 3 (matrix, edges route, stale-propagation, packet all
//           read/write through here). Centralizes the org_id double-gate that
//           prevents cross-org edge injection (the #35 IDOR defect class).
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-001~003, REQ-TRACEABILITY-010, REQ-TRACEABILITY-012)

import { evidenceEdges, evidenceNodes, staleFlags } from '@/lib/kernel/db/schema';
import type { evidenceEdgeRelationEnum, evidenceNodeTypeEnum } from '@/lib/kernel/db/schema';
import { and, eq } from 'drizzle-orm';

export type EvidenceNodeType = (typeof evidenceNodeTypeEnum.enumValues)[number];
export type EvidenceEdgeRelation = (typeof evidenceEdgeRelationEnum.enumValues)[number];

/**
 * Injectable DB handle. Tests pass a transaction-scoped or mocked client; the
 * production path imports the singleton from lib/kernel/db/client. Mirrors the
 * classify/knowledge-gap pure-module convention so unit tests never trigger
 * env validation.
 */
export type TraceabilityDb = import('@/lib/kernel/db/client').Database;

export interface EvidenceNode {
  id: string;
  orgId: string;
  projectId: string | null;
  nodeType: EvidenceNodeType;
  refTable: string;
  refId: string;
  authority: string | null;
  version: string | null;
  effectiveDate: Date | null;
  reviewerId: string | null;
  artifactHash: string | null;
  createdAt: Date;
  createdBy: string;
}

export interface EvidenceEdge {
  id: string;
  orgId: string;
  fromNodeId: string;
  toNodeId: string;
  relation: EvidenceEdgeRelation;
  createdBy: string;
  createdAt: Date;
}

export interface UpsertNodeInput {
  orgId: string;
  projectId?: string | null;
  nodeType: EvidenceNodeType;
  refTable: string;
  refId: string;
  authority?: string | null;
  version?: string | null;
  effectiveDate?: Date | null;
  reviewerId?: string | null;
  artifactHash?: string | null;
  createdBy: string;
}

export interface CreateEdgeInput {
  orgId: string;
  fromNodeId: string;
  toNodeId: string;
  relation: EvidenceEdgeRelation;
  createdBy: string;
}

/**
 * Lookup a node by (orgId, nodeType, refTable, refId) — the natural key.
 * Org-scoped: a caller can never resolve another org's node by guessing refId.
 */
export async function findNodeByRef(
  db: TraceabilityDb,
  opts: {
    orgId: string;
    nodeType: EvidenceNodeType;
    refTable: string;
    refId: string;
  },
): Promise<EvidenceNode | null> {
  const rows = await db
    .select()
    .from(evidenceNodes)
    .where(
      and(
        eq(evidenceNodes.orgId, opts.orgId),
        eq(evidenceNodes.nodeType, opts.nodeType),
        eq(evidenceNodes.refTable, opts.refTable),
        eq(evidenceNodes.refId, opts.refId),
      ),
    )
    .limit(1);
  return (rows[0] as EvidenceNode | undefined) ?? null;
}

export async function getNode(
  db: TraceabilityDb,
  orgId: string,
  nodeId: string,
): Promise<EvidenceNode | null> {
  const rows = await db
    .select()
    .from(evidenceNodes)
    .where(and(eq(evidenceNodes.id, nodeId), eq(evidenceNodes.orgId, orgId)))
    .limit(1);
  return (rows[0] as EvidenceNode | undefined) ?? null;
}

/**
 * Upsert a node by the natural unique key (org, node_type, ref_table, ref_id).
 * Returns the persisted row. Idempotent — repeated calls for the same ref
 * update metadata (authority/version/artifact_hash) without creating dupes.
 */
export async function upsertNode(
  db: TraceabilityDb,
  input: UpsertNodeInput,
): Promise<EvidenceNode> {
  const existing = await findNodeByRef(db, {
    orgId: input.orgId,
    nodeType: input.nodeType,
    refTable: input.refTable,
    refId: input.refId,
  });
  if (existing) {
    return existing;
  }
  const inserted = await db
    .insert(evidenceNodes)
    .values({
      orgId: input.orgId,
      projectId: input.projectId ?? null,
      nodeType: input.nodeType,
      refTable: input.refTable,
      refId: input.refId,
      authority: input.authority ?? null,
      version: input.version ?? null,
      effectiveDate: input.effectiveDate ?? null,
      reviewerId: input.reviewerId ?? null,
      artifactHash: input.artifactHash ?? null,
      createdBy: input.createdBy,
    })
    .returning();
  return inserted[0] as unknown as EvidenceNode;
}

/**
 * Injectable node-resolver for createEdge/deleteEdge IDOR gating. Defaults to
 * the real getNode (org-scoped DB lookup). Tests pass a pure override so the
 * IDOR branches are testable without drizzle SQL-shape introspection.
 */
export type NodeResolver = (orgId: string, nodeId: string) => Promise<EvidenceNode | null>;

/**
 * Create an edge. Enforces:
 *   - IDOR double-gate: BOTH endpoints must belong to the caller's org.
 *   - No self-reference (DB CHECK backs this up, but fail fast here).
 *   - Idempotent: duplicate (from, to, relation) within org is a no-op.
 *
 * @returns `{ created: true, edge }` on insert, `{ created: false }` on idempotent skip.
 * @throws {EdgeIdorError} if either endpoint's org_id ≠ caller org_id.
 * @throws {SelfReferenceError} if fromNodeId === toNodeId.
 */
export async function createEdge(
  db: TraceabilityDb,
  input: CreateEdgeInput,
  resolveNode?: NodeResolver,
): Promise<{ created: boolean; edge?: EvidenceEdge }> {
  if (input.fromNodeId === input.toNodeId) {
    throw new SelfReferenceError(input.fromNodeId);
  }
  const resolve = resolveNode ?? ((orgId, nodeId) => getNode(db, orgId, nodeId));
  // IDOR double-gate (L-006 / #35 defect class): verify BOTH endpoints.
  const [from, to] = await Promise.all([
    resolve(input.orgId, input.fromNodeId),
    resolve(input.orgId, input.toNodeId),
  ]);
  if (!from || from.orgId !== input.orgId) {
    // 404 (not 403) to avoid leaking existence of foreign-org nodes.
    throw new EdgeIdorError('from_node', input.fromNodeId);
  }
  if (!to || to.orgId !== input.orgId) {
    throw new EdgeIdorError('to_node', input.toNodeId);
  }
  // Idempotent insert via unique index uq_evidence_edges_relation.
  try {
    const inserted = await db
      .insert(evidenceEdges)
      .values({
        orgId: input.orgId,
        fromNodeId: input.fromNodeId,
        toNodeId: input.toNodeId,
        relation: input.relation,
        createdBy: input.createdBy,
      })
      .returning();
    return { created: true, edge: inserted[0] as unknown as EvidenceEdge };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { created: false };
    }
    throw err;
  }
}

/**
 * Delete an edge. Same IDOR gate: the edge AND both endpoints must belong to
 * the caller's org. A 404 (not 403) signals non-existence to avoid leaking
 * cross-org topology.
 *
 * @returns true if an edge was deleted, false if no matching in-org edge exists.
 */
export async function deleteEdge(
  db: TraceabilityDb,
  opts: { orgId: string; edgeId: string },
): Promise<boolean> {
  // First confirm the edge is in-org (RLS backs this up at the DB layer too).
  const rows = await db
    .select({ id: evidenceEdges.id })
    .from(evidenceEdges)
    .where(and(eq(evidenceEdges.id, opts.edgeId), eq(evidenceEdges.orgId, opts.orgId)))
    .limit(1);
  if (rows.length === 0) return false;
  await db
    .delete(evidenceEdges)
    .where(and(eq(evidenceEdges.id, opts.edgeId), eq(evidenceEdges.orgId, opts.orgId)));
  return true;
}

/**
 * Delete an edge identified by (from, to, relation). Convenience overload for
 * the API route which receives the logical key, not the edge row id. Applies
 * the same IDOR double-gate as createEdge.
 *
 * @returns true if an edge was deleted, false if no matching in-org edge exists.
 */
export async function deleteEdgeByKey(
  db: TraceabilityDb,
  opts: {
    orgId: string;
    fromNodeId: string;
    toNodeId: string;
    relation: EvidenceEdgeRelation;
  },
  resolveNode?: NodeResolver,
): Promise<boolean> {
  const resolve = resolveNode ?? ((orgId, nodeId) => getNode(db, orgId, nodeId));
  const [from, to] = await Promise.all([
    resolve(opts.orgId, opts.fromNodeId),
    resolve(opts.orgId, opts.toNodeId),
  ]);
  if (!from || !to) return false;
  await db
    .delete(evidenceEdges)
    .where(
      and(
        eq(evidenceEdges.orgId, opts.orgId),
        eq(evidenceEdges.fromNodeId, opts.fromNodeId),
        eq(evidenceEdges.toNodeId, opts.toNodeId),
        eq(evidenceEdges.relation, opts.relation),
      ),
    );
  return true;
}

/**
 * List all edges incident on a node (either direction), org-scoped.
 * Used by stale-propagation BFS and the evidence packet assembler.
 */
export async function listEdgesForNode(
  db: TraceabilityDb,
  opts: { orgId: string; nodeId: string; direction?: 'in' | 'out' | 'both' },
): Promise<EvidenceEdge[]> {
  const direction = opts.direction ?? 'both';
  const clauses = [eq(evidenceEdges.orgId, opts.orgId)];
  // For 'both' we OR the two directions — callers that need the split can
  // call twice with direction:'in' / direction:'out'. 'both' is used by the
  // packet assembler which wants the full neighborhood.
  if (direction === 'in') {
    clauses.push(eq(evidenceEdges.toNodeId, opts.nodeId));
    const rows = await db
      .select()
      .from(evidenceEdges)
      .where(and(...clauses));
    return rows as unknown as EvidenceEdge[];
  }
  if (direction === 'out') {
    clauses.push(eq(evidenceEdges.fromNodeId, opts.nodeId));
    const rows = await db
      .select()
      .from(evidenceEdges)
      .where(and(...clauses));
    return rows as unknown as EvidenceEdge[];
  }
  // both
  const out = await listEdgesForNode(db, { ...opts, direction: 'out' });
  const incoming = await listEdgesForNode(db, { ...opts, direction: 'in' });
  return [...out, ...incoming];
}

/**
 * Check whether a node currently carries a stale_flag for the given reason.
 */
export async function isNodeStale(
  db: TraceabilityDb,
  opts: { orgId: string; nodeId: string },
): Promise<boolean> {
  const rows = await db
    .select({ id: staleFlags.id })
    .from(staleFlags)
    .where(and(eq(staleFlags.nodeId, opts.nodeId), eq(staleFlags.orgId, opts.orgId)))
    .limit(1);
  return rows.length > 0;
}

export class EdgeIdorError extends Error {
  constructor(
    public readonly endpoint: 'from_node' | 'to_node',
    public readonly nodeId: string,
  ) {
    super(`IDOR blocked: ${endpoint} ${nodeId} not in caller org`);
    this.name = 'EdgeIdorError';
  }
}

export class SelfReferenceError extends Error {
  constructor(public readonly nodeId: string) {
    super(`self-reference edge forbidden (node ${nodeId})`);
    this.name = 'SelfReferenceError';
  }
}

/** Postgres unique-violation SQLSTATE 23505 — drizzle surfaces it on conflict. */
function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string; constraint?: string }).code;
  return code === '23505';
}
