// @MX:NOTE Tests for useUpdates hook — REQ-BREADTH-027
// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from './test-utils';
import { useUpdates } from '../../../lib/queries/useUpdates';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useUpdates (REQ-BREADTH-027)', () => {
  const mockPage1 = {
    data: [
      { id: 'u1', title: 'FDA Update 2024', publishedAt: '2024-01-01' },
    ],
    nextCursor: 'cursor-xyz',
  };

  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockPage1), { status: 200 })
    );
  });

  it('starts in loading state', () => {
    const { result } = renderHook(() => useUpdates(), {
      wrapper: createQueryWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('fetches /api/ra/updates and returns pages', async () => {
    const { result } = renderHook(() => useUpdates(), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0]).toEqual(mockPage1);
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('/api/ra/updates');
  });

  it('throws error on HTTP failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('Server Error', { status: 500, statusText: 'Internal Server Error' })
    );
    const { result } = renderHook(() => useUpdates(), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('provides hasNextPage when nextCursor is present', async () => {
    const { result } = renderHook(() => useUpdates(), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
  });

  it('hasNextPage is false when nextCursor is null', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [], nextCursor: null }), { status: 200 })
    );
    const { result } = renderHook(() => useUpdates(), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });
});
