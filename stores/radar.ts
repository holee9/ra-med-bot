// Zustand store for Radar filter state and dismissed updates.
// radarFilters is persisted to localStorage; dismissedUpdates is session-only.
// @MX:SPEC SPEC-REGULA-RADAR-001

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RadarFilters {
  impact_min?: string;
  region?: string;
  impact_type?: string;
}

interface RadarState {
  // Persisted filter preferences
  filters: RadarFilters;
  setFilters: (filters: Partial<RadarFilters>) => void;
  resetFilters: () => void;

  // Session-only dismissed update IDs
  dismissedUpdates: string[];
  dismissUpdate: (id: string) => void;
  clearDismissed: () => void;
}

export const useRadarStore = create<RadarState>()(
  persist(
    (set) => ({
      filters: {},
      setFilters: (partial) =>
        set((state) => ({ filters: { ...state.filters, ...partial } })),
      resetFilters: () => set({ filters: {} }),

      dismissedUpdates: [],
      dismissUpdate: (id) =>
        set((state) => ({
          dismissedUpdates: state.dismissedUpdates.includes(id)
            ? state.dismissedUpdates
            : [...state.dismissedUpdates, id],
        })),
      clearDismissed: () => set({ dismissedUpdates: [] }),
    }),
    {
      name: 'radar-filters',
      // Only persist filters, not dismissedUpdates (session-only)
      partialize: (state) => ({ filters: state.filters }),
    },
  ),
);
