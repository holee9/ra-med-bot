// @MX:ANCHOR [AUTO] identifyHazards — RAG-based ISO 14971 hazard identification.
// @MX:REASON Entry point for BFF /identify route, report builder, and eval harness. fan_in >= 3.
// @MX:WARN [AUTO] External RAG call inside identifyHazards.
// @MX:REASON External RAG call — latency and failure mode. Always mock in unit tests.
// @MX:SPEC SPEC-REGULA-RISK-001 (T1.6~T1.8, REQ-RISK-001~010)

export interface HazardCitation {
  source: string;
  id: string;
}

export interface HazardItem {
  hazard: string;
  sequenceOfEvents: string;
  hazardousSituation: string;
  harm: string;
  citation: HazardCitation[];
  confidence: number;
  lowConfidence: boolean;
}

export interface ParsedHazardResponse {
  items: HazardItem[];
  lowConfidenceCount: number;
}

type FetchFn = (endpoint: string, options?: RequestInit) => Promise<{ json: () => Promise<unknown> }>;

/**
 * Build a structured prompt for ISO 14971 hazard identification via RAG.
 */
export function buildHazardPrompt(deviceDescription: string, deviceClass: string): string {
  return `You are a medical device risk management expert applying ISO 14971:2019.

Device Description: ${deviceDescription}
Device Classification: ${deviceClass}

Task: Identify potential hazards for this medical device following ISO 14971 Annex C methodology.

For each hazard, provide:
1. hazard: The root cause or energy/material source
2. sequenceOfEvents: Chain of events from hazard to hazardous situation
3. hazardousSituation: The situation arising from the hazard sequence
4. harm: Physical injury or damage to health (patient, operator, or third party)
5. citation: Array of references supporting this hazard identification (MAUDE, literature, standards)
6. confidence: Your confidence score (0.0-1.0)

Consider: use errors, software failures, mechanical failures, electrical hazards, biological hazards,
environmental conditions, and foreseeable misuse.

Return a JSON object with this exact structure:
{"items": [{"hazard": "...", "sequenceOfEvents": "...", "hazardousSituation": "...", "harm": "...", "citation": [{"source": "...", "id": "..."}], "confidence": 0.0}]}`;
}

/**
 * Parse RAG response into structured HazardItem array.
 * Sets lowConfidence=true for items with confidence < 0.7 or empty citations.
 */
export function parseHazardResponse(rawResponse: string): ParsedHazardResponse {
  let parsed: { items: Array<Record<string, unknown>> };
  try {
    parsed = JSON.parse(rawResponse) as { items: Array<Record<string, unknown>> };
  } catch {
    throw new SyntaxError(`Invalid JSON from hazard identification response: ${rawResponse.slice(0, 100)}`);
  }

  if (!Array.isArray(parsed.items)) {
    throw new TypeError('Hazard response missing "items" array');
  }

  const LOW_CONFIDENCE_THRESHOLD = 0.7;
  let lowConfidenceCount = 0;

  const items: HazardItem[] = parsed.items.map((raw) => {
    const citation = (raw.citation as HazardCitation[]) ?? [];
    const confidence = (raw.confidence as number) ?? 0;
    const hasCitation = Array.isArray(citation) && citation.length > 0;
    const isLowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD || !hasCitation;

    if (isLowConfidence) lowConfidenceCount++;

    return {
      hazard: raw.hazard as string,
      sequenceOfEvents: raw.sequenceOfEvents as string,
      hazardousSituation: raw.hazardousSituation as string,
      harm: raw.harm as string,
      citation,
      confidence,
      lowConfidence: isLowConfidence,
    };
  });

  return { items, lowConfidenceCount };
}

/**
 * Identify hazards via RAG query to hybrid-ra-saas.
 *
 * @param deviceDescription Human-readable device functional description
 * @param deviceClass       Device classification (Class I/II/III or SaMD level)
 * @param fetchFn           Injected fetch function (createHybridRaFetch in prod, vi.fn() in tests)
 */
export async function identifyHazards(
  deviceDescription: string,
  deviceClass: string,
  fetchFn: FetchFn,
): Promise<ParsedHazardResponse> {
  const prompt = buildHazardPrompt(deviceDescription, deviceClass);

  const res = await fetchFn('/rag/query', {
    method: 'POST',
    body: JSON.stringify({ query: prompt, mode: 'risk_identification' }),
  });

  const data = (await res.json()) as { answer: string };
  return parseHazardResponse(data.answer);
}
