// @MX:NOTE Tests for useTemplates hook — REQ-BREADTH-006, REQ-BREADTH-025
// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from './test-utils';
import { useTemplates } from '../../../lib/queries/useTemplates';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useTemplates (REQ-BREADTH-006, REQ-BREADTH-025)', () => {
  const mockTemplates = [
    { id: 't1', name: 'Template A', category: 'regulatory' },
    { id: 't2', name: 'Template B', category: 'clinical' },
  ];

  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockTemplates), { status: 200 })
    );
  });

  it('starts in loading state', () => {
    const { result } = renderHook(() => useTemplates(), {
      wrapper: createQueryWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('fetches /api/ra/templates and returns data', async () => {
    const { result } = renderHook(() => useTemplates(), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockTemplates);
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('/api/ra/templates');
  });

  it('passes limit option as query param', async () => {
    const { result } = renderHook(() => useTemplates({ limit: 5 }), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('limit=5');
  });

  it('passes sortBy option as query param', async () => {
    const { result } = renderHook(() => useTemplates({ sortBy: 'name' }), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('sortBy=name');
  });

  it('throws error on HTTP failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('Server Error', { status: 500, statusText: 'Internal Server Error' })
    );
    const { result } = renderHook(() => useTemplates(), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
