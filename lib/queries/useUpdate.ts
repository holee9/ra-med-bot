// TanStack Query hook for a single regulatory update detail.
// @MX:SPEC SPEC-REGULA-RADAR-001

import { useQuery } from '@tanstack/react-query';

export interface RegulatoryUpdateDetail {
  id: string;
  title: string | null;
  region: string | null;
  severity: string | null;
  publishedAt: string | Date | null;
  sourceUrl: string | null;
  affectedProductTypes: string[] | null;
  impactAnalysisText: string | null;
  impactScore: number | string | null;
  impactTypeHint: string | null;
  sourceCrawler: string | null;
  tier1Relevant: boolean | null;
}

async function fetchUpdate(id: string, analyze?: boolean): Promise<{ update: RegulatoryUpdateDetail }> {
  const params = new URLSearchParams();
  if (analyze) params.set('analyze', 'true');
  const qs = params.toString();
  const res = await fetch(`/api/ra/updates/${id}${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error(`Failed to fetch update ${id}: ${res.status}`);
  return res.json() as Promise<{ update: RegulatoryUpdateDetail }>;
}

export function useUpdateDetail(id: string) {
  return useQuery({
    queryKey: ['update', id],
    queryFn: () => fetchUpdate(id),
    enabled: Boolean(id),
  });
}
