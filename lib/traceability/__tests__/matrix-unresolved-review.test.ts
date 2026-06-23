// @MX:NOTE [AUTO] C3 regression — unresolved_review false positive in DB path.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-006, AC-03)
// @MX:TEST regression for the C3 defect: deps.nodesById was never passed from
//          the route/page, so the optional chain `!deps.nodesById?.get(...)?.reviewerId`
//          always evaluated `!undefined === true`, flagging EVERY reviewed
//          deliverable as unresolved. This test exercises the DB-path
//          auto-load of referenced nodes and asserts:
//            - completed review (reviewerId set) → NOT flagged
//            - pending/no review (reviewerId null) → flagged

import { evidenceEdges, evidenceNodes } from '@/lib/db/schema';
import { describe, expect, it } from 'vitest';
import { buildMatrix } from '../matrix';

type Row = Record<string, unknown>;

function nameOf(table: unknown): string {
  const sym = (table as Record<symbol, unknown>)[Symbol.for('drizzle:Name')];
  return typeof sym === 'string' ? sym : '?';
}

/**
 * DB stub that serves evidence_nodes + evidence_edges rows from in-memory
 * fixtures. The first evidence_nodes call (loadDeliverables) is filtered to
 * deliverable node types; subsequent calls (loadReferencedNodes) return by id.
 */
function makeDb(opts: {
  nodes: Row[];
  edges: Row[];
}) {
  let nodesCallCount = 0;
  const DELIVERABLE_TYPES = new Set(['message', 'workflow_run', 'risk_item']);
  const select = () => ({
    from: (table: unknown) => {
      const name = nameOf(table);
      if (name === 'evidence_nodes') {
        const callIdx = nodesCallCount++;
        return {
          where: (..._clauses: unknown[]) => {
            // First call: loadDeliverables filters by nodeType IN deliverable types.
            if (callIdx === 0) {
              return opts.nodes.filter((n) => DELIVERABLE_TYPES.has(String(n.nodeType)));
            }
            // Subsequent calls: loadReferencedNodes returns all requested ids.
            return opts.nodes;
          },
        };
      }
      if (name === 'evidence_edges') {
        return {
          where: (..._clauses: unknown[]) => opts.edges,
        };
      }
      return { where: () => [] };
    },
  });
  return { db: { select } as never };
}

describe('C3: unresolved_review false positive (REQ-TRACEABILITY-006, AC-03)', () => {
  it('does NOT flag a deliverable whose reviewer node has reviewerId set (completed review)', async () => {
    const deliverable = {
      id: 'd1',
      orgId: 'org-A',
      projectId: null,
      nodeType: 'workflow_run',
      refTable: 'workflow_runs',
      refId: 'run-1',
      authority: null,
      version: null,
      effectiveDate: null,
      reviewerId: null,
      artifactHash: null,
      createdAt: new Date('2026-01-01'),
      createdBy: 'user-A',
    };
    const reviewerNode = {
      id: 'rev-1',
      orgId: 'org-A',
      projectId: null,
      nodeType: 'expert_review',
      refTable: 'expert_reviews',
      refId: 'er-1',
      authority: null,
      version: null,
      effectiveDate: null,
      reviewerId: '00000000-0000-0000-0000-0000000000AA', // completed review
      artifactHash: null,
      createdAt: new Date('2026-01-01'),
      createdBy: 'user-A',
    };
    const db = makeDb({
      nodes: [deliverable, reviewerNode],
      edges: [
        {
          id: 'e1',
          orgId: 'org-A',
          fromNodeId: 'rev-1',
          toNodeId: 'd1',
          relation: 'reviewed_by',
          createdBy: 'user-A',
          createdAt: new Date('2026-01-01'),
        },
      ],
    });
    const result = await buildMatrix(db.db, { orgId: 'org-A' }, { staleNodeIds: new Set() });
    expect(result.rows).toHaveLength(1);
    // Pre-fix: this was flagged because deps.nodesById was undefined → !undefined === true.
    // Post-fix: the DB path auto-loads reviewerNode and sees reviewerId is set.
    expect(result.rows[0]?.gaps).not.toContain('unresolved_review');
  });

  it('flags a deliverable whose reviewer node has reviewerId null (pending review)', async () => {
    const deliverable = {
      id: 'd1',
      orgId: 'org-A',
      projectId: null,
      nodeType: 'workflow_run',
      refTable: 'workflow_runs',
      refId: 'run-1',
      authority: null,
      version: null,
      effectiveDate: null,
      reviewerId: null,
      artifactHash: null,
      createdAt: new Date('2026-01-01'),
      createdBy: 'user-A',
    };
    const reviewerNode = {
      id: 'rev-1',
      orgId: 'org-A',
      projectId: null,
      nodeType: 'expert_review',
      refTable: 'expert_reviews',
      refId: 'er-1',
      authority: null,
      version: null,
      effectiveDate: null,
      reviewerId: null, // pending — no reviewer assigned
      artifactHash: null,
      createdAt: new Date('2026-01-01'),
      createdBy: 'user-A',
    };
    const db = makeDb({
      nodes: [deliverable, reviewerNode],
      edges: [
        {
          id: 'e1',
          orgId: 'org-A',
          fromNodeId: 'rev-1',
          toNodeId: 'd1',
          relation: 'reviewed_by',
          createdBy: 'user-A',
          createdAt: new Date('2026-01-01'),
        },
      ],
    });
    const result = await buildMatrix(db.db, { orgId: 'org-A' }, { staleNodeIds: new Set() });
    expect(result.rows).toHaveLength(1);
    // A pending review (reviewerId null) SHOULD be flagged.
    expect(result.rows[0]?.gaps).toContain('unresolved_review');
  });

  it('does NOT flag a deliverable with no reviewed_by edge', async () => {
    const deliverable = {
      id: 'd1',
      orgId: 'org-A',
      projectId: null,
      nodeType: 'workflow_run',
      refTable: 'workflow_runs',
      refId: 'run-1',
      authority: null,
      version: null,
      effectiveDate: null,
      reviewerId: null,
      artifactHash: null,
      createdAt: new Date('2026-01-01'),
      createdBy: 'user-A',
    };
    const db = makeDb({
      nodes: [deliverable],
      edges: [], // no review edge at all
    });
    const result = await buildMatrix(db.db, { orgId: 'org-A' }, { staleNodeIds: new Set() });
    expect(result.rows).toHaveLength(1);
    // No review edge → no unresolved_review flag (but missing_citation will be present).
    expect(result.rows[0]?.gaps).not.toContain('unresolved_review');
  });
});
