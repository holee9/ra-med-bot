// TanStack Query hook for paginated conversations list.
// REQ-BREADTH-005, REQ-BREADTH-008, REQ-BREADTH-009
// Uses cursor-based infinite pagination.

import { useInfiniteQuery } from '@tanstack/react-query';

export interface ConversationsOpts {
  limit?: number;
  status?: string;
  sortBy?: string;
  sortDir?: string;
}

export interface ConversationSummary {
  id: string;
  projectId?: string | null;
  title?: string | null;
  status?: string | null;
  createdAt?: string | Date | null;
}

interface ConversationPage {
  data: ConversationSummary[];
  nextCursor: string | null;
}

function unwrapConversations(payload: unknown): ConversationPage {
  if (payload && typeof payload === 'object') {
    const page = payload as { data?: unknown; conversations?: unknown; nextCursor?: unknown };
    if (Array.isArray(page.data)) {
      return {
        data: page.data as ConversationSummary[],
        nextCursor: typeof page.nextCursor === 'string' ? page.nextCursor : null,
      };
    }
    if (Array.isArray(page.conversations)) {
      return { data: page.conversations as ConversationSummary[], nextCursor: null };
    }
  }
  if (Array.isArray(payload)) return { data: payload as ConversationSummary[], nextCursor: null };
  return { data: [], nextCursor: null };
}

async function fetchConversations(
  opts: ConversationsOpts,
  cursor?: string,
): Promise<ConversationPage> {
  const params = new URLSearchParams();
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts.status) params.set('status', opts.status);
  if (opts.sortBy) params.set('sortBy', opts.sortBy);
  if (opts.sortDir) params.set('sortDir', opts.sortDir);
  if (cursor) params.set('cursor', cursor);

  const qs = params.toString();
  const url = `/api/ra/conversations${qs ? `?${qs}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch conversations: ${res.status} ${res.statusText}`);
  }
  return unwrapConversations(await res.json());
}

// @MX:ANCHOR: [AUTO] Infinite query entry point for conversation list — fan_in >= 3 expected.
// @MX:REASON ConversationList, ConversationSidebar, and DashboardPanel all consume this hook.
export function useConversations(opts: ConversationsOpts = {}) {
  return useInfiniteQuery({
    queryKey: ['conversations', opts],
    queryFn: ({ pageParam }) => fetchConversations(opts, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: ConversationPage) => lastPage.nextCursor ?? undefined,
  });
}
