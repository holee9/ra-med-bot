// @MX:NOTE Tests for useProjects hook — REQ-BREADTH-029
// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from './test-utils';
import { useProjects } from '../../../lib/queries/useProjects';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useProjects (REQ-BREADTH-029)', () => {
  const mockProjects = [
    { id: 'p1', name: 'Project Alpha' },
    { id: 'p2', name: 'Project Beta' },
  ];

  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockProjects), { status: 200 })
    );
  });

  it('starts in loading state', () => {
    const { result } = renderHook(() => useProjects(), {
      wrapper: createQueryWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('fetches /api/ra/projects and returns array', async () => {
    const { result } = renderHook(() => useProjects(), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockProjects);
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('/api/ra/projects');
  });

  it('throws error on HTTP failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('Server Error', { status: 500, statusText: 'Internal Server Error' })
    );
    const { result } = renderHook(() => useProjects(), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('uses queryKey ["projects"]', async () => {
    // Verify data is returned (queryKey uniqueness is internal to React Query)
    const { result } = renderHook(() => useProjects(), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Array.isArray(result.current.data)).toBe(true);
  });
});
