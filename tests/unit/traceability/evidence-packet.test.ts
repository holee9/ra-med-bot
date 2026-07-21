// @MX:NOTE [AUTO] Unit tests for evidence-packet assembly (SPEC-REGULA-TRACEABILITY-001, REQ-TRACEABILITY-006/007).
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-006, REQ-TRACEABILITY-007, Issue #402)
// @MX:REASON REQ-TRACEABILITY-006 gate: getEvidencePacket BFS-traverses the
//   evidence graph and surfaces 3 issue kinds: missing_citation, stale_source,
//   unresolved_review. Tests use a mock db (select/from/where/limit thenable)
//   to exercise each branch without real DB access.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock db schema so the drizzle imports resolve without loading real columns.
vi.mock('@/lib/kernel/db/schema', () => ({
  evidenceNodes: { id: 'id', orgId: 'org_id' },
  evidenceEdges: {
    id: 'id',
    orgId: 'org_id',
    fromNodeId: 'from_node_id',
    toNodeId: 'to_node_id',
    relation: 'relation',
  },
}));

// Mock drizzle-orm operators — return sentinel objects that the mock db ignores.
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ __eq: true, col, val })),
  and: vi.fn((...args) => ({ __and: true, args })),
  inArray: vi.fn((col, vals) => ({ __inArray: true, col, vals })),
}));

// ---------------------------------------------------------------------------
// Mock db builder
// ---------------------------------------------------------------------------
// The mock db simulates drizzle's query builder chain:
//   db.select().from(table).where(...).limit(n) → Promise<row[]>
// We dispatch based on which table is queried:
//   - evidenceNodes lookups: return rows from nodeRows
//   - evidenceEdges lookups: return rows from edgeRows (filtered by the
//     inArray value in the where clause — we extract the node id)

interface MockNode {
  id: string;
  orgId: string;
  projectId: string | null;
  nodeType: string;
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

interface MockEdge {
  id: string;
  orgId: string;
  fromNodeId: string;
  toNodeId: string;
  relation: string;
  createdBy: string;
  createdAt: Date;
}

interface MockDbState {
  nodes: MockNode[];
  edges: MockEdge[];
}

function makeThenable(rows: unknown[]) {
  const p = Promise.resolve(rows) as Promise<unknown[]> & {
    limit: () => Promise<unknown[]>;
  };
  p.limit = () => Promise.resolve(rows);
  return p;
}

function makeMockDb(state: MockDbState) {
  const selectMock = vi.fn((_args?: unknown) => ({
    from: (table: unknown) => ({
      where: (condition: unknown) => {
        // Determine table by reference identity from our mock schema.
        const schema = table as { id: string; orgId?: string };
        // Extract inArray values and all eq values from the `and(...)` condition.
        const cond = condition as { __and?: boolean; args?: unknown[] };
        let inArrayVals: string[] | null = null;
        const eqVals: string[] = [];
        if (cond?.__and && Array.isArray(cond.args)) {
          for (const a of cond.args) {
            const arg = a as { __inArray?: boolean; __eq?: boolean; val?: unknown; vals?: unknown };
            if (arg?.__inArray && Array.isArray(arg.vals)) {
              inArrayVals = arg.vals as string[];
            }
            if (arg?.__eq && typeof arg.val === 'string') {
              eqVals.push(arg.val);
            }
          }
        }

        // evidenceEdges table (has fromNodeId/toNodeId keys in mock)
        if ('fromNodeId' in schema) {
          // Filter edges by inArray value matching fromNodeId or toNodeId.
          if (inArrayVals && inArrayVals.length > 0) {
            const nodeId = inArrayVals[0];
            if (nodeId === undefined) return makeThenable([]);
            const matched = state.edges.filter(
              (e) => e.fromNodeId === nodeId || e.toNodeId === nodeId,
            );
            return makeThenable(matched);
          }
          return makeThenable([]);
        }

        // evidenceNodes table — match by id (the eq val that matches a node id).
        if (inArrayVals && inArrayVals.length > 0) {
          const nodeId = inArrayVals[0];
          if (nodeId === undefined) return makeThenable([]);
          const matched = state.nodes.filter((n) => n.id === nodeId);
          return makeThenable(matched);
        }
        // Try each eq val — the one matching a node id is the lookup key.
        for (const v of eqVals) {
          const matched = state.nodes.filter((n) => n.id === v);
          if (matched.length > 0) return makeThenable(matched);
        }
        // No eq matched a node id — return empty (e.g. root not found).
        return makeThenable([]);
      },
    }),
  }));
  return { select: selectMock } as unknown as import('@/lib/kernel/db/client').Database;
}

function makeNode(overrides: Partial<MockNode> = {}): MockNode {
  return {
    id: 'node-1',
    orgId: 'org-1',
    projectId: null,
    nodeType: 'message',
    refTable: 'messages',
    refId: 'msg-1',
    authority: null,
    version: null,
    effectiveDate: null,
    reviewerId: null,
    artifactHash: null,
    createdAt: new Date('2026-01-01'),
    createdBy: 'user-1',
    ...overrides,
  };
}

function makeEdge(overrides: Partial<MockEdge> = {}): MockEdge {
  return {
    id: 'edge-1',
    orgId: 'org-1',
    fromNodeId: 'node-src',
    toNodeId: 'node-1',
    relation: 'cites',
    createdBy: 'user-1',
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// getEvidencePacket — root not found (returns null)
// ---------------------------------------------------------------------------
describe('getEvidencePacket — root not found', () => {
  it('returns null when deliverable node does not exist', async () => {
    const db = makeMockDb({ nodes: [], edges: [] });
    const { getEvidencePacket } = await import('@/lib/traceability/evidence-packet');
    const result = await getEvidencePacket(db, {
      orgId: 'org-1',
      deliverableId: 'nonexistent',
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getEvidencePacket — single node, no edges (missing_citation issue)
// ---------------------------------------------------------------------------
describe('getEvidencePacket — single node, no edges (REQ-TRACEABILITY-006)', () => {
  it('returns deliverable with no children and missing_citation issue', async () => {
    const root = makeNode({ id: 'root-1', nodeType: 'message' });
    const db = makeMockDb({ nodes: [root], edges: [] });
    const { getEvidencePacket } = await import('@/lib/traceability/evidence-packet');
    const result = await getEvidencePacket(db, {
      orgId: 'org-1',
      deliverableId: 'root-1',
    });
    expect(result).not.toBeNull();
    expect(result?.deliverable.id).toBe('root-1');
    expect(result?.deliverable.relation).toBe('root');
    expect(result?.deliverable.children).toEqual([]);
    expect(result?.issues).toContainEqual({
      kind: 'missing_citation',
      detail: 'deliverable has no upstream evidence edge',
    });
  });

  it('marks deliverable as not stale when not in staleNodeIds', async () => {
    const root = makeNode({ id: 'root-1' });
    const db = makeMockDb({ nodes: [root], edges: [] });
    const { getEvidencePacket } = await import('@/lib/traceability/evidence-packet');
    const result = await getEvidencePacket(db, {
      orgId: 'org-1',
      deliverableId: 'root-1',
    });
    expect(result?.deliverable.stale).toBe(false);
  });

  it('marks deliverable as stale when in staleNodeIds', async () => {
    const root = makeNode({ id: 'root-1' });
    const db = makeMockDb({ nodes: [root], edges: [] });
    const { getEvidencePacket } = await import('@/lib/traceability/evidence-packet');
    const result = await getEvidencePacket(db, {
      orgId: 'org-1',
      deliverableId: 'root-1',
      staleNodeIds: new Set(['root-1']),
    });
    expect(result?.deliverable.stale).toBe(true);
    expect(result?.issues).toContainEqual({
      kind: 'stale_source',
      detail: 'node root-1 flagged stale',
    });
  });

  it('populates node fields from db row', async () => {
    const root = makeNode({
      id: 'root-1',
      nodeType: 'submission_package',
      refTable: 'submissions',
      refId: 'sub-42',
      authority: 'FDA',
      version: 'v2',
      effectiveDate: new Date('2026-03-01'),
      artifactHash: 'abc123',
    });
    const db = makeMockDb({ nodes: [root], edges: [] });
    const { getEvidencePacket } = await import('@/lib/traceability/evidence-packet');
    const result = await getEvidencePacket(db, {
      orgId: 'org-1',
      deliverableId: 'root-1',
    });
    expect(result).not.toBeNull();
    const d = result?.deliverable;
    expect(d?.nodeType).toBe('submission_package');
    expect(d?.refTable).toBe('submissions');
    expect(d?.refId).toBe('sub-42');
    expect(d?.authority).toBe('FDA');
    expect(d?.version).toBe('v2');
    expect(d?.effectiveDate).toEqual(new Date('2026-03-01'));
    expect(d?.artifactHash).toBe('abc123');
  });
});

// ---------------------------------------------------------------------------
// getEvidencePacket — upstream evidence (cites/derived_from)
// ---------------------------------------------------------------------------
describe('getEvidencePacket — upstream evidence edges', () => {
  it('does NOT flag missing_citation when a cites edge exists', async () => {
    const root = makeNode({ id: 'root-1' });
    const src = makeNode({ id: 'src-1', nodeType: 'source_section' });
    const edge = makeEdge({
      id: 'e-1',
      fromNodeId: 'src-1',
      toNodeId: 'root-1',
      relation: 'cites',
    });
    const db = makeMockDb({ nodes: [root, src], edges: [edge] });
    const { getEvidencePacket } = await import('@/lib/traceability/evidence-packet');
    const result = await getEvidencePacket(db, {
      orgId: 'org-1',
      deliverableId: 'root-1',
    });
    expect(result?.issues).not.toContainEqual(
      expect.objectContaining({ kind: 'missing_citation' }),
    );
  });

  it('does NOT flag missing_citation when a derived_from edge exists', async () => {
    const root = makeNode({ id: 'root-1' });
    const src = makeNode({ id: 'src-1' });
    const edge = makeEdge({
      fromNodeId: 'src-1',
      toNodeId: 'root-1',
      relation: 'derived_from',
    });
    const db = makeMockDb({ nodes: [root, src], edges: [edge] });
    const { getEvidencePacket } = await import('@/lib/traceability/evidence-packet');
    const result = await getEvidencePacket(db, {
      orgId: 'org-1',
      deliverableId: 'root-1',
    });
    expect(result?.issues).not.toContainEqual(
      expect.objectContaining({ kind: 'missing_citation' }),
    );
  });

  it('builds child tree from upstream cites edge', async () => {
    const root = makeNode({ id: 'root-1' });
    const src = makeNode({ id: 'src-1', nodeType: 'source_section', authority: 'EU' });
    const edge = makeEdge({
      fromNodeId: 'src-1',
      toNodeId: 'root-1',
      relation: 'cites',
    });
    const db = makeMockDb({ nodes: [root, src], edges: [edge] });
    const { getEvidencePacket } = await import('@/lib/traceability/evidence-packet');
    const result = await getEvidencePacket(db, {
      orgId: 'org-1',
      deliverableId: 'root-1',
    });
    expect(result?.deliverable.children).toHaveLength(1);
    const child = result?.deliverable.children[0];
    expect(child?.id).toBe('src-1');
    expect(child?.relation).toBe('cites');
    expect(child?.authority).toBe('EU');
  });
});

// ---------------------------------------------------------------------------
// getEvidencePacket — unresolved_review issue (REQ-TRACEABILITY-006)
// ---------------------------------------------------------------------------
describe('getEvidencePacket — unresolved_review issue (REQ-TRACEABILITY-006)', () => {
  it('flags unresolved_review when reviewed_by edge exists but reviewer has no reviewerId', async () => {
    const root = makeNode({ id: 'root-1' });
    const reviewer = makeNode({ id: 'rev-1', nodeType: 'expert_review', reviewerId: null });
    const edge = makeEdge({
      fromNodeId: 'rev-1',
      toNodeId: 'root-1',
      relation: 'reviewed_by',
    });
    const db = makeMockDb({ nodes: [root, reviewer], edges: [edge] });
    const { getEvidencePacket } = await import('@/lib/traceability/evidence-packet');
    const result = await getEvidencePacket(db, {
      orgId: 'org-1',
      deliverableId: 'root-1',
    });
    expect(result?.issues).toContainEqual({
      kind: 'unresolved_review',
      detail: 'review node has no reviewer_id',
    });
  });

  it('does NOT flag unresolved_review when reviewer has reviewerId', async () => {
    const root = makeNode({ id: 'root-1' });
    const reviewer = makeNode({ id: 'rev-1', nodeType: 'expert_review', reviewerId: 'user-42' });
    const edge = makeEdge({
      fromNodeId: 'rev-1',
      toNodeId: 'root-1',
      relation: 'reviewed_by',
    });
    // Also add a cites edge so missing_citation is not flagged.
    const citesEdge = makeEdge({
      id: 'e-cites',
      fromNodeId: 'src-1',
      toNodeId: 'root-1',
      relation: 'cites',
    });
    const src = makeNode({ id: 'src-1' });
    const db = makeMockDb({ nodes: [root, reviewer, src], edges: [edge, citesEdge] });
    const { getEvidencePacket } = await import('@/lib/traceability/evidence-packet');
    const result = await getEvidencePacket(db, {
      orgId: 'org-1',
      deliverableId: 'root-1',
    });
    expect(result?.issues).not.toContainEqual(
      expect.objectContaining({ kind: 'unresolved_review' }),
    );
  });
});

// ---------------------------------------------------------------------------
// getEvidencePacket — stale_source issue (REQ-TRACEABILITY-006)
// ---------------------------------------------------------------------------
describe('getEvidencePacket — stale_source issue (REQ-TRACEABILITY-006)', () => {
  it('flags stale_source for each stale node in the graph', async () => {
    const root = makeNode({ id: 'root-1' });
    const src1 = makeNode({ id: 'src-1' });
    const src2 = makeNode({ id: 'src-2' });
    const edge1 = makeEdge({
      id: 'e-1',
      fromNodeId: 'src-1',
      toNodeId: 'root-1',
      relation: 'cites',
    });
    const edge2 = makeEdge({
      id: 'e-2',
      fromNodeId: 'src-2',
      toNodeId: 'root-1',
      relation: 'derived_from',
    });
    const db = makeMockDb({ nodes: [root, src1, src2], edges: [edge1, edge2] });
    const { getEvidencePacket } = await import('@/lib/traceability/evidence-packet');
    const result = await getEvidencePacket(db, {
      orgId: 'org-1',
      deliverableId: 'root-1',
      staleNodeIds: new Set(['src-1', 'src-2']),
    });
    const staleIssues = result?.issues.filter((i) => i.kind === 'stale_source') ?? [];
    expect(staleIssues).toHaveLength(2);
    const details = staleIssues.map((i) => i.detail).sort();
    expect(details).toEqual(['node src-1 flagged stale', 'node src-2 flagged stale']);
  });

  it('marks child nodes as stale when in staleNodeIds', async () => {
    const root = makeNode({ id: 'root-1' });
    const src = makeNode({ id: 'src-1' });
    const edge = makeEdge({
      fromNodeId: 'src-1',
      toNodeId: 'root-1',
      relation: 'cites',
    });
    const db = makeMockDb({ nodes: [root, src], edges: [edge] });
    const { getEvidencePacket } = await import('@/lib/traceability/evidence-packet');
    const result = await getEvidencePacket(db, {
      orgId: 'org-1',
      deliverableId: 'root-1',
      staleNodeIds: new Set(['src-1']),
    });
    expect(result?.deliverable.children[0]?.stale).toBe(true);
    expect(result?.deliverable.stale).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getEvidencePacket — multi-level graph (BFS traversal)
// ---------------------------------------------------------------------------
describe('getEvidencePacket — multi-level BFS traversal', () => {
  it('traverses 2-level upstream graph: root ← cites ← src1 ← derived_from ← src2', async () => {
    const root = makeNode({ id: 'root-1', nodeType: 'message' });
    const src1 = makeNode({ id: 'src-1', nodeType: 'source_section', authority: 'FDA' });
    const src2 = makeNode({ id: 'src-2', nodeType: 'source_section', authority: 'EU' });
    const edge1 = makeEdge({
      id: 'e-1',
      fromNodeId: 'src-1',
      toNodeId: 'root-1',
      relation: 'cites',
    });
    const edge2 = makeEdge({
      id: 'e-2',
      fromNodeId: 'src-2',
      toNodeId: 'src-1',
      relation: 'derived_from',
    });
    const db = makeMockDb({ nodes: [root, src1, src2], edges: [edge1, edge2] });
    const { getEvidencePacket } = await import('@/lib/traceability/evidence-packet');
    const result = await getEvidencePacket(db, {
      orgId: 'org-1',
      deliverableId: 'root-1',
    });
    // root has child src-1 (cites), src-1 has child src-2 (derived_from).
    expect(result?.deliverable.children).toHaveLength(1);
    const child = result?.deliverable.children[0];
    expect(child?.id).toBe('src-1');
    expect(child?.relation).toBe('cites');
    expect(child?.children).toHaveLength(1);
    const grandchild = child?.children[0];
    expect(grandchild?.id).toBe('src-2');
    expect(grandchild?.relation).toBe('derived_from');
  });

  it('handles diamond graph without infinite loop (shared seen set)', async () => {
    // root ← cites ← src1, root ← cites ← src2, src1 ← derived_from ← src2
    // The `seen` Set is shared across the entire buildTree recursion (passed
    // by reference). Root processes src-1 first, recurses, and src-1 adds
    // src-2 to `seen` before root processes its second edge. So root ends up
    // with 1 direct child (src-1), and src-1 has src-2 as its child.
    // The key invariant: no node appears twice in the tree (no infinite loop).
    const root = makeNode({ id: 'root-1' });
    const src1 = makeNode({ id: 'src-1' });
    const src2 = makeNode({ id: 'src-2' });
    const e1 = makeEdge({ id: 'e-1', fromNodeId: 'src-1', toNodeId: 'root-1', relation: 'cites' });
    const e2 = makeEdge({ id: 'e-2', fromNodeId: 'src-2', toNodeId: 'root-1', relation: 'cites' });
    const e3 = makeEdge({
      id: 'e-3',
      fromNodeId: 'src-2',
      toNodeId: 'src-1',
      relation: 'derived_from',
    });
    const db = makeMockDb({ nodes: [root, src1, src2], edges: [e1, e2, e3] });
    const { getEvidencePacket } = await import('@/lib/traceability/evidence-packet');
    const result = await getEvidencePacket(db, {
      orgId: 'org-1',
      deliverableId: 'root-1',
    });
    // Collect all node ids in the tree — each should appear exactly once.
    const allIds: string[] = [];
    function collectIds(node: { id: string; children: (typeof node)[] }): void {
      allIds.push(node.id);
      for (const c of node.children) collectIds(c);
    }
    collectIds(result?.deliverable ?? { id: '', children: [] });
    const idCounts = allIds.reduce<Record<string, number>>((acc, id) => {
      acc[id] = (acc[id] ?? 0) + 1;
      return acc;
    }, {});
    for (const [id, count] of Object.entries(idCounts)) {
      expect(count).toBe(1);
    }
    expect(allIds).toContain('root-1');
    expect(allIds).toContain('src-1');
    expect(allIds).toContain('src-2');
  });
});

// ---------------------------------------------------------------------------
// getEvidencePacket — edge cases
// ---------------------------------------------------------------------------
describe('getEvidencePacket — edge cases', () => {
  it('handles outgoing-only edge (reviewed_by) without missing_citation false negative', async () => {
    // root has only a reviewed_by edge (no cites/derived_from) → missing_citation.
    const root = makeNode({ id: 'root-1' });
    const reviewer = makeNode({ id: 'rev-1', reviewerId: 'user-1' });
    const edge = makeEdge({
      fromNodeId: 'rev-1',
      toNodeId: 'root-1',
      relation: 'reviewed_by',
    });
    const db = makeMockDb({ nodes: [root, reviewer], edges: [edge] });
    const { getEvidencePacket } = await import('@/lib/traceability/evidence-packet');
    const result = await getEvidencePacket(db, {
      orgId: 'org-1',
      deliverableId: 'root-1',
    });
    // reviewed_by is not a citation edge, so missing_citation should still fire.
    expect(result?.issues).toContainEqual({
      kind: 'missing_citation',
      detail: 'deliverable has no upstream evidence edge',
    });
  });

  it('defaults staleNodeIds to empty set when not provided', async () => {
    const root = makeNode({ id: 'root-1' });
    const db = makeMockDb({ nodes: [root], edges: [] });
    const { getEvidencePacket } = await import('@/lib/traceability/evidence-packet');
    const result = await getEvidencePacket(db, {
      orgId: 'org-1',
      deliverableId: 'root-1',
    });
    // No stale issues when staleNodeIds is omitted.
    expect(result?.issues).not.toContainEqual(expect.objectContaining({ kind: 'stale_source' }));
  });
});

// ---------------------------------------------------------------------------
// module exports
// ---------------------------------------------------------------------------
describe('evidence-packet module exports', () => {
  it('exports getEvidencePacket function', async () => {
    const mod = await import('@/lib/traceability/evidence-packet');
    expect(typeof mod.getEvidencePacket).toBe('function');
  });
});
