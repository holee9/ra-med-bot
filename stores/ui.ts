// @MX:ANCHOR [AUTO] useUIStore — single source of truth for UI navigation state.
// @MX:REASON REQ-BREADTH-049/050/051 require shared UI state across the shell,
// sidebar, and chat panel. fan_in will reach 3+ once the shell layout, project
// selector, and chat input all reference this store.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-049, REQ-BREADTH-050, REQ-BREADTH-051)
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-031)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Light / dark theme selection. Persisted under 'regula-theme' key. */
export type Theme = 'light' | 'dark';

interface UIState {
  /** Currently selected project ID, or null if none selected. */
  currentProjectId: string | null;
  /** Last 5 visited project IDs, most recent first. */
  recentProjects: string[];
  /**
   * Pre-filled question for the chat input (e.g. from a deep-link or onboarding).
   * NOT persisted — ephemeral per session only.
   */
  pendingQuestion: string | null;
  /** Whether the right info panel is collapsed. */
  rightPanelCollapsed: boolean;
  /** Whether the user has completed the onboarding flow (REQ-BREADTH-007). */
  onboardingDone: boolean;
  /** Active color theme. Persisted to localStorage (REQ-ENTERPRISE-031). */
  theme: Theme;
}

interface UIActions {
  setCurrentProjectId: (id: string | null) => void;
  addRecentProject: (id: string) => void;
  setPendingQuestion: (q: string | null) => void;
  setRightPanelCollapsed: (collapsed: boolean) => void;
  completeOnboarding: () => void;
  /** Explicitly set the active theme (REQ-ENTERPRISE-031). */
  setTheme: (theme: Theme) => void;
  /** Toggle between light and dark themes (REQ-ENTERPRISE-031). */
  toggleTheme: () => void;
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // Initial state
      currentProjectId: null,
      recentProjects: [],
      pendingQuestion: null,
      rightPanelCollapsed: false,
      onboardingDone: false,
      theme: 'light',

      // Actions
      setCurrentProjectId: (id) => set({ currentProjectId: id }),

      addRecentProject: (id) =>
        set((state) => {
          // Deduplicate, then prepend, then cap at 5
          const filtered = state.recentProjects.filter((p) => p !== id);
          return { recentProjects: [id, ...filtered].slice(0, 5) };
        }),

      setPendingQuestion: (q) => set({ pendingQuestion: q }),

      setRightPanelCollapsed: (collapsed) => set({ rightPanelCollapsed: collapsed }),

      completeOnboarding: () => set({ onboardingDone: true }),

      setTheme: (theme) => set({ theme }),

      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
    }),
    {
      // Storage key for localStorage (REQ-BREADTH-049)
      name: 'regula_ui',
      // Exclude pendingQuestion from persistence — it is session-only.
      partialize: (state) => ({
        currentProjectId: state.currentProjectId,
        recentProjects: state.recentProjects,
        rightPanelCollapsed: state.rightPanelCollapsed,
        onboardingDone: state.onboardingDone,
        theme: state.theme,
        // pendingQuestion intentionally excluded
      }),
    },
  ),
);
