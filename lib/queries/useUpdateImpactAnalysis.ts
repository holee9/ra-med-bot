// TanStack Query hook for on-demand impact analysis (triggers Sonnet generation).
// @MX:SPEC SPEC-REGULA-RADAR-001

import { useQuery } from '@tanstack/react-query';

interface ImpactAnalysisResult {
  impactAnalysisText: string | null;
}

async function fetchImpactAnalysis(id: string): Promise<ImpactAnalysisResult> {
  const res = await fetch(`/api/ra/updates/${id}?analyze=true`);
  if (!res.ok) throw new Error(`Failed to fetch impact analysis for ${id}`);
  const data = await res.json() as { update: { impactAnalysisText: string | null } };
  return { impactAnalysisText: data.update.impactAnalysisText };
}

export function useUpdateImpactAnalysis(id: string) {
  return useQuery({
    queryKey: ['update-impact-analysis', id],
    queryFn: () => fetchImpactAnalysis(id),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000, // 5 minutes — analysis is stable once generated
  });
}
