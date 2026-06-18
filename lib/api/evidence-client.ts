// @MX:NOTE [AUTO] Browser-side BFF client for Evidence API. Never imports server-only modules.
// @MX:SPEC issue #168

export interface LinkRequest {
  requirement_id: string;
  evidence_type: 'clinical' | 'preclinical' | 'technical' | 'labeling';
  description: string;
  metadata?: Record<string, string>;
}

export interface LinkResponse {
  req_id: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  message?: string;
}

export interface EvidenceLink {
  req_id: string;
  requirement_id: string;
  evidence_type: string;
  description: string;
  status: string;
  created_at: string;
  updated_at?: string;
  metadata?: Record<string, string>;
}

export interface BinderRequest {
  name: string;
  link_ids: string[];
  metadata?: Record<string, string>;
}

export interface BinderResponse {
  binder_id: string;
  name: string;
  status: 'created' | 'failed';
  created_at: string;
  link_count: number;
  message?: string;
}

async function bffFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const evidenceClient = {
  createLink: (request: LinkRequest): Promise<LinkResponse> =>
    bffFetch<LinkResponse>('/api/ra/evidence/link', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  getLinks: (reqId: string): Promise<EvidenceLink[]> =>
    bffFetch<EvidenceLink[]>(`/api/ra/evidence/links/${reqId}`),

  createBinder: (request: BinderRequest): Promise<BinderResponse> =>
    bffFetch<BinderResponse>('/api/ra/evidence/binder', {
      method: 'POST',
      body: JSON.stringify(request),
    }),
};
