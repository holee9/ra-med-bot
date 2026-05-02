// @MX:NOTE Unit tests for useComposerPrefill hook — REQ-STRUCT-027.
// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useComposerPrefill } from '../../hooks/useComposerPrefill';

afterEach(() => {
  cleanup();
});

describe('useComposerPrefill (REQ-STRUCT-027)', () => {
  it('exports prefill function', () => {
    const { result } = renderHook(() => useComposerPrefill());
    expect(typeof result.current.prefill).toBe('function');
  });

  it('prefill sets the text value', () => {
    const { result } = renderHook(() => useComposerPrefill());
    act(() => {
      result.current.prefill('510(k) 면제 조건은?');
    });
    expect(result.current.text).toBe('510(k) 면제 조건은?');
  });

  it('prefill updates text on subsequent calls', () => {
    const { result } = renderHook(() => useComposerPrefill());
    act(() => {
      result.current.prefill('첫번째 질문');
    });
    expect(result.current.text).toBe('첫번째 질문');

    act(() => {
      result.current.prefill('두번째 질문');
    });
    expect(result.current.text).toBe('두번째 질문');
  });

  it('initial text is empty string', () => {
    const { result } = renderHook(() => useComposerPrefill());
    expect(result.current.text).toBe('');
  });

  it('clear resets text to empty', () => {
    const { result } = renderHook(() => useComposerPrefill());
    act(() => {
      result.current.prefill('some text');
    });
    act(() => {
      result.current.clear();
    });
    expect(result.current.text).toBe('');
  });
});
