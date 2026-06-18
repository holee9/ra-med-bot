// @MX:NOTE [AUTO] Browser-side BFF client for Authoring API. Never imports server-only modules.
// @MX:SPEC issue #171

export interface SessionRequest {
  section_id: string;
  device_id: string;
  context?: Record<string, string>;
}

export interface SessionResponse {
  session_id: string;
  status: 'created' | 'in_progress' | 'approved' | 'rejected';
  created_at: string;
  current_draft?: string;
}

export interface SessionState {
  session_id: string;
  section_id: string;
  status: 'created' | 'in_progress' | 'approved' | 'rejected';
  current_draft: string;
  created_at: string;
  updated_at?: string;
  approver_comments?: string;
}

export interface ApprovalRequest {
  decision: 'approve' | 'reject';
  comments?: string;
}

export interface ApprovalResponse {
  session_id: string;
  status: 'approved' | 'rejected';
  updated_at: string;
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

export const authoringClient = {
  createSession: (request: SessionRequest): Promise<SessionResponse> =>
    bffFetch<SessionResponse>('/api/ra/authoring/sessions', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  getSession: (sessionId: string): Promise<SessionState> =>
    bffFetch<SessionState>(`/api/ra/authoring/sessions/${sessionId}`),

  approveSession: (sessionId: string, request: ApprovalRequest): Promise<ApprovalResponse> =>
    bffFetch<ApprovalResponse>(`/api/ra/authoring/sessions/${sessionId}/approve`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  rejectSession: (sessionId: string, request: ApprovalRequest): Promise<ApprovalResponse> =>
    bffFetch<ApprovalResponse>(`/api/ra/authoring/sessions/${sessionId}/reject`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),
};
