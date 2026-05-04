// @MX:NOTE: [AUTO] In-memory queue — not persisted across process restarts.
// For production, replace defaultReviewQueue with a Redis or DB-backed implementation.

export interface ReviewItem {
  id: string;
  workflowRunId: string;
  workflowType: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  requestedAt: string;
  dueAt?: string;
  assignedTo?: string;
}

const PRIORITY_ORDER: Record<ReviewItem['priority'], number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export class ReviewQueue {
  private items = new Map<string, ReviewItem>();

  /** Adds an item to the queue, auto-assigning a UUID v4 id. */
  enqueue(item: Omit<ReviewItem, 'id'>): ReviewItem {
    const id = crypto.randomUUID();
    const newItem: ReviewItem = { ...item, id };
    this.items.set(id, newItem);
    return newItem;
  }

  /** Removes and returns an item by id. Returns undefined if not found. */
  dequeue(id: string): ReviewItem | undefined {
    const item = this.items.get(id);
    if (item) this.items.delete(id);
    return item;
  }

  /** Returns an item by id without removing it. Returns undefined if not found. */
  peek(id: string): ReviewItem | undefined {
    return this.items.get(id);
  }

  /** Returns all items sorted by priority (urgent first). */
  listByPriority(): ReviewItem[] {
    return Array.from(this.items.values()).sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
    );
  }

  /** Returns all items belonging to the given workflowRunId. */
  listByWorkflowRun(workflowRunId: string): ReviewItem[] {
    return Array.from(this.items.values()).filter((item) => item.workflowRunId === workflowRunId);
  }

  /** Returns the number of items currently in the queue. */
  size(): number {
    return this.items.size;
  }

  /** Removes all items from the queue. */
  clear(): void {
    this.items.clear();
  }
}

/** Shared singleton for application-wide use. */
export const defaultReviewQueue = new ReviewQueue();
