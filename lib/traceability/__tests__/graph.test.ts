// @MX:NOTE [AUTO] Unit tests for evidence graph CRUD + IDOR defense.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-001, REQ-TRACEABILITY-010)
//
// createEdge/deleteEdge accept an injectable NodeResolver (3rd arg) so the IDOR
// control-flow is exercised without depending on drizzle SQL-shape internals.
// upsertNode/findNodeByRef use an in-memory db stub. Real DB constraints are
// covered separately in integration-real-db.test.ts.

import { describe, expect, it } from 'vitest';
import type { EvidenceNode } from '../graph';
import {
  EdgeIdorError,
  type NodeResolver,
  SelfReferenceError,
  createEdge,
  deleteEdge,
} from '../graph';

const ORG_A = '00000000-0000-0000-0000-000000000001';
const ORG_B = '00000000-0000-0000-0000-000000000002';
const USER_A = '00000000-0000-0000-0000-0000000000a1';
const NODE_A1 = '00000000-0000-0000-0000-0000000000aa';
const NODE_A2 = '00000000-0000-0000-0000-0000000000ab';
const NODE_B1 = '00000000-0000-0000-0000-0000000000ba';

type NodeRow = EvidenceNode;

function nodeFixture(orgId: string, id: string, refId = 'r1'): NodeRow {
  return {
    id,
    orgId,
    projectId: null,
    nodeType: 'source_section',
    refTable: 'source_sections',
    refId,
    authority: null,
    version: null,
    effectiveDate: null,
    reviewerId: null,
    artifactHash: null,
    createdAt: new Date('2026-01-01'),
    createdBy: USER_A,
  };
}

/** Store-backed resolver: returns the node only if orgId matches. */
function storeResolver(store: Map<string, NodeRow>): NodeResolver {
  return async (orgId, nodeId) => {
    const n = store.get(nodeId);
    if (!n || n.orgId !== orgId) return null;
    return n;
  };
}

/** Minimal db stub for the insert / delete chains createEdge issues. */
function edgeDbStub(opts: { uniqueViolate?: boolean } = {}) {
  return {
    insert: () => ({
      values: (row: Record<string, unknown>) => {
        if (opts.uniqueViolate) {
          const err = new Error('unique') as Error & { code?: string };
          err.code = '23505';
          throw err;
        }
        return { returning: () => [row] };
      },
    }),
    delete: () => ({ where: () => undefined }),
    select: () => ({ from: () => ({ where: () => ({ limit: () => [] }) }) }),
  } as unknown as Parameters<typeof createEdge>[0];
}

describe('traceability/graph — createEdge IDOR defense', () => {
  it('creates an edge when both endpoints are in the caller org', async () => {
    const store = new Map<string, NodeRow>([
      [NODE_A1, nodeFixture(ORG_A, NODE_A1, 'r1')],
      [NODE_A2, nodeFixture(ORG_A, NODE_A2, 'r2')],
    ]);
    const res = await createEdge(
      edgeDbStub(),
      {
        orgId: ORG_A,
        fromNodeId: NODE_A1,
        toNodeId: NODE_A2,
        relation: 'cites',
        createdBy: USER_A,
      },
      storeResolver(store),
    );
    expect(res.created).toBe(true);
    expect(res.edge).toBeDefined();
  });

  it('rejects with EdgeIdorError when the to-node belongs to another org', async () => {
    const store = new Map<string, NodeRow>([
      [NODE_A1, nodeFixture(ORG_A, NODE_A1, 'r1')],
      [NODE_B1, nodeFixture(ORG_B, NODE_B1, 'r2')],
    ]);
    await expect(
      createEdge(
        edgeDbStub(),
        {
          orgId: ORG_A,
          fromNodeId: NODE_A1,
          toNodeId: NODE_B1,
          relation: 'cites',
          createdBy: USER_A,
        },
        storeResolver(store),
      ),
    ).rejects.toBeInstanceOf(EdgeIdorError);
  });

  it('rejects with EdgeIdorError when the from-node is missing entirely', async () => {
    const store = new Map<string, NodeRow>([[NODE_A2, nodeFixture(ORG_A, NODE_A2, 'r2')]]);
    await expect(
      createEdge(
        edgeDbStub(),
        {
          orgId: ORG_A,
          fromNodeId: NODE_A1,
          toNodeId: NODE_A2,
          relation: 'cites',
          createdBy: USER_A,
        },
        storeResolver(store),
      ),
    ).rejects.toBeInstanceOf(EdgeIdorError);
  });

  it('rejects self-references before any node lookup', async () => {
    let resolverCalled = false;
    const resolver: NodeResolver = async () => {
      resolverCalled = true;
      return null;
    };
    await expect(
      createEdge(
        edgeDbStub(),
        {
          orgId: ORG_A,
          fromNodeId: NODE_A1,
          toNodeId: NODE_A1,
          relation: 'cites',
          createdBy: USER_A,
        },
        resolver,
      ),
    ).rejects.toBeInstanceOf(SelfReferenceError);
    expect(resolverCalled).toBe(false);
  });

  it('treats a duplicate (from, to, relation) as idempotent (23505 → created:false)', async () => {
    const store = new Map<string, NodeRow>([
      [NODE_A1, nodeFixture(ORG_A, NODE_A1, 'r1')],
      [NODE_A2, nodeFixture(ORG_A, NODE_A2, 'r2')],
    ]);
    const res = await createEdge(
      edgeDbStub({ uniqueViolate: true }),
      {
        orgId: ORG_A,
        fromNodeId: NODE_A1,
        toNodeId: NODE_A2,
        relation: 'cites',
        createdBy: USER_A,
      },
      storeResolver(store),
    );
    expect(res.created).toBe(false);
  });
});

describe('traceability/graph — deleteEdge', () => {
  it('returns false when the edge does not exist in the caller org', async () => {
    const ok = await deleteEdge(edgeDbStub(), { orgId: ORG_A, edgeId: 'edge-x' });
    expect(ok).toBe(false);
  });
});
