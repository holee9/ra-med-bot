'use client';

// @MX:NOTE [AUTO] DocViewer hook — global Zustand store replacing per-component useState.
// @MX:REASON Converted from useState to Zustand so SourceCard.open() and DocViewer
// share the same state instance. REQ-CHAT-044 deep-link and DocViewer visibility
// depend on a single source of truth.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-044)

import { create } from 'zustand';

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

const useDocViewerStore = create<UseDocViewerReturn>((set) => ({
  isOpen: false,
  sourceId: null,
  sourceIndex: null,
  targetOffset: null,
  sourceDetail: null,
  isLoading: false,
  error: null,

  open: (sourceIndex: number, offset: number, sourceId: string) => {
    if (typeof window !== 'undefined') {
      window.location.hash = `source=${sourceIndex}&offset=${offset}`;
    }
    set({
      isOpen: true,
      sourceId,
      sourceIndex,
      targetOffset: offset,
      isLoading: true,
      error: null,
      sourceDetail: null,
    });
    void fetch(`/api/ra/sources/${sourceId}?offset=${offset}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load source: ${res.status}`);
        const data = (await res.json()) as SourceDetail;
        set({ sourceDetail: data, isLoading: false });
      })
      .catch((err) => {
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to load source',
        });
      });
  },

  close: () => {
    if (typeof window !== 'undefined') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    set({ isOpen: false });
  },
}));

export function useDocViewer(): UseDocViewerReturn {
  return useDocViewerStore();
}
