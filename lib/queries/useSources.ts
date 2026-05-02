// TanStack Query hook for regulatory sources by conversation.
// REQ-BREADTH-052
// Disabled when conversationId is null.

import { useQuery } from '@tanstack/react-query';

async function fetchSources(conversationId: string): Promise<unknown[]> {
  const params = new URLSearchParams({ conversationId });
  const res = await fetch(`/api/ra/sources?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch sources: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<unknown[]>;
}

export function useSources(conversationId: string | null) {
  return useQuery({
    queryKey: ['sources', conversationId],
    queryFn: () => fetchSources(conversationId!),
    enabled: !!conversationId,
  });
}
