// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-013, AC-06)
// Mocks the model-governance modules + audit so the test never hits the DB.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/model-governance/rlhf-gate', () => ({
  submitRlhfProposal: vi.fn().mockResolvedValue({ changeRequestId: 'cr-1' }),
}));
vi.mock('@/lib/model-governance/rollback', () => ({
  rollbackCombination: vi.fn().mockResolvedValue({ fromId: 'combo-A', toId: 'combo-B' }),
  RollbackError: class RollbackError extends Error {},
}));
vi.mock('@/lib/model-governance/audit-metadata', () => ({
  buildAnswerVersionMetadata: vi.fn((combo) => ({
    approvedCombinationId: combo.id,
    promptVersion: combo.promptVersion,
    promptContentHash: combo.promptContentHash,
    modelProvider: combo.modelProvider,
    modelId: combo.modelId,
    modelVersion: combo.modelVersion,
  })),
}));
vi.mock('@/lib/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { writeAudit } from '@/lib/audit';
import { submitRlhfProposal } from '@/lib/model-governance/rlhf-gate';
import { rollbackCombination } from '@/lib/model-governance/rollback';
import {
  attachAnswerVersionMetadata,
  recordReranking,
  rollbackReranking,
} from '@/lib/rlhf/version-tracker';

describe('recordReranking (REQ-RLHF-013, AC-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls submitRlhfProposal with source=rlhf and writes reranking_proposed audit', async () => {
    const { __resetRerankDedupForTests } = await import('@/lib/rlhf/version-tracker');
    __resetRerankDedupForTests();
    const result = await recordReranking({
      orgId: 'org-1',
      submittedBy: 'user-1',
      lambda: 0.2,
      sectionCount: 42,
      appliedAt: new Date('2026-06-25T00:00:00Z'),
    });

    expect(result.changeRequestId).toBe('cr-1');
    expect(submitRlhfProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        submittedBy: 'user-1',
        proposalText: expect.stringContaining('rlhf-reranking'),
      }),
    );
    // 21 CFR Part 11 audit row — action is reranking_proposed (H-2 rename).
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'reranking_proposed',
        resource_id: 'cr-1',
        meta_json: expect.objectContaining({ source: 'rlhf', lambda: 0.2, section_count: 42 }),
      }),
    );
  });

  it('the audit meta records source=rlhf so regulators can distinguish RLHF re-ranks', async () => {
    const { __resetRerankDedupForTests } = await import('@/lib/rlhf/version-tracker');
    __resetRerankDedupForTests();
    await recordReranking({
      orgId: 'org-1',
      submittedBy: null,
      lambda: 0.3,
      sectionCount: 10,
      appliedAt: new Date('2026-06-25T00:00:00Z'),
    });
    const mock = writeAudit as unknown as {
      mock: { calls: Array<Array<{ action: string; meta_json: { source: string } }>> };
    };
    const call = mock.mock.calls.find((c) => c[0]?.action === 'reranking_proposed');
    expect(call?.[0]?.meta_json?.source).toBe('rlhf');
  });

  // H-2 regression: identical consecutive re-ranks MUST dedup (no duplicate
  // pending change_request, no duplicate audit row). Before the fix every
  // retrieval call inserted a fresh pending_review row — thousands/day.
  it('H-2: identical consecutive calls do NOT create duplicate pending change_requests', async () => {
    const { __resetRerankDedupForTests } = await import('@/lib/rlhf/version-tracker');
    __resetRerankDedupForTests();
    const descriptor = {
      orgId: 'org-dedup',
      submittedBy: 'user-1',
      lambda: 0.2,
      sectionCount: 5,
      appliedAt: new Date('2026-06-25T00:00:00Z'),
    };
    const first = await recordReranking(descriptor);
    const second = await recordReranking(descriptor);
    expect(first.deduped).toBe(false);
    expect(second.deduped).toBe(true);
    expect(submitRlhfProposal).toHaveBeenCalledTimes(1);
  });

  it('H-2: a material change (different lambda) DOES record a fresh change_request', async () => {
    const { __resetRerankDedupForTests } = await import('@/lib/rlhf/version-tracker');
    __resetRerankDedupForTests();
    await recordReranking({
      orgId: 'org-mat',
      submittedBy: 'user-1',
      lambda: 0.2,
      sectionCount: 5,
      appliedAt: new Date('2026-06-25T00:00:00Z'),
    });
    await recordReranking({
      orgId: 'org-mat',
      submittedBy: 'user-1',
      lambda: 0.5, // material weight change
      sectionCount: 5,
      appliedAt: new Date('2026-06-25T00:00:00Z'),
    });
    expect(submitRlhfProposal).toHaveBeenCalledTimes(2);
  });
});

describe('rollbackReranking (REQ-RLHF-013, AC-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls rollbackCombination and writes reranking_rolled_back audit', async () => {
    const result = await rollbackReranking({ orgId: 'org-1', actorId: 'user-1' });
    expect(result).toEqual({ fromId: 'combo-A', toId: 'combo-B' });
    expect(rollbackCombination).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1', actorId: 'user-1' }),
    );
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'reranking_rolled_back',
        resource_id: 'combo-B',
        meta_json: expect.objectContaining({ source: 'rlhf', from_combination_id: 'combo-A' }),
      }),
    );
  });
});

describe('attachAnswerVersionMetadata', () => {
  it('returns null for a null combination (pre-approval bootstrap)', () => {
    expect(attachAnswerVersionMetadata(null)).toBeNull();
  });

  it('builds metadata from an active combination', () => {
    const combo = {
      id: 'combo-1',
      promptVersion: 'v1.2',
      promptContentHash: 'abc123',
      modelProvider: 'anthropic',
      modelId: 'claude',
      modelVersion: '2024',
    } as unknown as Parameters<typeof attachAnswerVersionMetadata>[0];
    const md = attachAnswerVersionMetadata(combo);
    expect(md).not.toBeNull();
    if (md) {
      expect(md.approvedCombinationId).toBe('combo-1');
      expect(md.promptVersion).toBe('v1.2');
    }
  });
});
