// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-011, AC-08)
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Typed mock handles so the test never references `any`.
interface MockTrace {
  event: ReturnType<typeof vi.fn>;
}
interface MockLangfuseClient {
  trace: ReturnType<typeof vi.fn>;
  flushAsync: ReturnType<typeof vi.fn>;
}

const mockTrace: MockTrace = { event: vi.fn() };
const mockClient: MockLangfuseClient = {
  trace: vi.fn(() => mockTrace),
  flushAsync: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/lib/observability/langfuse', () => ({
  getLangfuseClient: vi.fn(() => mockClient),
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { getLangfuseClient } from '@/lib/observability/langfuse';
import { emitFeedbackEvent } from '@/lib/rlhf/langfuse-emitter';

describe('emitFeedbackEvent (REQ-RLHF-011, AC-08)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends the feedback event shape to Langfuse', async () => {
    await emitFeedbackEvent({
      messageId: 'msg-1',
      userId: 'user-1',
      rating: 'up',
      qualityTags: ['helpful', 'excellent'],
      comment: 'clear answer',
    });

    expect(mockClient.trace).toHaveBeenCalledWith({ name: 'feedback', id: 'msg-1' });
    expect(mockTrace.event).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'user_feedback',
        metadata: expect.objectContaining({
          messageId: 'msg-1',
          userId: 'user-1',
          rating: 'up',
          qualityTags: ['helpful', 'excellent'],
          hasComment: true,
        }),
      }),
    );
    expect(mockClient.flushAsync).toHaveBeenCalled();
  });

  it('gracefully no-ops when Langfuse client is null (unconfigured)', async () => {
    (
      getLangfuseClient as unknown as { mockReturnValueOnce: (v: unknown) => void }
    ).mockReturnValueOnce(null);
    // Should NOT throw.
    await expect(
      emitFeedbackEvent({
        messageId: 'msg-2',
        userId: 'user-2',
        rating: 'down',
        qualityTags: ['citation_missing'],
        comment: null,
      }),
    ).resolves.toBeUndefined();
  });

  it('NEVER throws — observability failure does not break the feedback path', async () => {
    // Simulate the SDK throwing during flush.
    mockClient.flushAsync.mockRejectedValueOnce(new Error('langfuse down'));

    // Should NOT throw.
    await expect(
      emitFeedbackEvent({
        messageId: 'msg-3',
        userId: 'user-3',
        rating: 'up',
        qualityTags: ['helpful'],
        comment: null,
      }),
    ).resolves.toBeUndefined();
  });

  it('handles null comment (hasComment=false)', async () => {
    await emitFeedbackEvent({
      messageId: 'msg-4',
      userId: 'user-4',
      rating: 'down',
      qualityTags: ['answer_wrong'],
      comment: null,
    });

    expect(mockTrace.event).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ hasComment: false }),
      }),
    );
  });
});
