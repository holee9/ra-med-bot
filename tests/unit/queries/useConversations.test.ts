// @MX:NOTE Tests for useConversations hook — REQ-BREADTH-005, REQ-BREADTH-008, REQ-BREADTH-009
// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from './test-utils';
import { useConversations } from '../../../lib/queries/useConversations';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useConversations (REQ-BREADTH-005, REQ-BREADTH-008, REQ-BREADTH-009)', () => {
  const mockPage1 = {
    data: [{ id: 'c1', title: 'Conversation 1' }],
    nextCursor: 'cursor-abc',
  };

  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockPage1), { status: 200 })
    );
  });

  it('starts in loading state', () => {
    const { result } = renderHook(() => useConversations(), {
      wrapper: createQueryWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('fetches /api/ra/conversations and returns data on success', async () => {
    const { result } = renderHook(() => useConversations(), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const firstPage = result.current.data?.pages[0];
    expect(firstPage).toEqual(mockPage1);
  });

  it('passes limit option as query param', async () => {
    const { result } = renderHook(() => useConversations({ limit: 10 }), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('limit=10');
  });

  it('passes status option as query param', async () => {
    const { result } = renderHook(() => useConversations({ status: 'active' }), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('status=active');
  });

  it('throws error on HTTP failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' })
    );
    const { result } = renderHook(() => useConversations(), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('provides hasNextPage when nextCursor is present', async () => {
    const { result } = renderHook(() => useConversations(), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
  });

  it('hasNextPage is false when nextCursor is null', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [], nextCursor: null }), { status: 200 })
    );
    const { result } = renderHook(() => useConversations(), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });
});
