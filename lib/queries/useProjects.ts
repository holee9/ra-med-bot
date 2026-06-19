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
    staleTime: 1000 * 60 * 5, // 5분 동안 데이터는 신선한 것으로 간주
    gcTime: 1000 * 60 * 10, // 10분 후 캐시에서 제거
    refetchOnWindowFocus: false, // 윈도우 포커스 시 자동 재요청 비활성화
    refetchOnMount: false, // 마운트 시 자동 재요청 비활성화
  });
}
