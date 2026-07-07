// @MX:NOTE [AUTO] Client-side API helpers + response types for change-control — SPEC-REGULA-CHANGE-CONTROL-001.
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-002, REQ-004, REQ-007, REQ-009, REQ-011)

// @MX:LEGACY archived from lib
//
// These types mirror the shapes returned by the Route Handlers in
// app/api/change-control/*/route.ts. The server is the single source of truth;
// these interfaces exist so the client island can type-check the fetch results.

/** REQ-002: structured input posted to POST /api/change-control/run. */
export interface RunChangeControlInput {
  projectId: string;
  changeType:
    | 'design'
    | 'material'
    | 'manufacturing_process'
    | 'software'
    | 'labeling'
    | 'intended_use';
  description: string;
  impactScope: string;
  targetMarkets: string[];
  riskItemIds?: string[];
}

/** REQ-010: version metadata returned by the run endpoint. */
export interface VersionMetadataResponse {
  modelVersion: string;
  promptVersion: string;
  templateVersion: string;
}

/** Citation backing a verdict (REQ-006). Mirrors VerdictCitation on the server. */
export interface VerdictCitationResponse {
  id: string;
  verdictId: string;
  sourceLabel: string;
  excerpt: string;
}

/** REQ-004: per-jurisdiction verdict as returned by GET/export. */
export interface JurisdictionVerdictResponse {
  id: string;
  assessmentId: string;
  jurisdiction: 'FDA' | 'EU_MDR' | 'MFDS' | 'NMPA' | 'PMDA';
  verdict:
    | 'new_submission_required'
    | 'change_notification'
    | 'internal_record_only'
    | 'not_applicable';
  rationale: string;
  confidence: 'verified' | 'unverified';
  citations: VerdictCitationResponse[];
}

/** ISO 14971 (#46) risk link (REQ-008). */
export interface RiskLinkResponse {
  riskItemId: string;
  title: string;
  severity?: string | null;
  recommendedForReevaluation: boolean;
}

/** Assessment row shape (subset of DB columns the UI needs). */
export interface AssessmentResponse {
  id: string;
  projectId: string;
  changeType: RunChangeControlInput['changeType'];
  description: string;
  impactScope: string;
  status: 'provisional' | 'reviewed' | 'final';
  modelVersion: string;
  promptVersion: string;
  templateVersion: string;
  createdAt: string;
  updatedAt: string | null;
}

/** GET /api/change-control/[assessmentId] response. */
export interface AssessmentDetailResponse {
  assessment: AssessmentResponse;
  verdicts: JurisdictionVerdictResponse[];
  riskLinks: RiskLinkResponse[];
  isProvisional: boolean;
}

/** POST /api/change-control/run response. */
export interface RunChangeControlResponse {
  workflowRunId: string;
  assessmentId: string;
  result: {
    verdicts: JurisdictionVerdictResponse[];
    changeType: RunChangeControlInput['changeType'];
  };
  versions: VersionMetadataResponse;
}

/** POST /api/change-control/[assessmentId]/export response. */
export interface ExportResponse {
  assessment: AssessmentResponse;
  verdicts: JurisdictionVerdictResponse[];
  riskLinks: RiskLinkResponse[];
  exportedAt: string;
  format: 'pdf-json';
}

/** REQ-011: provisional export 403 error body. */
export interface ExportBlockedError {
  error: string;
  code: 'review_required';
  status: string;
  message: string;
}

/**
 * POST /api/change-control/run — submit a structured change assessment.
 * Returns the freshly-created assessmentId so the caller can router.push to it.
 */
export async function runChangeControl(
  input: RunChangeControlInput,
  signal?: AbortSignal,
): Promise<RunChangeControlResponse> {
  const res = await fetch('/api/change-control/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body?.error ?? body?.message ?? `요청 실패 (${res.status})`;
    throw new Error(typeof message === 'string' ? message : '요청 실패');
  }
  return (await res.json()) as RunChangeControlResponse;
}

/**
 * POST /api/change-control/[assessmentId]/review — expert review gate (REQ-009).
 * Transitions provisional → reviewed. Returns 409 if already reviewed.
 */
export async function confirmExpertReview(
  assessmentId: string,
  signal?: AbortSignal,
): Promise<{ ok: true }> {
  const res = await fetch(`/api/change-control/${assessmentId}/review`, {
    method: 'POST',
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code = body?.error ?? body?.code;
    if (code === 'already_reviewed' || res.status === 409) {
      throw new Error('이미 검토 완료된 평가입니다.');
    }
    const message = body?.message ?? `검토 확정 실패 (${res.status})`;
    throw new Error(typeof message === 'string' ? message : '검토 확정 실패');
  }
  return { ok: true };
}

/**
 * POST /api/change-control/[assessmentId]/export — PDF report export (REQ-007).
 * REQ-011: provisional assessments are blocked server-side (403).
 * The route returns the canonical JSON shape (`format: 'pdf-json'`) — the
 * frontend treats this as a structured report download, not a PDF byte stream.
 */
export async function exportAssessment(
  assessmentId: string,
  signal?: AbortSignal,
): Promise<ExportResponse> {
  const res = await fetch(`/api/change-control/${assessmentId}/export`, {
    method: 'POST',
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 403 && body?.code === 'review_required') {
      throw new Error(body?.message ?? '전문가 검토 완료 후 export할 수 있습니다.');
    }
    const message = body?.message ?? body?.error ?? `export 실패 (${res.status})`;
    throw new Error(typeof message === 'string' ? message : 'export 실패');
  }
  return (await res.json()) as ExportResponse;
}
