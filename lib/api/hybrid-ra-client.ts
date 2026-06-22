// @MX:NOTE [AUTO] Server-side HTTP client for hybrid-ra-saas integration.
// @MX:SPEC SPEC-INTEGRATION-001, Issue #156, Issue #170
// IMPORTANT: Never import this module from client components — it reads server-only env vars.

import { getEnv } from '@/lib/env';

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export type HybridRaErrorKind =
  | 'unconfigured'
  | 'auth'
  | 'schema_mismatch'
  | 'server_error'
  | 'timeout'
  | 'network';

export class HybridRaClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint: string,
    public kind: HybridRaErrorKind = 'server_error',
  ) {
    super(message);
    this.name = 'HybridRaClientError';
  }
}

// ---------------------------------------------------------------------------
// Contract types — SPEC-API-001 (hybrid-ra-saas integration-contract.md)
// ---------------------------------------------------------------------------

// GET /health
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'unavailable';
  version: string;
  uptime_seconds?: number;
}

// GET /sync/manifest
export interface SyncManifestResponse {
  last_sync: string; // ISO-8601
  total_documents: number;
  sync_status: 'synced' | 'stale' | 'unknown' | 'failed' | 'pending' | 'retry-needed';
  tenant_id: string;
}

// POST /rag/query
export interface RagQueryRequest {
  query: string;
  top_k?: number;
  filter?: Record<string, string>;
}

export interface RagCitation {
  source_id: string;
  title: string;
  excerpt: string;
  score: number;
}

export interface RagQueryResponse {
  answer: string;
  citations: RagCitation[];
  confidence: number;
}

// POST /documents/upload
export interface DocumentUploadRequest {
  filename: string;
  content_base64: string;
  metadata?: Record<string, string>;
}

export interface DocumentUploadResponse {
  document_id: string;
  status: 'uploaded' | 'failed';
  created_at: string;
}

// POST /parse/jobs
export interface ParseJobRequest {
  document_id: string;
  parser_type?: 'ifu' | 'technical' | 'clinical';
}

export interface ParseJobResponse {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  created_at: string;
}

// POST /guardrail/run
export interface GuardrailFlag {
  rule: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export interface GuardrailRunRequest {
  content: string;
  context?: string;
  rules?: string[];
}

export interface GuardrailRunResponse {
  safe: boolean;
  flags: GuardrailFlag[];
  processed_at: string;
}

// POST /audit/export
export interface AuditExportRequest {
  from: string; // ISO-8601 date
  to: string; // ISO-8601 date
  format?: 'csv' | 'json';
}

export interface AuditExportResponse {
  export_id: string;
  download_url: string;
  expires_at: string;
  record_count: number;
}

// ---------------------------------------------------------------------------
// Low-level fetch wrapper
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;

function classifyError(statusCode: number): HybridRaErrorKind {
  if (statusCode === 401 || statusCode === 403) return 'auth';
  if (statusCode === 422) return 'schema_mismatch';
  return 'server_error';
}

// @MX:ANCHOR [AUTO] createHybridRaFetch — low-level fetch wrapper for hybrid-ra-saas calls.
// @MX:REASON External system integration point: BFF proxy routes + typed client callers >= 3.
/**
 * Returns a fetch wrapper that injects Bearer + Tenant-ID headers and enforces a request timeout.
 * Throws HybridRaClientError for unconfigured env, auth failure, schema mismatch, or 5xx errors.
 */
export function createHybridRaFetch(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  const env = getEnv();
  const baseUrl = env.HYBRID_RA_API_BASE_URL ?? '';
  const token = env.HYBRID_RA_API_TOKEN ?? '';
  const tenantId = env.HYBRID_RA_TENANT_ID ?? '';

  return async function hybridFetch(path: string, options: RequestInit = {}): Promise<Response> {
    if (!baseUrl || !token) {
      throw new HybridRaClientError('hybrid-ra-saas is not configured', 503, path, 'unconfigured');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': tenantId,
          ...options.headers,
        },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new HybridRaClientError(
          body || res.statusText,
          res.status,
          path,
          classifyError(res.status),
        );
      }

      return res;
    } catch (err) {
      if (err instanceof HybridRaClientError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new HybridRaClientError(
          `Request timed out after ${timeoutMs}ms`,
          504,
          path,
          'timeout',
        );
      }
      throw new HybridRaClientError(
        err instanceof Error ? err.message : 'Network error',
        0,
        path,
        'network',
      );
    } finally {
      clearTimeout(timer);
    }
  };
}

// ---------------------------------------------------------------------------
// @MX:ANCHOR [AUTO] createHybridRaClient — typed adapter for all hybrid-ra-saas endpoints.
// @MX:REASON Public API boundary: used by BFF routes + future callers >= 3; single source of truth for endpoint types.
// ---------------------------------------------------------------------------

/**
 * Returns a typed client for all hybrid-ra-saas SPEC-API-001 endpoints.
 * Use this instead of calling createHybridRaFetch() directly from BFF routes.
 */
export function createHybridRaClient(timeoutMs?: number) {
  const hybridFetch = createHybridRaFetch(timeoutMs);

  return {
    /** GET /health — check backend availability. */
    health(): Promise<HealthResponse> {
      return hybridFetch('/health').then((r) => r.json() as Promise<HealthResponse>);
    },

    /** GET /sync/manifest — retrieve corpus sync status for this tenant. */
    syncManifest(): Promise<SyncManifestResponse> {
      return hybridFetch('/sync/manifest').then((r) => r.json() as Promise<SyncManifestResponse>);
    },

    /** POST /rag/query — run a RAG query against the tenant corpus. */
    ragQuery(req: RagQueryRequest): Promise<RagQueryResponse> {
      return hybridFetch('/rag/query', {
        method: 'POST',
        body: JSON.stringify(req),
      }).then((r) => r.json() as Promise<RagQueryResponse>);
    },

    /** POST /documents/upload — upload a base64-encoded document. */
    uploadDocument(req: DocumentUploadRequest): Promise<DocumentUploadResponse> {
      return hybridFetch('/documents/upload', {
        method: 'POST',
        body: JSON.stringify(req),
      }).then((r) => r.json() as Promise<DocumentUploadResponse>);
    },

    /** POST /parse/jobs — enqueue a document parsing job. */
    createParseJob(req: ParseJobRequest): Promise<ParseJobResponse> {
      return hybridFetch('/parse/jobs', {
        method: 'POST',
        body: JSON.stringify(req),
      }).then((r) => r.json() as Promise<ParseJobResponse>);
    },

    /** POST /guardrail/run — run guardrail checks on content. */
    runGuardrail(req: GuardrailRunRequest): Promise<GuardrailRunResponse> {
      return hybridFetch('/guardrail/run', {
        method: 'POST',
        body: JSON.stringify(req),
      }).then((r) => r.json() as Promise<GuardrailRunResponse>);
    },

    /** POST /audit/export — export audit log for a date range. */
    exportAudit(req: AuditExportRequest): Promise<AuditExportResponse> {
      return hybridFetch('/audit/export', {
        method: 'POST',
        body: JSON.stringify(req),
      }).then((r) => r.json() as Promise<AuditExportResponse>);
    },
  };
}
