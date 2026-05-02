// TanStack Query hook for projects list.
// REQ-BREADTH-029

import { useQuery } from '@tanstack/react-query';

async function fetchProjects(): Promise<unknown[]> {
  const res = await fetch('/api/ra/projects');
  if (!res.ok) {
    throw new Error(`Failed to fetch projects: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<unknown[]>;
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });
}
