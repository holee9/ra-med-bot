// TanStack Query hook for a single project by ID.
// REQ-BREADTH-031
// Disabled when id is null.

import { useQuery } from '@tanstack/react-query';

async function fetchProject(id: string): Promise<unknown> {
  const res = await fetch(`/api/ra/projects/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch project ${id}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function useProject(id: string | null) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id!),
    enabled: !!id,
  });
}
