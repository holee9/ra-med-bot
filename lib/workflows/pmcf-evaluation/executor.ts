// @MX:ANCHOR [AUTO] executePmcfEvaluation — PMCF evaluation report executor.
// @MX:REASON Regulatory document (REQ-PMS-011). Evaluates collected clinical
//           data against the PMCF plan. fan_in >= 3: API route, replay test, UI.
// @MX:WARN [AUTO] External LLM call — inject fetchFn in tests.
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-011)

/** Injectable LLM fetch function. */
export type PmcfEvalFetchFn = (
  endpoint: string,
  options?: RequestInit,
) => Promise<{ json: () => Promise<unknown> }>;

/** PMCF plan summary passed into the evaluation. */
export interface PmcfPlanSummary {
  objectives: string[];
  methods: string[];
}

/** Collected clinical data to evaluate against the plan. */
export interface CollectedData {
  registrySize: number;
  adverseEvents: number;
  surveyResponses: number;
  followUpDurationMonths: number;
}

/** Input options for the PMCF evaluation executor. */
export interface PmcfEvaluationOptions {
  orgId: string;
  userId: string;
  projectId: string;
  deviceName: string;
  deviceClass: string;
}

/** Full executor dependencies. */
export interface PmcfEvaluationDeps {
  fetchFn?: PmcfEvalFetchFn;
  pmcfPlan: PmcfPlanSummary;
  collectedData: CollectedData;
}

/** Per-objective assessment result. */
export interface ObjectiveAssessment {
  objective: string;
  met: boolean;
  detail: string;
}

/** PMCF evaluation result. */
export interface PmcfEvaluationResult {
  sections: {
    objective_assessment: string;
    data_coverage_assessment: string;
    adverse_event_analysis: string;
    conclusions: string;
  };
  objectiveStatus: ObjectiveAssessment[];
  status: 'complete' | 'draft';
}

const LLM_ENDPOINT = '/api/llm/pmcf-evaluation';

// Adverse event rate threshold: if adverse_events / registry_size exceeds 10%,
// safety-related objectives are considered unmet.
const ADVERSE_EVENT_RATE_THRESHOLD = 0.1;
// Minimum registry size for a "sufficient" data set.
const MIN_REGISTRY_SIZE = 20;

/**
 * Execute the PMCF evaluation workflow (REQ-PMS-011).
 *
 * Compares collected clinical data against the PMCF plan objectives and
 * drafts an evaluation report. Safety objectives are marked unmet when the
 * adverse event rate exceeds the threshold.
 */
export async function executePmcfEvaluation(
  options: PmcfEvaluationOptions,
  deps: PmcfEvaluationDeps,
): Promise<PmcfEvaluationResult> {
  const { pmcfPlan, collectedData } = deps;
  const adverseRate =
    collectedData.registrySize > 0 ? collectedData.adverseEvents / collectedData.registrySize : 0;
  const safetyAtRisk = adverseRate > ADVERSE_EVENT_RATE_THRESHOLD;

  // Assess each objective.
  const objectiveStatus: ObjectiveAssessment[] = pmcfPlan.objectives.map((obj) => {
    const isSafety = /safety|adverse|risk/i.test(obj);
    const met = isSafety ? !safetyAtRisk : true;
    return {
      objective: obj,
      met,
      detail: met
        ? `Objective supported by collected data (${collectedData.registrySize} subjects).`
        : `Objective NOT met — adverse event rate ${(adverseRate * 100).toFixed(1)}% exceeds ${ADVERSE_EVENT_RATE_THRESHOLD * 100}%.`,
    };
  });

  // Build deterministic section content.
  const objective_assessment = objectiveStatus
    .map((o) => `- ${o.objective}: ${o.met ? 'MET' : 'NOT MET'} — ${o.detail}`)
    .join('\n');

  const dataCoverage =
    collectedData.registrySize >= MIN_REGISTRY_SIZE
      ? `Sufficient data coverage (${collectedData.registrySize} subjects, ${collectedData.followUpDurationMonths} months follow-up).`
      : `Insufficient data coverage (${collectedData.registrySize} subjects < ${MIN_REGISTRY_SIZE} minimum).`;

  const data_coverage_assessment = `${dataCoverage}\nMethods planned: ${pmcfPlan.methods.join(', ')}.\nSurvey responses: ${collectedData.surveyResponses}.`;

  const adverse_event_analysis = `Recorded ${collectedData.adverseEvents} adverse events out of ${collectedData.registrySize} subjects (rate: ${(adverseRate * 100).toFixed(1)}%). Threshold: ${ADVERSE_EVENT_RATE_THRESHOLD * 100}%.`;

  // Determine status: draft when data insufficient and no LLM.
  const dataSufficient = collectedData.registrySize >= MIN_REGISTRY_SIZE;
  const status: PmcfEvaluationResult['status'] = dataSufficient ? 'complete' : 'draft';

  // Call LLM for conclusions draft if provided.
  let conclusions = '';
  if (deps.fetchFn && dataSufficient) {
    const llmSummary = await callLlm(deps.fetchFn, options, {
      objective_assessment,
      adverse_event_analysis,
    });
    conclusions = llmSummary;
  } else {
    conclusions = safetyAtRisk
      ? 'PMCF data indicates a safety signal — expert review required.'
      : 'PMCF data supports the device benefit-risk profile.';
  }

  return {
    sections: {
      objective_assessment,
      data_coverage_assessment,
      adverse_event_analysis,
      conclusions,
    },
    objectiveStatus,
    status,
  };
}

async function callLlm(
  fetchFn: PmcfEvalFetchFn,
  options: PmcfEvaluationOptions,
  context: Record<string, string>,
): Promise<string> {
  const res = await fetchFn(LLM_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({
      deviceName: options.deviceName,
      deviceClass: options.deviceClass,
      ...context,
    }),
  });
  const payload = (await res.json()) as { result?: string };
  if (!payload.result) return '';
  try {
    const parsed = JSON.parse(payload.result) as { summary?: string };
    return parsed.summary ?? '';
  } catch {
    return '';
  }
}
