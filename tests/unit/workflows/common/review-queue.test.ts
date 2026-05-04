import { describe, it, expect, beforeEach } from 'vitest';
import { ReviewQueue, type ReviewItem } from '@/lib/workflows/common/review-queue';

describe('ReviewQueue', () => {
  let queue: ReviewQueue;

  beforeEach(() => {
    queue = new ReviewQueue();
  });

  const makeItem = (
    overrides: Partial<Omit<ReviewItem, 'id'>> = {},
  ): Omit<ReviewItem, 'id'> => ({
    workflowRunId: '550e8400-e29b-41d4-a716-446655440000',
    workflowType: 'submission_drafter',
    priority: 'normal',
    requestedAt: new Date().toISOString(),
    ...overrides,
  });

  describe('enqueue', () => {
    it('assigns a UUID id to enqueued item', () => {
      const item = queue.enqueue(makeItem());
      expect(item.id).toBeTruthy();
      expect(item.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('increments size on enqueue', () => {
      expect(queue.size()).toBe(0);
      queue.enqueue(makeItem());
      expect(queue.size()).toBe(1);
      queue.enqueue(makeItem());
      expect(queue.size()).toBe(2);
    });
  });

  describe('dequeue', () => {
    it('removes and returns the item by id', () => {
      const enqueued = queue.enqueue(makeItem());
      const result = queue.dequeue(enqueued.id);
      expect(result).toBeDefined();
      expect(result?.id).toBe(enqueued.id);
      expect(queue.size()).toBe(0);
    });

    it('returns undefined for unknown id', () => {
      expect(queue.dequeue('unknown-id')).toBeUndefined();
    });
  });

  describe('peek', () => {
    it('returns item without removing it', () => {
      const enqueued = queue.enqueue(makeItem());
      const result = queue.peek(enqueued.id);
      expect(result?.id).toBe(enqueued.id);
      expect(queue.size()).toBe(1); // still in queue
    });

    it('returns undefined for unknown id', () => {
      expect(queue.peek('unknown-id')).toBeUndefined();
    });
  });

  describe('listByPriority', () => {
    it('sorts items: urgent > high > normal > low', () => {
      queue.enqueue(makeItem({ priority: 'low' }));
      queue.enqueue(makeItem({ priority: 'normal' }));
      queue.enqueue(makeItem({ priority: 'urgent' }));
      queue.enqueue(makeItem({ priority: 'high' }));

      const sorted = queue.listByPriority();
      expect(sorted[0]!.priority).toBe('urgent');
      expect(sorted[1]!.priority).toBe('high');
      expect(sorted[2]!.priority).toBe('normal');
      expect(sorted[3]!.priority).toBe('low');
    });
  });

  describe('listByWorkflowRun', () => {
    it('filters items by workflowRunId', () => {
      const run1 = '11111111-0000-4000-8000-000000000001';
      const run2 = '22222222-0000-4000-8000-000000000002';

      queue.enqueue(makeItem({ workflowRunId: run1 }));
      queue.enqueue(makeItem({ workflowRunId: run1 }));
      queue.enqueue(makeItem({ workflowRunId: run2 }));

      const result = queue.listByWorkflowRun(run1);
      expect(result).toHaveLength(2);
      result.forEach((item) => expect(item.workflowRunId).toBe(run1));
    });

    it('returns empty array when no items match', () => {
      queue.enqueue(makeItem());
      expect(queue.listByWorkflowRun('nonexistent-run')).toHaveLength(0);
    });
  });

  describe('size and clear', () => {
    it('size returns current count', () => {
      queue.enqueue(makeItem());
      queue.enqueue(makeItem());
      expect(queue.size()).toBe(2);
    });

    it('clear empties the queue', () => {
      queue.enqueue(makeItem());
      queue.enqueue(makeItem());
      queue.clear();
      expect(queue.size()).toBe(0);
    });
  });
});
