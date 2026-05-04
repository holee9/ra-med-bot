import { describe, expect, it } from 'vitest';
import {
  type StepResult,
  buildWorkflowSummary,
  executeStep,
} from '../../../lib/workflows/indication-impact/executor';
import { INDICATION_IMPACT_STEPS } from '../../../lib/workflows/indication-impact/steps';
import { IndicationImpactInputSchema } from '../../../lib/workflows/types';

const BASE_CTX = {
  workflowRunId: 'run-impact-001',
  input: {},
  previousResults: [] as StepResult[],
};

const VALID_INDICATION =
  'For use in adult patients with Type 2 diabetes mellitus requiring glucose monitoring.';
const VALID_PROPOSED =
  'For use in adult and pediatric patients with diabetes mellitus requiring continuous glucose monitoring.';

describe('Indication Impact — full pipeline integration', () => {
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
