// @MX:ANCHOR [AUTO] executePmcfPlan — PMCF plan executor (Annex XIV Part B).
// @MX:REASON Regulatory template (REQ-PMS-003, AC-03). fan_in >= 3: API route,
//           executor replay test, UI builder.
// @MX:WARN [AUTO] External LLM call — inject fetchFn in tests.
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-003, AC-03)

import { type ChecklistItem, PMCF_CHECKLIST } from './checklist';

/** Injectable LLM fetch function. */
export type PmcfFetchFn = (
  endpoint: string,
  options?: RequestInit,
) => Promise<{ json: () => Promise<unknown> }>;

/** Input options for the PMCF plan executor. */
export interface PmcfPlanOptions {
  orgId: string;
  userId: string;
  projectId: string;
  deviceName: string;
  deviceClass: string;
}

/** Full executor dependencies. */
export interface PmcfPlanDeps {
  fetchFn?: PmcfFetchFn;
}

/** PMCF plan execution result. */
export interface PmcfPlanResult {
  /** The full Annex XIV Part B checklist (100% coverage, AC-03). */
  checklist: ChecklistItem[];
  /** LLM-drafted content per checklist item id ('' when not drafted). */
  draftedContent: Record<string, string>;
  status: 'complete' | 'partial' | 'draft';
}

const LLM_ENDPOINT = '/api/llm/pmcf-plan';

/**
 * Execute the PMCF plan workflow (REQ-PMS-003).
 *
 * - Always returns the full Annex XIV Part B checklist (AC-03).
 * - When fetchFn is provided, calls the LLM to draft content per item.
 * - status: 'draft' (no LLM), 'partial' (some items drafted), 'complete' (all).
 */
export async function executePmcfPlan(
  options: PmcfPlanOptions,
  deps: PmcfPlanDeps,
): Promise<PmcfPlanResult> {
  // Initialize drafted content as empty for all items.
  const draftedContent: Record<string, string> = {};
  for (const item of PMCF_CHECKLIST) {
    draftedContent[item.id] = '';
  }

  // Call LLM if fetchFn provided.
  if (deps.fetchFn) {
    const llmOutput = await callLlm(deps.fetchFn, options);
    for (const item of PMCF_CHECKLIST) {
      if (typeof llmOutput[item.id] === 'string') {
        draftedContent[item.id] = llmOutput[item.id] as string;
      }
    }
  }

  // Determine status.
  const draftedCount = PMCF_CHECKLIST.filter((c) => draftedContent[c.id] !== '').length;
  let status: PmcfPlanResult['status'];
  if (draftedCount === 0) {
    status = 'draft';
  } else if (draftedCount === PMCF_CHECKLIST.length) {
    status = 'complete';
  } else {
    status = 'partial';
  }

  return {
    checklist: [...PMCF_CHECKLIST],
    draftedContent,
    status,
  };
}

/** Call the LLM endpoint and parse drafted content per checklist item. */
async function callLlm(
  fetchFn: PmcfFetchFn,
  options: PmcfPlanOptions,
): Promise<Record<string, unknown>> {
  const res = await fetchFn(LLM_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({
      deviceName: options.deviceName,
      deviceClass: options.deviceClass,
      checklist: PMCF_CHECKLIST.map((c) => c.id),
    }),
  });
  const payload = (await res.json()) as { result?: string };
  if (!payload.result) return {};
  try {
    return JSON.parse(payload.result) as Record<string, unknown>;
  } catch {
    return {};
  }
}
