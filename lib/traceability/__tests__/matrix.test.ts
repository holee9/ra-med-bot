// @MX:NOTE [AUTO] Unit tests for matrix aggregation + gap detection (pure path).
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-004, REQ-TRACEABILITY-006, REQ-TRACEABILITY-012)

import { describe, expect, it } from 'vitest';
import type { EvidenceEdge, EvidenceNode } from '../graph';
import { buildMatrix } from '../matrix';

function node(
  id: string,
  nodeType: EvidenceNode['nodeType'],
  refTable: string,
  refId: string,
  extra: Partial<EvidenceNode> = {},
): EvidenceNode {
  return {
    id,
    orgId: 'org-A',
    projectId: null,
    nodeType,
    refTable,
    refId,
    authority: null,
    version: null,
    effectiveDate: null,
    reviewerId: null,
    artifactHash: null,
    createdAt: new Date('2026-01-01'),
    createdBy: 'user-A',
    ...extra,
  };
}

function edge(
  fromNodeId: string,
  toNodeId: string,
  relation: EvidenceEdge['relation'],
): EvidenceEdge {
  return {
    id: `${fromNodeId}-${relation}-${toNodeId}`,
    orgId: 'org-A',
    fromNodeId,
    toNodeId,
    relation,
    createdBy: 'user-A',
    createdAt: new Date('2026-01-01'),
  };
}

describe('traceability/matrix — gap detection (REQ-TRACEABILITY-012)', () => {
  it('flags missing_citation when a deliverable has no derived_from/cites incoming edge', async () => {
    const deliverables = [node('d1', 'workflow_run', 'workflow_runs', 'run-1')];
    const result = await buildMatrix(
      {} as never,
      { orgId: 'org-A' },
      {
        staleNodeIds: new Set(),
        incomingEdgesByTo: new Map(), // no edges for d1
        nodesById: new Map(),
        deliverables,
      },
    );
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    if (!row) return; // length asserted above
    expect(row.gaps).toContain('missing_citation');
    expect(result.summary.withGaps).toBe(1);
  });

  it('does NOT flag missing_citation when a deliverable has a derived_from edge', async () => {
    const source = node('s1', 'source_section', 'source_sections', 'sec-1', {
      authority: 'FDA',
      version: 'A1',
    });
    const deliverable = node('d1', 'workflow_run', 'workflow_runs', 'run-1');
    const result = await buildMatrix(
      {} as never,
      { orgId: 'org-A' },
      {
        staleNodeIds: new Set(),
        incomingEdgesByTo: new Map([['d1', [edge('s1', 'd1', 'derived_from')]]]),
        nodesById: new Map([
          ['s1', source],
          ['d1', deliverable],
        ]),
        deliverables: [deliverable],
      },
    );
    const row = result.rows[0];
    if (!row) return; // length asserted above
    expect(row.gaps).not.toContain('missing_citation');
    expect(row.evidence[0]?.authority).toBe('FDA');
  });

  it('flags stale_source when an upstream evidence node is stale', async () => {
    const source = node('s1', 'source_section', 'source_sections', 'sec-1');
    const deliverable = node('d1', 'workflow_run', 'workflow_runs', 'run-1');
    const result = await buildMatrix(
      {} as never,
      { orgId: 'org-A' },
      {
        staleNodeIds: new Set(['s1']),
        incomingEdgesByTo: new Map([['d1', [edge('s1', 'd1', 'cites')]]]),
        nodesById: new Map([
          ['s1', source],
          ['d1', deliverable],
        ]),
        deliverables: [deliverable],
      },
    );
    const row = result.rows[0];
    if (!row) return; // length asserted above
    expect(row.stale).toBe(true);
    expect(row.gaps).toContain('stale_source');
    expect(result.summary.stale).toBe(1);
  });

  it('stale=only filter narrows to stale rows only', async () => {
    const d1 = node('d1', 'workflow_run', 'workflow_runs', 'run-1');
    const d2 = node('d2', 'workflow_run', 'workflow_runs', 'run-2');
    const result = await buildMatrix(
      {} as never,
      { orgId: 'org-A', stale: 'only' },
      {
        staleNodeIds: new Set(['d2']),
        incomingEdgesByTo: new Map(),
        nodesById: new Map([
          ['d1', d1],
          ['d2', d2],
        ]),
        deliverables: [d1, d2],
      },
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.refId).toBe('run-2');
  });

  it('returns empty rows when no deliverables exist', async () => {
    const result = await buildMatrix(
      {} as never,
      { orgId: 'org-A' },
      {
        staleNodeIds: new Set(),
        incomingEdgesByTo: new Map(),
        nodesById: new Map(),
        deliverables: [],
      },
    );
    expect(result.rows).toEqual([]);
    expect(result.summary.totalRows).toBe(0);
  });
});
