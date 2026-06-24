// @MX:NOTE [AUTO] Client-side API helpers + response types for CAPA — SPEC-REGULA-CAPA-001.
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-001~012, AC-01/04/05/07/08)
//
// These types mirror the shapes returned by the Route Handlers in
// app/api/ra/capa/*/route.ts. The server is the single source of truth;
// these interfaces exist so the client island can type-check the fetch results.
// Mirrors the labeling api-client pattern (lib/labeling/api-client.ts).

import type {
  CapaType,
  ComplaintIntake,
  FishboneAnalysis,
  FiveWhysAnalysis,
  RootCauseMethod,
} from './types';

// ── REQ-001: complaint intake ──────────────────────────────────────────────

/** REQ-001: POST /api/ra/capa/complaints input. */
export interface CreateComplaintInput extends ComplaintIntake {
  projectId: string;
}

/** REQ-001: POST /api/ra/capa/complaints response. */
export interface CreateComplaintResponse {
  complaintId: string;
  reportabilityStatus: 'pending';
  trendSignature: string;
}

// ── REQ-002: reportability assessment ──────────────────────────────────────

/** REQ-002: POST /api/ra/capa/complaints/[id]/reportability response. */
export interface ReportabilityResponse {
  complaintId: string;
  reportabilityStatus: 'reportable' | 'not_reportable';
  fdaMdrRequired: boolean;
  fdaMdrDeadlineDays: number | null;
  euMdvRequired: boolean;
  euMdvDeadlineDays: number | null;
  fscaRequired: boolean;
  vigilanceRef: string | null;
}

// ── REQ-004/005: CAPA record creation ──────────────────────────────────────

/** REQ-008: cross-workflow link input. */
export interface CapaLinkRequest {
  targetType: 'risk' | 'change_control' | 'dhf' | 'pms';
  targetId: string;
}

/** REQ-004/005: POST /api/ra/capa/records input. */
export interface CreateCapaInput {
  projectId: string;
  complaintId: string;
  type: CapaType;
  description: string;
  ownerId: string;
  dueDate: string;
  effectivenessDueDate?: string;
  links?: CapaLinkRequest[];
}

/** REQ-004/005: POST /api/ra/capa/records response. */
export interface CreateCapaResponse {
  capaId: string;
  effectivenessCheckId: string | null;
  linkCount: number;
}

// ── REQ-003: root cause analysis ───────────────────────────────────────────

/** REQ-003: POST /api/ra/capa/records/[id]/root-cause input. */
export interface SaveRootCauseInput {
  method: RootCauseMethod;
  analysisData: FiveWhysAnalysis | FishboneAnalysis;
  summary: string;
}

/** REQ-003: POST /api/ra/capa/records/[id]/root-cause response. */
export interface SaveRootCauseResponse {
  rootCauseId: string;
  capaId: string;
}

// ── REQ-006: effectiveness check ───────────────────────────────────────────

/** REQ-006: POST /api/ra/capa/records/[id]/effectiveness input. */
export interface EffectivenessInput {
  dueDate: string;
  result?: 'effective' | 'ineffective';
  notes?: string;
}

/** REQ-006: POST /api/ra/capa/records/[id]/effectiveness response. */
export interface EffectivenessResponse {
  effectivenessCheckId: string;
  capaId: string;
  result: 'effective' | 'ineffective' | null;
}

// ── REQ-010/011/012: CAPA close (ESIG + gate) ─────────────────────────────

/** REQ-010: POST /api/ra/capa/records/[id]/close input (ESIG payload). */
export interface CloseCapaInput {
  signerName: string;
  signerTitle?: string;
  meaning: string;
}

/** REQ-010: POST /api/ra/capa/records/[id]/close response (success). */
export interface CloseCapaResponse {
  capaId: string;
  status: 'closed';
  closedBy: string;
  signerName: string;
}

/** REQ-011: close 403 error body (vigilance gate). */
export interface CloseBlockedResponse {
  error: 'close_blocked';
  reason: string;
}

// ── REQ-009: QMS sync stub ─────────────────────────────────────────────────

/** REQ-009: POST /api/ra/capa/records/[id]/qms-sync response (stub). */
export interface QmsSyncResponse {
  capaId: string;
  qmsSync: { synced: boolean; payload?: unknown };
  stubNotice: string;
}

// ── fetch helpers ──────────────────────────────────────────────────────────

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = json?.error ?? `요청 실패 (${res.status})`;
    const err = new Error(typeof message === 'string' ? message : '요청 실패');
    (err as Error & { status?: number }).status = res.status;
    (err as Error & { body?: unknown }).body = json;
    throw err;
  }
  return json as T;
}

/** REQ-001: POST /api/ra/capa/complaints — structured complaint intake. */
export function createComplaint(
  input: CreateComplaintInput,
  signal?: AbortSignal,
): Promise<CreateComplaintResponse> {
  return postJson<CreateComplaintResponse>('/api/ra/capa/complaints', input, signal);
}

/** REQ-002: POST .../reportability — assess + link vigilance. */
export function assessReportability(
  complaintId: string,
  signal?: AbortSignal,
): Promise<ReportabilityResponse> {
  return postJson<ReportabilityResponse>(
    `/api/ra/capa/complaints/${complaintId}/reportability`,
    {},
    signal,
  );
}

/** REQ-004/005: POST /api/ra/capa/records — create corrective/preventive CAPA. */
export function createCapa(
  input: CreateCapaInput,
  signal?: AbortSignal,
): Promise<CreateCapaResponse> {
  return postJson<CreateCapaResponse>('/api/ra/capa/records', input, signal);
}

/** REQ-003: POST .../root-cause — save 5 Whys or Fishbone analysis. */
export function saveRootCause(
  capaId: string,
  input: SaveRootCauseInput,
  signal?: AbortSignal,
): Promise<SaveRootCauseResponse> {
  return postJson<SaveRootCauseResponse>(
    `/api/ra/capa/records/${capaId}/root-cause`,
    input,
    signal,
  );
}

/** REQ-006: POST .../effectiveness — schedule or record effectiveness check. */
export function checkEffectiveness(
  capaId: string,
  input: EffectivenessInput,
  signal?: AbortSignal,
): Promise<EffectivenessResponse> {
  return postJson<EffectivenessResponse>(
    `/api/ra/capa/records/${capaId}/effectiveness`,
    input,
    signal,
  );
}

/**
 * REQ-010/011/012: POST .../close — close CAPA with ESIG + vigilance gate.
 * Throws with `.status === 403` and `.body` as CloseBlockedResponse when the
 * server blocks close due to a reportable complaint lacking vigilance linkage.
 */
export function closeCapa(
  capaId: string,
  input: CloseCapaInput,
  signal?: AbortSignal,
): Promise<CloseCapaResponse> {
  return postJson<CloseCapaResponse>(`/api/ra/capa/records/${capaId}/close`, input, signal);
}

/** REQ-009: POST .../qms-sync — stub QMS sync (no-op until #57). */
export function syncQms(capaId: string, signal?: AbortSignal): Promise<QmsSyncResponse> {
  return postJson<QmsSyncResponse>(`/api/ra/capa/records/${capaId}/qms-sync`, {}, signal);
}
