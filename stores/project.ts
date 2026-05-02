// @MX:NOTE [AUTO] useProjectStore — in-memory project object cache.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-049, REQ-BREADTH-050, REQ-BREADTH-051)
//
// Stores the full Project object (as returned by Drizzle) so components can
// access project fields without re-fetching from the server on every render.
// This store is NOT persisted — project data is re-hydrated from the API on
// page load. Only the ID list is persisted in useUIStore.

import type { projects } from '@/lib/db/schema';
import type { InferSelectModel } from 'drizzle-orm';
import { create } from 'zustand';

/** Full project row as returned by Drizzle. */
export type Project = InferSelectModel<typeof projects>;

interface ProjectState {
  /** The currently active project object, or null. */
  currentProject: Project | null;
  /** Last 5 visited project objects, most recent first. */
  recentProjects: Project[];
}

interface ProjectActions {
  setCurrentProject: (project: Project | null) => void;
  addRecentProject: (project: Project) => void;
}

type ProjectStore = ProjectState & ProjectActions;

export const useProjectStore = create<ProjectStore>()((set) => ({
  // Initial state
  currentProject: null,
  recentProjects: [],

  // Actions
  setCurrentProject: (project) => set({ currentProject: project }),

  addRecentProject: (project) =>
    set((state) => {
      // Deduplicate by id, prepend, cap at 5
      const filtered = state.recentProjects.filter((p) => p.id !== project.id);
      return { recentProjects: [project, ...filtered].slice(0, 5) };
    }),
}));
