// @MX:NOTE [AUTO] Unit tests for evidence-packet tree assembly + issue surfacing.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-006, REQ-TRACEABILITY-007)

import { describe, expect, it } from 'vitest';
import { type EvidencePacket, getEvidencePacket } from '../evidence-packet';
import { packetToExportData } from '../export-packet';

describe('traceability/evidence-packet — getEvidencePacket contract', () => {
  it('returns null when the deliverable node is not found', async () => {
    // Minimal db stub: the root lookup returns no rows → getEvidencePacket
    // returns null before any traversal (REQ-TRACEABILITY-007 contract).
    // Deeper BFS scenarios are covered by integration-real-pipeline.test.ts;
    // this exercises the early-return + the root SELECT chain shape.
    const db = {
      select: () => ({ from: () => ({ where: () => ({ limit: () => [] }) }) }),
    };
    const r = await getEvidencePacket(db as never, { orgId: 'o1', deliverableId: 'missing' });
    expect(r).toBeNull();
  });
});

describe('traceability/export-packet — packetToExportData', () => {
  it('flattens the deliverable + children into titled sections + content', () => {
    const packet: EvidencePacket = {
      deliverable: {
        id: 'd1',
        nodeType: 'workflow_run',
        refTable: 'workflow_runs',
        refId: 'run-1',
        authority: null,
        version: null,
        effectiveDate: null,
        artifactHash: null,
        relation: 'root',
        stale: false,
        children: [
          {
            id: 's1',
            nodeType: 'source_section',
            refTable: 'source_sections',
            refId: 'sec-1',
            authority: 'FDA',
            version: 'A1',
            effectiveDate: null,
            artifactHash: 'abcdef1234567890',
            relation: 'derived_from',
            stale: false,
            children: [],
          },
        ],
      },
      issues: [],
    };
    const data = packetToExportData(packet);
    expect(data.title).toContain('run-1');
    expect(data.sections.length).toBeGreaterThanOrEqual(2);
    const body = data.sections.map((s) => s.body).join('\n');
    expect(body).toContain('sec-1');
    expect(body).toContain('FDA');
    expect(body).toContain('sha256:abcdef123456');
    // The rendered content feeds the MarkdownExporter and must include the same nodes.
    expect(data.content).toContain('run-1');
    expect(data.content).toContain('sec-1');
  });

  it('appends a Compliance Notes section when issues exist', () => {
    const packet: EvidencePacket = {
      deliverable: {
        id: 'd1',
        nodeType: 'message',
        refTable: 'messages',
        refId: 'm-1',
        authority: null,
        version: null,
        effectiveDate: null,
        artifactHash: null,
        relation: 'root',
        stale: false,
        children: [],
      },
      issues: [{ kind: 'missing_citation', detail: 'no upstream evidence' }],
    };
    const data = packetToExportData(packet);
    const notes = data.sections.find((s) => s.heading === 'Compliance Notes');
    expect(notes?.body).toContain('missing_citation');
    expect(data.content).toContain('Compliance Notes');
  });
});
