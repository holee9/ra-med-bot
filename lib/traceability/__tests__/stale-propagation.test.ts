// @MX:NOTE [AUTO] Unit tests for stale-propagation BFS core + DB fan-out.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-009)

import { describe, expect, it } from 'vitest';
import { bfsReachable, propagateStaleFromNode } from '../stale-propagation';

describe('traceability/stale-propagation — bfsReachable (pure)', () => {
  it('returns just the start when the node has no neighbors', () => {
    const adj = new Map([['n1', []]]);
    expect(bfsReachable(adj, 'n1')).toEqual(['n1']);
  });

  it('reaches all downstream nodes across multiple hops', () => {
    // n1 → n2 → n3, and n1 → n4
    const adj = new Map([
      ['n1', ['n2', 'n4']],
      ['n2', ['n3']],
      ['n3', []],
      ['n4', []],
    ]);
    const reached = bfsReachable(adj, 'n1').sort();
    expect(reached).toEqual(['n1', 'n2', 'n3', 'n4']);
  });

  it('terminates on cyclic graphs without infinite loop', () => {
    // n1 → n2 → n1 (cycle), n2 → n3
    const adj = new Map([
      ['n1', ['n2']],
      ['n2', ['n1', 'n3']],
      ['n3', []],
    ]);
    const reached = bfsReachable(adj, 'n1').sort();
    expect(reached).toEqual(['n1', 'n2', 'n3']);
  });
});

describe('traceability/stale-propagation — propagateStaleFromNode (DB-stubbed)', () => {
  /**
   * Minimal db stub: records stale_flag upserts and serves edges from an
   * adjacency map so the BFS traversal is exercised end-to-end.
   */
  function makeDb(adjacency: Map<string, string[]>) {
    const flags = new Map<string, Set<string>>();
    const edges: { fromNodeId: string; toNodeId: string }[] = [];
    for (const [from, tos] of adjacency) {
      for (const to of tos) edges.push({ fromNodeId: from, toNodeId: to });
    }
    const db = {
      insert: () => ({
        values: (row: { nodeId: string; reason: string }) => ({
          onConflictDoNothing: () => {
            const set = flags.get(row.reason) ?? new Set<string>();
            set.add(row.nodeId);
            flags.set(row.reason, set);
            return undefined;
          },
        }),
      }),
      select: () => ({
        from: () => ({
          where: () => {
            // Return all edges for both directions — the propagate function
            // filters by fromNodeId/toNodeId itself.
            return edges;
          },
        }),
      }),
    } as unknown as Parameters<typeof propagateStaleFromNode>[0];
    return { db, flags };
  }

  it('flags the origin and every reachable neighbor', async () => {
    const { db, flags } = makeDb(
      new Map([
        ['n1', ['n2']],
        ['n2', ['n3']],
        ['n3', []],
      ]),
    );
    const res = await propagateStaleFromNode(db, {
      orgId: 'org',
      sourceNodeId: 'n1',
      reason: 'superseded_source',
    });
    expect(res.affectedNodeIds.sort()).toEqual(['n1', 'n2', 'n3']);
    expect(flags.get('superseded_source')?.size).toBe(3);
  });

  it('does not double-flag a node already flagged for the same reason (idempotent)', async () => {
    const { db, flags } = makeDb(new Map([['n1', []]]));
    await propagateStaleFromNode(db, {
      orgId: 'org',
      sourceNodeId: 'n1',
      reason: 'superseded_source',
    });
    await propagateStaleFromNode(db, {
      orgId: 'org',
      sourceNodeId: 'n1',
      reason: 'superseded_source',
    });
    expect(flags.get('superseded_source')?.size).toBe(1);
  });

  it('invokes onPropagate once with the full affected list', async () => {
    const { db } = makeDb(
      new Map([
        ['n1', ['n2']],
        ['n2', []],
      ]),
    );
    let captured: string[] = [];
    await propagateStaleFromNode(db, {
      orgId: 'org',
      sourceNodeId: 'n1',
      reason: 'superseded_regulation',
      onPropagate: (ids) => {
        captured = ids;
      },
    });
    expect(captured.sort()).toEqual(['n1', 'n2']);
  });
});
