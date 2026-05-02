// TanStack Query hook for regulatory updates (infinite list).
// REQ-BREADTH-027
// Uses cursor-based infinite pagination.

import { useInfiniteQuery } from '@tanstack/react-query';

interface UpdatePage {
  data: unknown[];
  nextCursor: string | null;
}

async function fetchUpdates(cursor?: string): Promise<UpdatePage> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);

  const qs = params.toString();
  const url = `/api/ra/updates${qs ? `?${qs}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch updates: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<UpdatePage>;
}

export function useUpdates() {
  return useInfiniteQuery({
    queryKey: ['updates'],
    queryFn: ({ pageParam }) => fetchUpdates(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: UpdatePage) => lastPage.nextCursor ?? undefined,
  });
}
