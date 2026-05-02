// TanStack Query hook for dashboard summary statistics.
// REQ-BREADTH-028
// staleTime: 5 minutes — matches Cache-Control: max-age=300 on the API route.

import { useQuery } from '@tanstack/react-query';

const DASHBOARD_STALE_TIME = 5 * 60 * 1000; // 300 000 ms = 5 minutes

async function fetchDashboardStats(): Promise<unknown> {
  const res = await fetch('/api/ra/dashboard');
  if (!res.ok) {
    throw new Error(`Failed to fetch dashboard stats: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardStats,
    staleTime: DASHBOARD_STALE_TIME,
  });
}
