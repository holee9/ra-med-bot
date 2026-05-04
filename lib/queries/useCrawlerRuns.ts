// TanStack Query hook for admin crawler_runs status list.
// @MX:SPEC SPEC-REGULA-RADAR-001

import { useQuery } from '@tanstack/react-query';

export interface CrawlerRunSummary {
  id: string;
  crawlerName: string;
  startedAt: string | Date | null;
  completedAt: string | Date | null;
  status: string;
  recordsAdded: number | null;
  errorsJson: unknown;
}

async function fetchCrawlerRuns(): Promise<{ runs: CrawlerRunSummary[] }> {
  const res = await fetch('/api/admin/radar/runs');
  if (!res.ok) throw new Error(`Failed to fetch crawler runs: ${res.status}`);
  return res.json() as Promise<{ runs: CrawlerRunSummary[] }>;
}

export function useCrawlerRuns() {
  return useQuery({
    queryKey: ['crawler-runs'],
    queryFn: fetchCrawlerRuns,
    refetchInterval: 30_000, // refresh every 30s
  });
}
