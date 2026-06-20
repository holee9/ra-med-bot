/** @vitest-environment jsdom */

/**
 * useExportState hook tests
 * @MX:SPEC SPEC-REGULA-EXPORT-HUB-001 (REQ-EXP-001)
 */

import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useExportState } from '../useExportState';

describe('useExportState', () => {
  it('initializes with idle state', () => {
    const { result } = renderHook(() => useExportState());
    expect(result.current.state).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('transitions to loading state when export starts', () => {
    const { result } = renderHook(() => useExportState());
    act(() => {
      result.current.setLoading();
    });
    expect(result.current.state).toBe('loading');
  });

  it('transitions to success state when export completes', () => {
    const { result } = renderHook(() => useExportState());
    act(() => {
      result.current.setLoading();
      result.current.setSuccess({ filename: 'test.md', size: 1024 });
    });
    expect(result.current.state).toBe('success');
    expect(result.current.result).toEqual({ filename: 'test.md', size: 1024 });
  });

  it('transitions to error state when export fails', () => {
    const { result } = renderHook(() => useExportState());
    act(() => {
      result.current.setLoading();
      result.current.setError(new Error('Export failed'));
    });
    expect(result.current.state).toBe('error');
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Export failed');
  });

  it('resets to idle state', () => {
    const { result } = renderHook(() => useExportState());
    act(() => {
      result.current.setLoading();
      result.current.reset();
    });
    expect(result.current.state).toBe('idle');
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
  });
});
