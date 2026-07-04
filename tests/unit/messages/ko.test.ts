import { describe, it, expect } from 'vitest';
import koMessages from '@/messages/ko.json';

describe('messages/ko.json - inbox namespace', () => {
  it('should contain inbox namespace with all required keys', () => {
    expect(koMessages.inbox).toBeDefined();
    expect(koMessages.inbox).toMatchObject({
      title: expect.any(String),
      columns: expect.objectContaining({
        auto: expect.any(String),
        needsReview: expect.any(String),
        escalated: expect.any(String),
        waiting: expect.any(String),
        closed: expect.any(String),
        rejected: expect.any(String),
      }),
      actions: expect.objectContaining({
        approve: expect.any(String),
        reject: expect.any(String),
        assign: expect.any(String),
        escalate: expect.any(String),
        refresh: expect.any(String),
      }),
      sla: expect.objectContaining({
        overdue: expect.any(String),
        remaining: expect.any(String),
      }),
      empty: expect.any(String),
      loading: expect.any(String),
      errors: expect.objectContaining({
        transitionFailed: expect.any(String),
        approveFailed: expect.any(String),
        passwordInvalid: expect.any(String),
        missingFinalAnswer: expect.any(String),
      }),
    });
  });
});
