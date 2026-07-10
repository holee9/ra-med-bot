// @MX:NOTE [AUTO] Unit tests for stale-propagation hooks (coverage coverage 402).
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-009, AC-05)
//
// The hooks orchestrate findNodeByRef / upsertNode / propagateStaleFromNode /
// writeAudit. We mock all four so the control flow (no-op when no node,
// propagate + audit when node exists, non-blocking error swallow) is exercised
// without touching drizzle SQL shape. Real DB wiring is covered by
// integration-real-pipeline.test.ts.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({ db: {} }));
vi.mock('@/lib/audit', () => ({ writeAudit: vi.fn() }));
vi.mock('../graph', () => ({
  findNodeByRef: vi.fn(),
  upsertNode: vi.fn(),
}));
vi.mock('../stale-propagation', () => ({ propagateStaleFromNode: vi.fn() }));

import { writeAudit } from '@/lib/audit';
import { findNodeByRef, upsertNode } from '../graph';
import { onRegulatoryUpdateSuperseded, onSourceSectionSuperseded } from '../hooks';
import { propagateStaleFromNode } from '../stale-propagation';

const ORG = '00000000-0000-0000-0000-000000000001';
const ACTOR = '00000000-0000-0000-0000-0000000000a1';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('onSourceSectionSuperseded (hooks.ts — REQ-TRACEABILITY-009)', () => {
  it('is a no-op (propagated:false) when no evidence_node exists yet', async () => {
    vi.mocked(findNodeByRef).mockResolvedValue(null);
    const r = await onSourceSectionSuperseded({ orgId: ORG, refId: 'sec-1', actorId: ACTOR });
    expect(r).toEqual({ propagated: false, affectedCount: 0 });
    expect(propagateStaleFromNode).not.toHaveBeenCalled();
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it('propagates stale_flags + emits traceability.stale_propagated audit when node exists', async () => {
    vi.mocked(findNodeByRef).mockResolvedValue({ id: 'n1', orgId: ORG } as never);
    vi.mocked(propagateStaleFromNode).mockResolvedValue({
      affectedNodeIds: ['n2', 'n3'],
    } as never);
    const r = await onSourceSectionSuperseded({ orgId: ORG, refId: 'sec-1', actorId: ACTOR });
    expect(r).toEqual({ propagated: true, affectedCount: 2 });
    expect(propagateStaleFromNode).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orgId: ORG, sourceNodeId: 'n1', reason: 'superseded_source' }),
    );
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'traceability.stale_propagated',
        resource_type: 'evidence_node',
        resource_id: 'n1',
      }),
    );
  });

  it('NEVER throws — logs a propagationFailed audit and returns propagated:false on error', async () => {
    vi.mocked(findNodeByRef).mockRejectedValue(new Error('db down'));
    const r = await onSourceSectionSuperseded({ orgId: ORG, refId: 'sec-1', actorId: ACTOR });
    expect(r).toEqual({ propagated: false, affectedCount: 0 });
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'traceability.stale_propagated',
        meta_json: expect.objectContaining({ propagationFailed: true, error: 'db down' }),
      }),
    );
  });
});

describe('onRegulatoryUpdateSuperseded (hooks.ts — impact #41 path)', () => {
  it('upserts the evidence_node if absent, then propagates with reason superseded_regulation', async () => {
    vi.mocked(findNodeByRef).mockResolvedValue(null);
    vi.mocked(upsertNode).mockResolvedValue({ id: 'n2', orgId: ORG } as never);
    vi.mocked(propagateStaleFromNode).mockResolvedValue({ affectedNodeIds: ['n3'] } as never);
    const r = await onRegulatoryUpdateSuperseded({
      orgId: ORG,
      refId: 'ru-1',
      createdBy: ACTOR,
      actorId: ACTOR,
    });
    expect(r).toEqual({ propagated: true, affectedCount: 1 });
    expect(upsertNode).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ nodeType: 'regulatory_update', refId: 'ru-1' }),
    );
    expect(propagateStaleFromNode).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sourceNodeId: 'n2', reason: 'superseded_regulation' }),
    );
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ resource_id: 'n2' }));
  });

  it('reuses the existing node when findNodeByRef returns one (no upsert)', async () => {
    vi.mocked(findNodeByRef).mockResolvedValue({ id: 'n-existing', orgId: ORG } as never);
    vi.mocked(propagateStaleFromNode).mockResolvedValue({ affectedNodeIds: [] } as never);
    const r = await onRegulatoryUpdateSuperseded({
      orgId: ORG,
      refId: 'ru-1',
      createdBy: ACTOR,
      actorId: ACTOR,
    });
    expect(r).toEqual({ propagated: true, affectedCount: 0 });
    expect(upsertNode).not.toHaveBeenCalled();
  });

  it('NEVER throws — logs propagationFailed audit on error', async () => {
    vi.mocked(findNodeByRef).mockRejectedValue(new Error('graph corrupt'));
    const r = await onRegulatoryUpdateSuperseded({
      orgId: ORG,
      refId: 'ru-1',
      createdBy: ACTOR,
      actorId: ACTOR,
    });
    expect(r).toEqual({ propagated: false, affectedCount: 0 });
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        meta_json: expect.objectContaining({ propagationFailed: true }),
      }),
    );
  });
});
