// TanStack Query hook for templates list.
// REQ-BREADTH-006, REQ-BREADTH-025

import { useQuery } from '@tanstack/react-query';

export interface TemplateSummary {
  id: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  region?: string | null;
  category?: string | null;
  usageCount?: number | null;
  createdAt?: string | Date | null;
}

export interface TemplatesOpts {
  limit?: number;
  sortBy?: string;
  sortDir?: string;
}

function unwrapTemplates(payload: unknown): TemplateSummary[] {
  if (Array.isArray(payload)) return payload as TemplateSummary[];
  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { templates?: unknown }).templates)
  ) {
    return (payload as { templates: TemplateSummary[] }).templates;
  }
  return [];
}

async function fetchTemplates(opts: TemplatesOpts): Promise<TemplateSummary[]> {
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
  return unwrapTemplates(await res.json());
}

export function useTemplates(opts: TemplatesOpts = {}) {
  return useQuery({
    queryKey: ['templates', opts],
    queryFn: () => fetchTemplates(opts),
  });
}
