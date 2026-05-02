// @MX:NOTE Tests for useSources hook — REQ-BREADTH-052
// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from './test-utils';
import { useSources } from '../../../lib/queries/useSources';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useSources (REQ-BREADTH-052)', () => {
  const mockSources = [
    { id: 's1', title: 'FDA Guidance 2024', url: 'https://fda.gov/1' },
    { id: 's2', title: 'ISO 13485', url: 'https://iso.org/1' },
  ];

  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockSources), { status: 200 })
    );
  });

  it('is disabled when conversationId is null', () => {
    const { result } = renderHook(() => useSources(null), {
      wrapper: createQueryWrapper(),
    });
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('starts in loading state when conversationId is provided', () => {
    const { result } = renderHook(() => useSources('c1'), {
      wrapper: createQueryWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('fetches /api/ra/sources and returns data', async () => {
    const { result } = renderHook(() => useSources('c1'), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockSources);
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('/api/ra/sources');
  });

  it('throws error on HTTP failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('Server Error', { status: 500, statusText: 'Internal Server Error' })
    );
    const { result } = renderHook(() => useSources('c1'), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('includes conversationId in request', async () => {
    const { result } = renderHook(() => useSources('conv-123'), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('conversationId=conv-123');
  });
});
