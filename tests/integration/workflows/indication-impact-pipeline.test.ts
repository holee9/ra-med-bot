// SPEC-REGULA-WORKFLOWS-LLM-002 — indication-impact pipeline integration tests.
// M1-M3 rewrote executors from synthetic mock → real gx10 via _shared/streaming-chain
// (judgeStructured/streamSection). This test mocks streaming-chain at the executor
// boundary so the full pipeline (executeStep × 6 steps + buildWorkflowSummary) runs
// with controlled LLM output, asserting the NEW behavior: 6 steps run in sequence,
// summary has overallConfidence 0-1, _mock absent.
//
// Pattern: lib/workflows/indication-impact/__tests__/executor.test.ts (vi.mock + vi.mocked).

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/workflows/_shared/streaming-chain', () => ({
  streamSection: vi.fn(),
  judgeStructured: vi.fn(),
  DEFAULT_STREAM_TIMEOUT_MS: 30_000,
  WorkflowLlmError: class WorkflowLlmError extends Error {
    readonly kind: 'timeout' | 'runtime' | 'schema';
    readonly stepName: string;
    constructor(kind: 'timeout' | 'runtime' | 'schema', stepName: string, message: string) {
      super(message);
      this.name = 'WorkflowLlmError';
      this.kind = kind;
      this.stepName = stepName;
    }
  },
}));

import { judgeStructured, streamSection } from '../../../lib/workflows/_shared/streaming-chain';
import {
  type StepResult,
  buildWorkflowSummary,
  executeStep,
} from '../../../lib/workflows/indication-impact/executor';
import { INDICATION_IMPACT_STEPS } from '../../../lib/workflows/indication-impact/steps';
import { IndicationImpactInputSchema } from '../../../lib/workflows/types';

/** Citation-rich prose fixture (every sentence cited → coverage 1.0). */
const CITED_PROSE =
  'The proposed indication expands the patient population.<sup class="cite" data-source="1">1</sup> ' +
  'The 510(k) predicate remains valid under 21 CFR 807.<sup class="cite" data-source="2">2</sup> ' +
  'EU MDR classification is unchanged at Class IIa.<sup class="cite" data-source="3">3</sup>';

/**
 * Dispatch mock responses by stepName. All 5 structured-judgment steps return
 * Zod-schema-shaped objects with `confidence`; the 1 prose-draft step returns
 * `{ text, status }`. This lets the full 6-step pipeline run with controlled
 * output without a real gx10 call.
 */
function mockStreamingChain(): void {
  vi.mocked(judgeStructured).mockImplementation(async (params) => {
    switch (params.stepName) {
      case 'indication_comparison':
        return {
          changeType: 'expansion',
          riskLevel: 'moderate',
          summary: 'The proposed indication expands the patient population to include pediatrics.',
          confidence: 0.88,
        } as never;
      case 'regulatory_pathway_assessment':
        return {
          classificationChangeRequired: true,
          newClass: 'IIb',
          rationale: 'The pediatric indication triggers Rule 11 under EU MDR Annex VIII.',
          confidence: 0.82,
        } as never;
      case 'predicate_impact_analysis':
        return {
          reAssessmentRequired: true,
          rationale: 'The expanded patient population invalidates the predicate SE.',
          predicateImpact: 'new_predicate_needed',
          confidence: 0.85,
        } as never;
      case 'clinical_data_gap_analysis':
        return {
          additionalClinicalDataRequired: true,
          gapDescription: 'Pediatric clinical data is required under EU MDR Annex XIV.',
          confidence: 0.78,
        } as never;
      case 'market_specific_requirements':
        return {
          marketsAnalyzed: ['US', 'EU', 'KR'],
          additionalRequirements: ['CE mark update', 'PMDA notification'],
          confidence: 0.83,
        } as never;
      default:
        throw new Error(`unexpected judgeStructured step: ${params.stepName}`);
    }
  });

  vi.mocked(streamSection).mockResolvedValue({ text: CITED_PROSE, status: 'ok' });
}

const VALID_INDICATION =
  'For use in adult patients with Type 2 diabetes mellitus requiring glucose monitoring.';
const VALID_PROPOSED =
  'For use in adult and pediatric patients with diabetes mellitus requiring continuous glucose monitoring.';

const BASE_CTX = {
  workflowRunId: 'run-impact-001',
  input: {
    current_indication: VALID_INDICATION,
    proposed_indication: VALID_PROPOSED,
    target_markets: ['US', 'EU', 'KR'],
  },
  previousResults: [] as StepResult[],
};

describe('Indication Impact — full pipeline integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStreamingChain();
  });

  it('executes all 6 steps in sequence', async () => {
    const results: StepResult[] = [];

    for (const step of INDICATION_IMPACT_STEPS) {
      const result = await executeStep(step, {
        ...BASE_CTX,
        previousResults: results,
      });
      results.push(result);
    }

    expect(results).toHaveLength(6);
    expect(results.map((r) => r.stepName)).toEqual([...INDICATION_IMPACT_STEPS]);
  });

  it('workflow summary has overallConfidence between 0 and 1', async () => {
    const results: StepResult[] = [];
    for (const step of INDICATION_IMPACT_STEPS) {
      results.push(await executeStep(step, { ...BASE_CTX, previousResults: results }));
    }

    const summary = buildWorkflowSummary(results);
    expect(summary.overallConfidence).toBeGreaterThanOrEqual(0);
    expect(summary.overallConfidence).toBeLessThanOrEqual(1);
    // AC-03: _mock flag must be absent from the new summary.
    expect(summary).not.toHaveProperty('_mock');
  });

  it('IndicationImpactInputSchema rejects target_markets with more than 5 items', () => {
    const result = IndicationImpactInputSchema.safeParse({
      project_id: '00000000-0000-0000-0000-000000000003',
      current_indication: VALID_INDICATION,
      proposed_indication: VALID_PROPOSED,
      target_markets: ['US', 'EU', 'KR', 'JP', 'CN', 'US'], // 6 items — exceeds max(5)
    });
    expect(result.success).toBe(false);
  });

  it('IndicationImpactInputSchema rejects empty target_markets', () => {
    const result = IndicationImpactInputSchema.safeParse({
      project_id: '00000000-0000-0000-0000-000000000003',
      current_indication: VALID_INDICATION,
      proposed_indication: VALID_PROPOSED,
      target_markets: [],
    });
    expect(result.success).toBe(false);
  });

  it('IndicationImpactInputSchema accepts valid input', () => {
    const result = IndicationImpactInputSchema.safeParse({
      project_id: '00000000-0000-0000-0000-000000000003',
      current_indication: VALID_INDICATION,
      proposed_indication: VALID_PROPOSED,
      target_markets: ['US', 'EU', 'KR'],
    });
    expect(result.success).toBe(true);
  });
});
