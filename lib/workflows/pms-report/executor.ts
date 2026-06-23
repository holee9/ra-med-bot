// @MX:ANCHOR [AUTO] executePmsReport — PMS report executor (MDCG 2022-21).
// @MX:REASON Regulatory document generation (REQ-PMS-002, AC-02). fan_in >= 3:
//           API route, executor replay regression test, UI wizard.
// @MX:WARN [AUTO] External LLM call — inject fetchFn/retrieveFn in tests.
// @MX:REASON Network call — latency and failure mode. Tests inject mocks.
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-002, REQ-PMS-004, REQ-PMS-005, REQ-PMS-008)

import type { InternalDocsOptions, RetrieverResult } from '../../ai/retrievers/internal-docs';
import { PMS_REPORT_SECTIONS, type PmsReportSection, SUSAR_TREND_TEMPLATE } from './sections';
import { type PmsCitation, type PmsRetrievedSource, validatePmsCitations } from './validate';

/** Injectable LLM fetch function (same pattern as classify ClassifyFetchFn). */
export type PmsFetchFn = (
  endpoint: string,
  options?: RequestInit,
) => Promise<{ json: () => Promise<unknown> }>;

/** Injectable RAG retriever returning PmsRetrievedSource arrays. */
export type PmsRetriever = (query: string) => Promise<PmsRetrievedSource[]>;

/** CER linkage data from the same project (REQ-PMS-004). */
export interface CerLinkageData {
  cerId: string;
  deviceName: string;
  intendedUse: string;
  riskProfile: string;
}

/** Input options for the PMS report executor. */
export interface PmsReportOptions {
  orgId: string;
  userId: string;
  projectId: string;
  deviceName: string;
  deviceClass: string;
}

/** Full executor dependencies (injected for testability). */
export interface PmsReportDeps {
  fetchFn?: PmsFetchFn;
  retrieveFn: PmsRetriever;
  cerData: CerLinkageData | null;
}

/** PMS report execution result. */
export interface PmsReportResult {
  sections: Record<PmsReportSection, string>;
  citations: PmsCitation[];
  status: 'complete' | 'pending';
  confidence: 'verified' | 'unverified';
  cerLinked: boolean;
  cerRefId: string | null;
  /** True when the LLM was actually called (false on zero-results path). */
  llmCalled: boolean;
}

const LLM_ENDPOINT = '/api/llm/pms-report';

/**
 * Execute the PMS report workflow (REQ-PMS-002).
 *
 * Flow:
 *   1. RAG-retrieve EU MDR Article 83-86 + MDCG 2022-21 guidance.
 *   2. If zero sources → return pending, unverified, LLM NOT called (C2).
 *   3. Otherwise call the LLM to draft section content.
 *   4. validatePmsCitations (REQ-PMS-008): strip hallucinated refs.
 *   5. If all citations unmatched → downgrade to pending.
 *   6. Auto-link CER data (REQ-PMS-004) when cerData is provided.
 *   7. Inject SUSAR/trend reporting template (REQ-PMS-005).
 */
export async function executePmsReport(
  options: PmsReportOptions,
  deps: PmsReportDeps,
): Promise<PmsReportResult> {
  // 1. Retrieve.
  const sources = await deps.retrieveFn(
    `EU MDR Article 83-86 PMS report MDCG 2022-21 ${options.deviceName} ${options.deviceClass}`,
  );

  // 2. Zero-results: pending, no LLM call.
  if (sources.length === 0) {
    return {
      sections: emptySections(),
      citations: [],
      status: 'pending',
      confidence: 'unverified',
      cerLinked: false,
      cerRefId: null,
      llmCalled: false,
    };
  }

  // 3. Call LLM (if fetchFn provided).
  const fetchFn = deps.fetchFn;
  const llmCalled = fetchFn !== undefined;
  const llmOutput = fetchFn ? await callLlm(fetchFn, options) : { sections: {}, citations: [] };

  // 4. Validate citations.
  const validation = validatePmsCitations(llmOutput.citations, sources);

  // 5. Build sections.
  const sections = buildSections(llmOutput.sections, deps.cerData);

  // 6. Determine status.
  const status: 'complete' | 'pending' = validation.allUnmatched ? 'pending' : 'complete';

  return {
    sections,
    citations: validation.citations,
    status,
    confidence: validation.confidence,
    cerLinked: deps.cerData !== null,
    cerRefId: deps.cerData?.cerId ?? null,
    llmCalled,
  };
}

/** Call the LLM endpoint and parse section content + citations. */
async function callLlm(
  fetchFn: PmsFetchFn,
  options: PmsReportOptions,
): Promise<{ sections: Record<string, string>; citations: PmsCitation[] }> {
  const res = await fetchFn(LLM_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({
      deviceName: options.deviceName,
      deviceClass: options.deviceClass,
      sections: PMS_REPORT_SECTIONS,
    }),
  });
  const payload = (await res.json()) as { result?: string };
  const parsed = payload.result ? safeParse(payload.result) : {};
  const citations = Array.isArray(parsed._citations) ? (parsed._citations as PmsCitation[]) : [];
  const sections: Record<string, string> = {};
  for (const s of PMS_REPORT_SECTIONS) {
    if (typeof parsed[s] === 'string') {
      sections[s] = parsed[s] as string;
    }
  }
  return { sections, citations };
}

/** Build the full section map, merging LLM output, CER data, and templates. */
function buildSections(
  llmSections: Record<string, string>,
  cerData: CerLinkageData | null,
): Record<PmsReportSection, string> {
  const sections = emptySections();
  for (const s of PMS_REPORT_SECTIONS) {
    if (llmSections[s]) {
      sections[s] = llmSections[s];
    }
  }
  // SUSAR/trend reporting template (REQ-PMS-005) — always present.
  if (!sections.susar_trend_reporting) {
    sections.susar_trend_reporting = `${SUSAR_TREND_TEMPLATE.heading}. Required fields: ${SUSAR_TREND_TEMPLATE.requiredFields.join(', ')}.`;
  }
  // CER linkage (REQ-PMS-004).
  if (cerData) {
    sections.pmcf_findings = `[Linked CER: ${cerData.cerId}]\nDevice: ${cerData.deviceName}\nIntended use: ${cerData.intendedUse}\nRisk profile: ${cerData.riskProfile}\n${sections.pmcf_findings}`;
  }
  return sections;
}

function emptySections(): Record<PmsReportSection, string> {
  const map = {} as Record<PmsReportSection, string>;
  for (const s of PMS_REPORT_SECTIONS) {
    map[s] = '';
  }
  return map;
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// Re-export for external consumers (API route needs the retriever type).
export type { InternalDocsOptions, RetrieverResult };
