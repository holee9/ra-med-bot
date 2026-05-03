// TanStack Query hook for projects list.
// REQ-BREADTH-029

import { useQuery } from '@tanstack/react-query';

export interface ProjectSummary {
  id: string;
  name: string;
  deviceClass?: string | null;
  status?: string | null;
  createdAt?: string | Date | null;
}

function unwrapProjects(payload: unknown): ProjectSummary[] {
  if (Array.isArray(payload)) return payload as ProjectSummary[];
  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { projects?: unknown }).projects)
  ) {
    return (payload as { projects: ProjectSummary[] }).projects;
  }
  return [];
}

async function fetchProjects(): Promise<ProjectSummary[]> {
  const res = await fetch('/api/ra/projects');
  if (!res.ok) {
    throw new Error(`Failed to fetch projects: ${res.status} ${res.statusText}`);
  }
  return unwrapProjects(await res.json());
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });
}
