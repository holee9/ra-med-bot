// TanStack Query hook for regulatory updates (infinite list).
// REQ-BREADTH-027 + Phase 10 Radar filters.
// Uses cursor-based infinite pagination.

import { useInfiniteQuery } from '@tanstack/react-query';

export interface RegulatoryUpdateSummary {
  id: string;
  title?: string | null;
  region?: string | null;
  severity?: string | null;
  publishedAt?: string | Date | null;
  sourceUrl?: string | null;
  affectedProductTypes?: string[] | null;
  // Phase 10 Radar fields
  sourceCrawler?: string | null;
  externalId?: string | null;
  impactTypeHint?: string | null;
  impactScore?: number | string | null;
  tier1Relevant?: boolean | null;
}

export interface UpdatePage {
  data: RegulatoryUpdateSummary[];
  nextCursor: string | null;
}

export interface UpdateFilters {
  impact_min?: string;
  region?: string;
  impact_type?: string;
}

function unwrapUpdates(payload: unknown): UpdatePage {
  if (payload && typeof payload === 'object') {
    const page = payload as { data?: unknown; updates?: unknown; nextCursor?: unknown };
    if (Array.isArray(page.data)) {
      return {
        data: page.data as RegulatoryUpdateSummary[],
        nextCursor: typeof page.nextCursor === 'string' ? page.nextCursor : null,
      };
    }
    if (Array.isArray(page.updates)) {
      return { data: page.updates as RegulatoryUpdateSummary[], nextCursor: null };
    }
  }
  if (Array.isArray(payload))
    return { data: payload as RegulatoryUpdateSummary[], nextCursor: null };
  return { data: [], nextCursor: null };
}

async function fetchUpdates(cursor?: string, filters?: UpdateFilters): Promise<UpdatePage> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (filters?.impact_min) params.set('impact_min', filters.impact_min);
  if (filters?.region) params.set('region', filters.region);
  if (filters?.impact_type) params.set('impact_type', filters.impact_type);

  const qs = params.toString();
  const url = `/api/ra/updates${qs ? `?${qs}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch updates: ${res.status} ${res.statusText}`);
  }
  return unwrapUpdates(await res.json());
}

export function useUpdates(filters?: UpdateFilters) {
  return useInfiniteQuery({
    queryKey: ['updates', filters],
    queryFn: ({ pageParam }) => fetchUpdates(pageParam as string | undefined, filters),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: UpdatePage) => lastPage.nextCursor ?? undefined,
  });
}
