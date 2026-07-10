// @MX:NOTE [AUTO] Unit tests for access.ts — IDOR / org-scoping guards (REQ-MODELGOV-001).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71)
// @MX:REASON Every route under app/api/model-governance/ MUST verify the requested
//   resource belongs to the caller's org. assertPromptAccess / assertModelPinAccess
//   return boolean; assertChangeRequestAccess returns the row or null.
//   Chain: select().from().where().limit(1) → Promise<array>

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock db chain: select().from().where().limit(n) → Promise<array>
// The where() returns an object with a limit() method that resolves to the
// result array. This mirrors the registry.test.ts dedup-path pattern.
// ---------------------------------------------------------------------------
let selectResult: unknown[] = [];

function makeMockDb() {
  const selectMock = () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(selectResult),
      }),
    }),
  });
  return { select: vi.fn(selectMock) };
}

beforeEach(() => {
  selectResult = [];
  vi.resetModules();
  vi.doMock('@/lib/db/client', () => ({ db: makeMockDb() }));
});

// ---------------------------------------------------------------------------
// assertPromptAccess
// ---------------------------------------------------------------------------
describe('assertPromptAccess (REQ-MODELGOV-001 — org-scoping guard)', () => {
  it('returns true when prompt belongs to org', async () => {
    selectResult = [{ id: 'prompt-1' }];
    const { assertPromptAccess } = await import('@/lib/model-governance/access');
    const result = await assertPromptAccess('prompt-1', 'org-1');
    expect(result).toBe(true);
  });

  it('returns false when prompt does not belong to org (cross-org)', async () => {
    selectResult = [];
    const { assertPromptAccess } = await import('@/lib/model-governance/access');
    const result = await assertPromptAccess('prompt-other-org', 'org-1');
    expect(result).toBe(false);
  });

  it('returns false when prompt does not exist', async () => {
    selectResult = [];
    const { assertPromptAccess } = await import('@/lib/model-governance/access');
    const result = await assertPromptAccess('nonexistent-prompt', 'org-1');
    expect(result).toBe(false);
  });

  it('returns true even when row has extra fields (Boolean coercion)', async () => {
    selectResult = [{ id: 'prompt-1', orgId: 'org-1', content: '...' }];
    const { assertPromptAccess } = await import('@/lib/model-governance/access');
    const result = await assertPromptAccess('prompt-1', 'org-1');
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// assertModelPinAccess
// ---------------------------------------------------------------------------
describe('assertModelPinAccess (REQ-MODELGOV-001 — org-scoping guard)', () => {
  it('returns true when model pin belongs to org', async () => {
    selectResult = [{ id: 'pin-1' }];
    const { assertModelPinAccess } = await import('@/lib/model-governance/access');
    const result = await assertModelPinAccess('pin-1', 'org-1');
    expect(result).toBe(true);
  });

  it('returns false when model pin does not belong to org', async () => {
    selectResult = [];
    const { assertModelPinAccess } = await import('@/lib/model-governance/access');
    const result = await assertModelPinAccess('pin-other-org', 'org-1');
    expect(result).toBe(false);
  });

  it('returns false when model pin does not exist', async () => {
    selectResult = [];
    const { assertModelPinAccess } = await import('@/lib/model-governance/access');
    const result = await assertModelPinAccess('nonexistent-pin', 'org-1');
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// assertChangeRequestAccess
// ---------------------------------------------------------------------------
describe('assertChangeRequestAccess (REQ-MODELGOV-001 — org-scoping guard)', () => {
  it('returns the row when change request belongs to org', async () => {
    selectResult = [
      {
        id: 'cr-1',
        promptId: 'prompt-1',
        modelPinId: 'pin-1',
        evalStatus: 'passed',
        approvalStatus: 'approved',
      },
    ];
    const { assertChangeRequestAccess } = await import('@/lib/model-governance/access');
    const result = await assertChangeRequestAccess('cr-1', 'org-1');
    expect(result).toEqual({
      id: 'cr-1',
      promptId: 'prompt-1',
      modelPinId: 'pin-1',
      evalStatus: 'passed',
      approvalStatus: 'approved',
    });
  });

  it('returns null when change request does not belong to org', async () => {
    selectResult = [];
    const { assertChangeRequestAccess } = await import('@/lib/model-governance/access');
    const result = await assertChangeRequestAccess('cr-other-org', 'org-1');
    expect(result).toBeNull();
  });

  it('returns null when change request does not exist', async () => {
    selectResult = [];
    const { assertChangeRequestAccess } = await import('@/lib/model-governance/access');
    const result = await assertChangeRequestAccess('nonexistent-cr', 'org-1');
    expect(result).toBeNull();
  });

  it('returns row with null promptId and modelPinId (RLHF proposal case)', async () => {
    selectResult = [
      {
        id: 'cr-rlhf',
        promptId: null,
        modelPinId: null,
        evalStatus: 'pending',
        approvalStatus: 'pending_review',
      },
    ];
    const { assertChangeRequestAccess } = await import('@/lib/model-governance/access');
    const result = await assertChangeRequestAccess('cr-rlhf', 'org-1');
    expect(result).not.toBeNull();
    expect(result?.promptId).toBeNull();
    expect(result?.modelPinId).toBeNull();
    expect(result?.evalStatus).toBe('pending');
    expect(result?.approvalStatus).toBe('pending_review');
  });

  it('returns row with "failed" evalStatus and "rejected" approvalStatus', async () => {
    selectResult = [
      {
        id: 'cr-failed',
        promptId: 'prompt-1',
        modelPinId: 'pin-1',
        evalStatus: 'failed',
        approvalStatus: 'rejected',
      },
    ];
    const { assertChangeRequestAccess } = await import('@/lib/model-governance/access');
    const result = await assertChangeRequestAccess('cr-failed', 'org-1');
    expect(result?.evalStatus).toBe('failed');
    expect(result?.approvalStatus).toBe('rejected');
  });

  it('returns row with "pending_review" approvalStatus', async () => {
    selectResult = [
      {
        id: 'cr-pending',
        promptId: 'prompt-1',
        modelPinId: 'pin-1',
        evalStatus: 'passed',
        approvalStatus: 'pending_review',
      },
    ];
    const { assertChangeRequestAccess } = await import('@/lib/model-governance/access');
    const result = await assertChangeRequestAccess('cr-pending', 'org-1');
    expect(result?.approvalStatus).toBe('pending_review');
  });
});
