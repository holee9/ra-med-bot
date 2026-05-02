// TanStack Query hook for templates list.
// REQ-BREADTH-006, REQ-BREADTH-025

import { useQuery } from '@tanstack/react-query';

export interface TemplatesOpts {
  limit?: number;
  sortBy?: string;
  sortDir?: string;
}

async function fetchTemplates(opts: TemplatesOpts): Promise<unknown[]> {
  const params = new URLSearchParams();
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts.sortBy) params.set('sortBy', opts.sortBy);
  if (opts.sortDir) params.set('sortDir', opts.sortDir);

  const qs = params.toString();
  const url = `/api/ra/templates${qs ? `?${qs}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch templates: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<unknown[]>;
}

export function useTemplates(opts: TemplatesOpts = {}) {
  return useQuery({
    queryKey: ['templates', opts],
    queryFn: () => fetchTemplates(opts),
  });
}
