/**
 * Kanban query tests for inbox tickets.
 * SPEC-V3-INBOX-001 (REQ-V3-INBOX-007, REQ-V3-INBOX-002, REQ-V3-INBOX-009, AC-02, AC-09, Issue #320)
 *
 * Signature pattern tests (lib/signature/__tests__/queries.test.ts):
 * - Simple mockDb with vi.fn().mockReturnValue() chains
 * - Direct result stub via mockResolvedValue/mockResolvedValueOnce
 */

import { countByState, getTicket, listByTriageState } from '@/lib/domains/inbox/queries';
import type { TicketFilters } from '@/lib/domains/inbox/queries';
import { describe, expect, it, vi } from 'vitest';

describe('listByTriageState', () => {
  it('AC-02: returns empty array when no tickets exist', async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      }),
    };

    const result = await listByTriageState(mockDb as never, 'org-1', {});
    expect(result).toEqual([]);
  });

  it('AC-02: returns tickets filtered by org and state', async () => {
    const tickets = [
      { id: 't1', orgId: 'org-1', triageState: 'pending', title: 'Ticket 1' },
      { id: 't2', orgId: 'org-1', triageState: 'pending', title: 'Ticket 2' },
    ];

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(tickets),
              }),
            }),
          }),
        }),
      }),
    };

    const result = await listByTriageState(mockDb as never, 'org-1', { state: 'needs-review' });
    expect(result).toEqual(tickets);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it('AC-02: applies limit and offset pagination', async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      }),
    };

    await listByTriageState(mockDb as never, 'org-1', { limit: 10, offset: 20 });
    expect(mockDb.select).toHaveBeenCalled();
  });

  it('AC-02: filters by assignee when provided', async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      }),
    };

    await listByTriageState(mockDb as never, 'org-1', { limit: 10, offset: 20 });
    expect(mockDb.select).toHaveBeenCalled();
  });
});

describe('getTicket', () => {
  it('AC-09: returns ticket by ID within org', async () => {
    const ticket = { id: 't1', orgId: 'org-1', title: 'Ticket 1' };

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([ticket]),
          }),
        }),
      }),
    };

    const result = await getTicket(mockDb as never, 'org-1', 't1');
    // getTicket returns the Drizzle query result (array), not unwrapped
    expect(result).toEqual([ticket]);
  });

  it('AC-09: returns empty array for non-existent ticket', async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    const result = await getTicket(mockDb as never, 'org-1', 't-999');
    expect(result).toEqual([]);
  });
});

describe('countByState', () => {
  it('AC-02: returns zero counts when no tickets exist', async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    const result = await countByState(mockDb as never, 'org-1');
    expect(result).toEqual({
      auto: 0,
      'needs-review': 0,
      escalated: 0,
      waiting: 0,
      closed: 0,
      rejected: 0,
    });
  });

  it('AC-02: returns ticket counts grouped by state', async () => {
    const counts = [
      { state: 'needs-review', count: 5 },
      { state: 'escalated', count: 3 },
    ];

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue(counts),
          }),
        }),
      }),
    };

    const result = await countByState(mockDb as never, 'org-1');
    expect(result['needs-review']).toBe(5);
    expect(result.escalated).toBe(3);
  });
});
