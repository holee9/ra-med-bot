// @MX:NOTE [AUTO] Browser-side BFF client for Traceability API. Never imports server-only modules.
// @MX:SPEC SPEC-INTEGRATION-001 (issue #169)

export interface TraceNode {
  id: string;
  type: 'requirement' | 'component' | 'test' | 'document';
  label: string;
  metadata?: Record<string, string>;
}

export interface TraceEdge {
  source: string;
  target: string;
  relationship: string;
}

export interface ScanResult {
  scan_id: string;
  nodes_scanned: number;
  status: 'completed' | 'in_progress' | 'failed';
  timestamp: string;
}

export interface TraceGraph {
  nodes: TraceNode[];
  edges: TraceEdge[];
  metadata: {
    total_nodes: number;
    total_edges: number;
    scan_id?: string;
    generated_at: string;
  };
}

export interface ImpactedNode {
  node_id: string;
  label: string;
  type: string;
  risk: 'high' | 'medium' | 'low';
  reason: string;
}

export interface ImpactResult {
  change_id: string;
  impacted_nodes: ImpactedNode[];
  risk_level: 'high' | 'medium' | 'low';
  recommendations: string[];
}

export interface ScanRequest {
  scope?: string;
  include_types?: string[];
}

export interface ImpactRequest {
  changed_node_id: string;
  change_description?: string;
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

export const traceabilityClient = {
  scan: (request: ScanRequest = {}): Promise<ScanResult> =>
    bffFetch<ScanResult>('/api/ra/traceability/scan', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  getGraph: (scanId?: string): Promise<TraceGraph> => {
    const url = scanId
      ? `/api/ra/traceability/graph?scan_id=${encodeURIComponent(scanId)}`
      : '/api/ra/traceability/graph';
    return bffFetch<TraceGraph>(url);
  },

  analyzeImpact: (request: ImpactRequest): Promise<ImpactResult> =>
    bffFetch<ImpactResult>('/api/ra/traceability/impact', {
      method: 'POST',
      body: JSON.stringify(request),
    }),
};
