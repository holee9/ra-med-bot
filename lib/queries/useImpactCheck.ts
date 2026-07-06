import { useMutation } from '@tanstack/react-query';

// @MX:ANCHOR [AUTO] Impact check mutation hook — POST /api/impact-check
// @MX:REASON Fan-in ≥3: ImpactWizard, wizard tests, integration scenarios
// @MX:SPEC SPEC-V3-IMPACT-UI-001 (REQ-IMP-UI-006)

export interface ImpactCheckRequest {
  orgId: string;
  productId: string;
  changeType: 'bom' | 'sw' | 'sw-minor' | 'label' | 'warn' | 'process' | 'sterile';
  markets: Array<'us' | 'eu' | 'kr' | 'cn' | 'jp'>;
  changeDetail: string;
  // assigneeId omitted in v1 per research.md §6-A2
}

export interface MatrixCell {
  level: string;
  ref: string;
  note: string;
  market: string;
}

export interface Classification {
  category: string;
  confidence: number; // 0..1 float
  reason: string;
}

export interface SimilarCase {
  id: string;
  title: string;
  content: string;
  similarity: number;
}

export interface ImpactCheckResponse {
  matrix: Array<MatrixCell>;
  signal: 'green' | 'yellow' | 'red';
  classification: Classification;
  similarCases?: Array<SimilarCase>; // undefined when low-confidence
  ticketId?: string;
  recommendation: 'high-confidence-auto-approve' | 'low-confidence-manual-review';
}

interface MutationError extends Error {
  status: number;
}

/**
 * TanStack Query mutation hook for POST /api/impact-check
 *
 * Sends camelCase request body (orgId, productId, etc.)
 * Returns response with signal, matrix, classification, similarCases
 * Throws errors for 403/400/500/network failures
 */
export function useImpactCheck() {
  return useMutation({
    mutationFn: async (input: ImpactCheckRequest): Promise<ImpactCheckResponse> => {
      const res = await fetch('/api/impact-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const error = new Error(res.statusText) as MutationError;
        error.status = res.status;

        if (res.status === 403) {
          error.message = 'Forbidden';
        } else if (res.status === 400) {
          const data = await res.json().catch(() => ({ error: 'Bad Request' }));
          error.message = data.error || 'Bad Request';
        } else if (res.status === 500) {
          error.message = 'Internal server error';
        }

        throw error;
      }

      return res.json() as Promise<ImpactCheckResponse>;
    },
  });
}
