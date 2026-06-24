// @MX:NOTE [AUTO] Client-side API helpers + response types for labeling — SPEC-REGULA-LABELING-001.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-001, REQ-002, REQ-003, REQ-006, REQ-007, REQ-012)
//
// These types mirror the shapes returned by the Route Handlers in
// app/api/labeling/*/route.ts. The server is the single source of truth;
// these interfaces exist so the client island can type-check the fetch results.
// Mirrors the change-control api-client pattern (lib/change-control/api-client.ts).

import type {
  LabelingClaimType,
  LabelingDocumentStatus,
  LabelingJurisdiction,
  LabelingSectionType,
  SemanticDiffStatus,
} from './types';

/** REQ-001: POST /api/labeling/documents input. */
export interface CreateLabelingDocumentInput {
  projectId: string;
  productName: string;
  jurisdiction: LabelingJurisdiction;
  locale?: string;
}

/** REQ-001: POST /api/labeling/documents response. */
export interface CreateLabelingDocumentResponse {
  documentId: string;
}

/** Section row as returned by GET /api/labeling/documents/[id]. */
export interface LabelingSectionResponse {
  id: string;
  documentId: string;
  sectionType: LabelingSectionType;
  content: string;
  locale: string;
}

/** Document row as returned by GET /api/labeling/documents/[id]. */
export interface LabelingDocumentResponse {
  id: string;
  projectId: string;
  productName: string;
  jurisdiction: LabelingJurisdiction;
  status: LabelingDocumentStatus;
  orgId: string;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

/** GET /api/labeling/documents/[id] response. */
export interface LabelingDocumentDetailResponse {
  document: LabelingDocumentResponse;
  sections: LabelingSectionResponse[];
}

/** REQ-002/011: GET /api/labeling/documents/[id]/checklist response. */
export interface ChecklistEvaluationResponse {
  jurisdiction: LabelingJurisdiction;
  total: number;
  satisfied: number;
  missing: Array<{
    id: string;
    title: string;
    ref?: string;
    sectionType?: LabelingSectionType;
  }>;
  coveragePercent: number;
}

/** REQ-003: citation input posted alongside a claim. */
export interface ClaimCitationInput {
  source: string;
  section?: string;
  excerpt: string;
}

/** REQ-003: POST /api/labeling/documents/[id]/claims input. */
export interface CreateClaimInput {
  sectionId: string;
  claimText: string;
  citations: ClaimCitationInput[];
}

/** REQ-003/004/005: POST /api/labeling/documents/[id]/claims response. */
export interface CreateClaimResponse {
  claimId: string;
  claimType: LabelingClaimType;
  expertReviewRequired: boolean;
  groundedCitationCount: number;
  rejectedCitationCount: number;
  isComparative: boolean;
  isSuperiority: boolean;
  matchedKeywords: string[];
}

/** REQ-007: POST /api/labeling/documents/[id]/translations input. */
export interface CreateTranslationInput {
  sectionId: string;
  sourceLocale: string;
  targetLocale: string;
  targetText: string;
}

/** REQ-007: POST /api/labeling/documents/[id]/translations response. */
export interface CreateTranslationResponse {
  translationId: string;
  diffStatus: SemanticDiffStatus;
  details: Array<{ type: string; description: string }>;
}

/** REQ-006/009: POST /api/labeling/documents/[id]/approve response. */
export interface ApproveDocumentResponse {
  documentId: string;
  status: 'approved';
  /** #65 eSubmit forward result — stub returns forwarded:false until #65 ships. */
  esubmitForwarded: boolean;
  esubmitDetail?: string;
}

/** REQ-006: POST /api/labeling/documents/[id]/export response (success). */
export interface ExportDocumentResponse {
  documentId: string;
  productName: string;
  jurisdiction: LabelingJurisdiction;
  status: LabelingDocumentStatus;
  exportedAt: string;
}

/** REQ-006: export 403 error body. */
export interface ExportBlockedResponse {
  error: string;
  reason?: string;
  blockingClaimCount: number;
}

/**
 * REQ-001: POST /api/labeling/documents — create a structured labeling document.
 * Returns the freshly-created documentId so the caller can router.push to it.
 */
export async function createLabelingDocument(
  input: CreateLabelingDocumentInput,
  signal?: AbortSignal,
): Promise<CreateLabelingDocumentResponse> {
  const res = await fetch('/api/labeling/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body?.error ?? `요청 실패 (${res.status})`;
    throw new Error(typeof message === 'string' ? message : '요청 실패');
  }
  return (await res.json()) as CreateLabelingDocumentResponse;
}

/**
 * REQ-002/011: GET /api/labeling/documents/[id]/checklist — jurisdiction
 * required-elements coverage. Optional jurisdiction override.
 */
export async function fetchChecklist(
  documentId: string,
  jurisdiction?: LabelingJurisdiction,
  signal?: AbortSignal,
): Promise<ChecklistEvaluationResponse> {
  const qs = jurisdiction ? `?jurisdiction=${jurisdiction}` : '';
  const res = await fetch(`/api/labeling/documents/${documentId}/checklist${qs}`, {
    headers: { 'Content-Type': 'application/json' },
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body?.error ?? `체크리스트 조회 실패 (${res.status})`;
    throw new Error(typeof message === 'string' ? message : '체크리스트 조회 실패');
  }
  return (await res.json()) as ChecklistEvaluationResponse;
}

/**
 * REQ-003/004/005: POST /api/labeling/documents/[id]/claims — create + validate
 * a claim. Returns the claim classification + warning flags.
 */
export async function createClaim(
  documentId: string,
  input: CreateClaimInput,
  signal?: AbortSignal,
): Promise<CreateClaimResponse> {
  const res = await fetch(`/api/labeling/documents/${documentId}/claims`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body?.error ?? `claim 생성 실패 (${res.status})`;
    throw new Error(typeof message === 'string' ? message : 'claim 생성 실패');
  }
  return (await res.json()) as CreateClaimResponse;
}

/**
 * REQ-007: POST /api/labeling/documents/[id]/translations — register + diff
 * a translation. major_diff forces the RA approval gate.
 */
export async function createTranslation(
  documentId: string,
  input: CreateTranslationInput,
  signal?: AbortSignal,
): Promise<CreateTranslationResponse> {
  const res = await fetch(`/api/labeling/documents/${documentId}/translations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body?.error ?? `번역 등록 실패 (${res.status})`;
    throw new Error(typeof message === 'string' ? message : '번역 등록 실패');
  }
  return (await res.json()) as CreateTranslationResponse;
}

/**
 * REQ-012: POST /api/labeling/documents/[id]/approve — RA-lead approval gate.
 * Server rejects (409) when preconditions fail (unsupported claims, incomplete
 * checklist, pending translations).
 */
export async function approveDocument(
  documentId: string,
  signal?: AbortSignal,
): Promise<ApproveDocumentResponse> {
  const res = await fetch(`/api/labeling/documents/${documentId}/approve`, {
    method: 'POST',
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 409) {
      // Precondition failure — surface the server's reason verbatim.
      const reason =
        body?.error ?? '승인 조건이 충족되지 않았습니다 (미해결 claim/체크리스트/번역).';
      throw new Error(typeof reason === 'string' ? reason : '승인 조건 미충족');
    }
    const message = body?.error ?? `승인 실패 (${res.status})`;
    throw new Error(typeof message === 'string' ? message : '승인 실패');
  }
  return (await res.json()) as ApproveDocumentResponse;
}

/**
 * REQ-006: POST /api/labeling/documents/[id]/export — export with unsupported
 * claim gate. Returns 403 when blocking claims exist.
 */
export async function exportDocument(
  documentId: string,
  signal?: AbortSignal,
): Promise<ExportDocumentResponse> {
  const res = await fetch(`/api/labeling/documents/${documentId}/export`, {
    method: 'POST',
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 403) {
      const err = body as ExportBlockedResponse;
      const count = typeof err?.blockingClaimCount === 'number' ? err.blockingClaimCount : 0;
      throw new Error(`export가 차단되었습니다. 미해결 claim ${count}건이 존재합니다. (REQ-006)`);
    }
    const message = body?.error ?? `export 실패 (${res.status})`;
    throw new Error(typeof message === 'string' ? message : 'export 실패');
  }
  return (await res.json()) as ExportDocumentResponse;
}
