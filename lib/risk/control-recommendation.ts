// @MX:ANCHOR [AUTO] recommendControls — ISO 14971 §7.1 3-tier control recommendation via RAG.
// @MX:REASON Called by BFF controls/recommend route, wizard UI, and report builder. fan_in >= 3.
// @MX:WARN [AUTO] External RAG call inside recommendControls.
// @MX:REASON External RAG call — latency and failure mode. Always mock in unit tests.
// @MX:SPEC SPEC-REGULA-RISK-001 (T1.9~T1.10, REQ-RISK-021~027)

export type ControlTier = 'inherent' | 'protective' | 'information';

export interface ControlCandidate {
  tier: ControlTier;
  description: string;
  rationale: string | null;
}

type FetchFn = (endpoint: string, options?: RequestInit) => Promise<{ json: () => Promise<unknown> }>;

/**
 * Validate ISO 14971 §7.1 control tier hierarchy constraint.
 * Information-for-safety controls MUST include a rationale explaining why
 * inherent safety design and protective measures are not sufficient.
 */
export function validateControlHierarchy(tier: ControlTier, rationale?: string): void {
  if (tier === 'information') {
    const hasRationale = typeof rationale === 'string' && rationale.trim().length > 0;
    if (!hasRationale) {
      throw new Error(
        'Rationale is required for information-for-safety controls per ISO 14971 §7.1. ' +
          'Explain why inherent safety design and protective measures are insufficient.',
      );
    }
  }
}

/**
 * Recommend 3-tier control measures for a risk item via RAG.
 * Returns candidates ordered by ISO 14971 §7.1 priority hierarchy.
 *
 * @param riskItemId UUID of the risk item to fetch controls for
 * @param fetchFn    Injected fetch function
 */
export async function recommendControls(
  riskItemId: string,
  fetchFn: FetchFn,
): Promise<ControlCandidate[]> {
  const res = await fetchFn('/rag/query', {
    method: 'POST',
    body: JSON.stringify({
      query: `Recommend ISO 14971 §7.1 risk control measures for risk item ${riskItemId}. Return JSON with controls array containing tier (inherent|protective|information), description, and rationale fields.`,
      mode: 'risk_control',
      riskItemId,
    }),
  });

  const data = (await res.json()) as { answer: string };
  const parsed = JSON.parse(data.answer) as { controls: ControlCandidate[] };
  return parsed.controls;
}
