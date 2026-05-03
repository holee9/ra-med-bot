// TanStack Query hook for a single conversation by ID.
// REQ-BREADTH-012
// Disabled when id is null.

import { useQuery } from '@tanstack/react-query';

function unwrapConversation(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && 'conversation' in payload) {
    return (payload as { conversation: unknown }).conversation;
  }
  return payload;
}

async function fetchConversation(id: string): Promise<unknown> {
  const res = await fetch(`/api/ra/conversations/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch conversation ${id}: ${res.status} ${res.statusText}`);
  }
  return unwrapConversation(await res.json());
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: () => fetchConversation(id!),
    enabled: !!id,
  });
}
