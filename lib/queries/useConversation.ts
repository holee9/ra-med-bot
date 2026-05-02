// TanStack Query hook for a single conversation by ID.
// REQ-BREADTH-012
// Disabled when id is null.

import { useQuery } from '@tanstack/react-query';

async function fetchConversation(id: string): Promise<unknown> {
  const res = await fetch(`/api/ra/conversations/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch conversation ${id}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: () => fetchConversation(id!),
    enabled: !!id,
  });
}
