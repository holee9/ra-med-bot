'use client';

// @MX:NOTE DocViewer hook — manages open/close, source fetch, and offset scroll.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-044)

import { useCallback, useState } from 'react';

export interface SourceSection {
  id: string;
  anchor: string;
  heading: string | null;
  text: string;
  offset: number;
}

export interface SourceDetail {
  id: string;
  orgLabel: string;
  title: string;
  year: number | null;
  type: string;
  url: string | null;
  sections: SourceSection[];
}

export interface DocViewerState {
  isOpen: boolean;
  sourceId: string | null;
  sourceIndex: number | null;
  targetOffset: number | null;
  sourceDetail: SourceDetail | null;
  isLoading: boolean;
  error: string | null;
}

export interface UseDocViewerReturn extends DocViewerState {
  open: (sourceIndex: number, offset: number, sourceId: string) => void;
  close: () => void;
}

export function useDocViewer(): UseDocViewerReturn {
  const [state, setState] = useState<DocViewerState>({
    isOpen: false,
    sourceId: null,
    sourceIndex: null,
    targetOffset: null,
    sourceDetail: null,
    isLoading: false,
    error: null,
  });

  const open = useCallback((sourceIndex: number, offset: number, sourceId: string) => {
    // Update URL hash for deep-link (REQ-CHAT-043).
    if (typeof window !== 'undefined') {
      window.location.hash = `source=${sourceIndex}&offset=${offset}`;
    }

    setState((prev) => ({
      ...prev,
      isOpen: true,
      sourceId,
      sourceIndex,
      targetOffset: offset,
      isLoading: true,
      error: null,
      sourceDetail: null,
    }));

    // Fetch source detail.
    void fetch(`/api/ra/sources/${sourceId}?offset=${offset}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load source: ${res.status}`);
        const data = (await res.json()) as SourceDetail;
        setState((prev) => ({ ...prev, sourceDetail: data, isLoading: false }));
      })
      .catch((err) => {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to load source',
        }));
      });
  }, []);

  const close = useCallback(() => {
    if (typeof window !== 'undefined') {
      // Clear hash.
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return { ...state, open, close };
}
