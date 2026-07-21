// @MX:NOTE [AUTO] T-005 TDD RED phase — enqueueExpertReview integration test.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-009)

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock drizzle db — capture insert calls and simulate ON CONFLICT DO NOTHING behavior.
const _mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined);
const mockInsertChain = {
  values: vi.fn().mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing }),
};
const mockDb = {
  insert: vi.fn().mockReturnValue(mockInsertChain),
};
vi.mock('@/lib/kernel/db/client', () => ({
  db: mockDb,
}));

// Mock schema to return a dummy table reference.
vi.mock('@/lib/kernel/db/schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/kernel/db/schema')>();
  return {
    ...actual,
    expertReviews: { name: 'expert_reviews' },
  };
});

describe('enqueueExpertReview (REQ-ENTERPRISE-009)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup chain after clearAllMocks
    mockDb.insert.mockReturnValue({
      values: vi
        .fn()
        .mockReturnValue({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) }),
    });
  });

  it('inserts a record with status pending', async () => {
    const { enqueueExpertReview } = await import('@/lib/ai/expert-review-queue');

    await enqueueExpertReview({
      conversationId: 'conv-001',
      messageId: 'msg-001',
      reason: 'confidence score 0.65 < 0.7',
      requestedBy: '00000000-0000-0000-0000-000000000001',
    });

    expect(mockDb.insert).toHaveBeenCalledOnce();
    const insertCallArg = mockDb.insert.mock.calls[0][0];
    expect(insertCallArg).toBeDefined();

    // biome-ignore lint/style/noNonNullAssertion: test assertion chain
    const valuesCall = mockDb.insert.mock.results[0]!.value.values;
    expect(valuesCall).toHaveBeenCalledOnce();
    const insertedValues = valuesCall.mock.calls[0][0];
    expect(insertedValues.status).toBe('pending');
    expect(insertedValues.conversationId).toBe('conv-001');
    expect(insertedValues.messageId).toBe('msg-001');
    // reason is stored in notes column (schema has notes, not reason)
    expect(insertedValues.notes).toBe('confidence score 0.65 < 0.7');
    expect(insertedValues.requestedBy).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('calls onConflictDoNothing for idempotency', async () => {
    const { enqueueExpertReview } = await import('@/lib/ai/expert-review-queue');

    const onConflictMock = vi.fn().mockResolvedValue(undefined);
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({ onConflictDoNothing: onConflictMock }),
    });

    await enqueueExpertReview({
      conversationId: 'conv-002',
      messageId: 'msg-002',
      reason: 'policy keyword: 리콜 회피',
      requestedBy: '00000000-0000-0000-0000-000000000001',
    });

    expect(onConflictMock).toHaveBeenCalledOnce();
  });

  it('calling twice with same IDs does not throw (idempotent behavior)', async () => {
    const { enqueueExpertReview } = await import('@/lib/ai/expert-review-queue');

    const params = {
      conversationId: 'conv-003',
      messageId: 'msg-003',
      reason: 'test reason',
      requestedBy: '00000000-0000-0000-0000-000000000001',
    };

    // Both calls should resolve without error
    await expect(enqueueExpertReview(params)).resolves.toBeUndefined();
    await expect(enqueueExpertReview(params)).resolves.toBeUndefined();
  });
});
