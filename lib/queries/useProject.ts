// TanStack Query hook for a single project by ID.
// REQ-BREADTH-031
// Disabled when id is null.

import { useQuery } from '@tanstack/react-query';

function unwrapProject(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && 'project' in payload) {
    return (payload as { project: unknown }).project;
  }
  return payload;
}

async function fetchProject(id: string): Promise<unknown> {
  const res = await fetch(`/api/ra/projects/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch project ${id}: ${res.status} ${res.statusText}`);
  }
  return unwrapProject(await res.json());
}

export function useProject(id: string | null) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id!),
    enabled: !!id,
  });
}
