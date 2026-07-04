import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
/** @vitest-environment jsdom */
// T-004/T-005 GREEN complete — useInbox hooks with read + mutations
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useApproveTicket,
  useInboxTicket,
  useInboxTickets,
  useTriageTransition,
} from '../useInbox';

global.fetch = vi.fn();

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 60000, refetchOnWindowFocus: true },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useInboxTickets (T-004)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches tickets by state with URL /api/inbox?state=X&limit=50', async () => {
    const mockTickets = [{ id: '1', question: 'Q1', triageState: 'auto' }];
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tickets: mockTickets, pagination: { limit: 50, offset: 0, count: 1 } }),
    });

    const { result } = renderHook(() => useInboxTickets('auto'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(mockTickets);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/inbox?state=auto&limit=50'),
    );
  });
});

describe('useInboxTicket (T-004)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches single ticket by ID from /api/inbox/:id', async () => {
    const mockTicket = { id: 'ticket-1', question: 'Test', triageState: 'auto' };
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTicket,
    });

    const { result } = renderHook(() => useInboxTicket('ticket-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(mockTicket);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/inbox/ticket-1'));
  });
});

describe('useTriageTransition (T-005)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mutate function for PATCH /api/inbox/:id/triage', () => {
    const { result } = renderHook(() => useTriageTransition(), { wrapper: createWrapper() });
    expect(result.current.mutate).toBeDefined();
  });
});

describe('useApproveTicket (T-005)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mutate function for POST /api/inbox/:id/approve', () => {
    const { result } = renderHook(() => useApproveTicket(), { wrapper: createWrapper() });
    expect(result.current.mutate).toBeDefined();
  });
});
