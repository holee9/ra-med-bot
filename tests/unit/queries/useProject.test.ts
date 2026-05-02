// @MX:NOTE Tests for useProject hook — REQ-BREADTH-031
// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from './test-utils';
import { useProject } from '../../../lib/queries/useProject';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useProject (REQ-BREADTH-031)', () => {
  const mockProject = { id: 'p1', name: 'Project Alpha', description: 'Test project' };

  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockProject), { status: 200 })
    );
  });

  it('is disabled when id is null', () => {
    const { result } = renderHook(() => useProject(null), {
      wrapper: createQueryWrapper(),
    });
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('starts in loading state when id is provided', () => {
    const { result } = renderHook(() => useProject('p1'), {
      wrapper: createQueryWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('fetches /api/ra/projects/[id] and returns data', async () => {
    const { result } = renderHook(() => useProject('p1'), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockProject);
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('/api/ra/projects/p1');
  });

  it('throws error on HTTP 404', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404, statusText: 'Not Found' })
    );
    const { result } = renderHook(() => useProject('missing'), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
