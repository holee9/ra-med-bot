// @MX:NOTE Tests for useConversation hook — REQ-BREADTH-012
// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConversation } from '../../../lib/queries/useConversation';
import { createQueryWrapper } from './test-utils';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useConversation (REQ-BREADTH-012)', () => {
  const mockConversation = { id: 'c1', title: 'Test Conversation', status: 'active' };

  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockConversation), { status: 200 }),
    );
  });

  it('is disabled when id is null', () => {
    const { result } = renderHook(() => useConversation(null), {
      wrapper: createQueryWrapper(),
    });
    // Query is disabled — neither loading nor fetching
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('starts in loading state when id is provided', () => {
    const { result } = renderHook(() => useConversation('c1'), {
      wrapper: createQueryWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('fetches /api/ra/conversations/[id] and returns data', async () => {
    const { result } = renderHook(() => useConversation('c1'), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockConversation);
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain('/api/ra/conversations/c1');
  });

  it('throws error on HTTP 404', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404, statusText: 'Not Found' }),
    );
    const { result } = renderHook(() => useConversation('missing'), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('does not fetch when id changes from value to null', async () => {
    let id: string | null = 'c1';
    const { result, rerender } = renderHook(() => useConversation(id), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    id = null;
    rerender();
    // After setting null the query becomes disabled
    expect(result.current.isFetching).toBe(false);
  });
});
