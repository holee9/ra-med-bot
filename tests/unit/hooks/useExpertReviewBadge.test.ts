// @MX:NOTE [AUTO] T-007 TDD tests — useExpertReviewBadge hook.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-030)
// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.useFakeTimers();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('useExpertReviewBadge (REQ-ENTERPRISE-030)', () => {
  it('returns count=0 initially', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], total: 0 }),
    });

    const { useExpertReviewBadge } = await import('@/hooks/useExpertReviewBadge');
    const { result } = renderHook(() => useExpertReviewBadge({ canView: true }));

    expect(result.current.count).toBe(0);
  });

  it('does NOT fetch when canView=false', async () => {
    const { useExpertReviewBadge } = await import('@/hooks/useExpertReviewBadge');
    renderHook(() => useExpertReviewBadge({ canView: false }));

    // Advance timer past initial poll interval
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sets count from API response total when canView=true', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'rev-1' }, { id: 'rev-2' }], total: 2 }),
    });

    const { useExpertReviewBadge } = await import('@/hooks/useExpertReviewBadge');
    const { result } = renderHook(() => useExpertReviewBadge({ canView: true }));

    // Allow the initial fetch to complete
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.count).toBe(2);
  });

  it('returns count=0 when API returns empty array', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], total: 0 }),
    });

    const { useExpertReviewBadge } = await import('@/hooks/useExpertReviewBadge');
    const { result } = renderHook(() => useExpertReviewBadge({ canView: true }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.count).toBe(0);
  });

  it('polls on an interval when canView=true', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], total: 0 }),
    });

    const { useExpertReviewBadge } = await import('@/hooks/useExpertReviewBadge');
    renderHook(() => useExpertReviewBadge({ canView: true }));

    // Allow initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    const callsAfterMount = mockFetch.mock.calls.length;

    // Advance past one poll interval (5000ms)
    await act(async () => {
      vi.advanceTimersByTime(5100);
      await Promise.resolve();
    });

    expect(mockFetch.mock.calls.length).toBeGreaterThan(callsAfterMount);
  });
});
