import { describe, expect, it } from 'vitest';
import { executePmcfEvaluation } from '../executor';

// SPEC-REGULA-PMS-001 (REQ-PMS-011): PMCF evaluation report executor.
// Evaluates collected clinical data against the PMCF plan.

type FetchFn = (
  endpoint: string,
  options?: RequestInit,
) => Promise<{ json: () => Promise<unknown> }>;

function makeFetchFn(response: Record<string, unknown>): FetchFn {
  return async () => ({ json: async () => ({ result: JSON.stringify(response) }) });
}

const pmcfPlan = {
  objectives: ['Confirm long-term safety', 'Detect rare adverse events'],
  methods: ['registry', 'user_survey'],
};

const collectedData = {
  registrySize: 250,
  adverseEvents: 3,
  surveyResponses: 45,
  followUpDurationMonths: 12,
};

describe('executePmcfEvaluation — PMCF plan vs collected data', () => {
  it('generates evaluation sections comparing plan vs data (REQ-PMS-011)', async () => {
    const result = await executePmcfEvaluation(
      {
        orgId: 'org-1',
        userId: 'user-1',
        projectId: 'proj-1',
        deviceName: 'Dev',
        deviceClass: 'IIa',
      },
      { fetchFn: makeFetchFn({ summary: 'Evaluation draft...' }), pmcfPlan, collectedData },
    );
    expect(result.sections).toHaveProperty('objective_assessment');
    expect(result.sections).toHaveProperty('data_coverage_assessment');
    expect(result.sections).toHaveProperty('adverse_event_analysis');
    expect(result.sections).toHaveProperty('conclusions');
  });

  it('flags unmet objective when adverse events exceed threshold', async () => {
    const result = await executePmcfEvaluation(
      {
        orgId: 'org-1',
        userId: 'user-1',
        projectId: 'proj-1',
        deviceName: 'Dev',
        deviceClass: 'IIa',
      },
      {
        fetchFn: makeFetchFn({}),
        pmcfPlan,
        collectedData: { ...collectedData, adverseEvents: 50 },
      },
    );
    expect(result.objectiveStatus.some((o) => o.met === false)).toBe(true);
  });

  it('marks all objectives met when adverse events are low', async () => {
    const result = await executePmcfEvaluation(
      {
        orgId: 'org-1',
        userId: 'user-1',
        projectId: 'proj-1',
        deviceName: 'Dev',
        deviceClass: 'IIa',
      },
      { fetchFn: makeFetchFn({}), pmcfPlan, collectedData },
    );
    expect(result.objectiveStatus.every((o) => o.met === true)).toBe(true);
  });

  it('includes LLM-drafted summary when fetchFn is provided', async () => {
    const result = await executePmcfEvaluation(
      {
        orgId: 'org-1',
        userId: 'user-1',
        projectId: 'proj-1',
        deviceName: 'Dev',
        deviceClass: 'IIa',
      },
      {
        fetchFn: makeFetchFn({ summary: 'The collected data confirms...' }),
        pmcfPlan,
        collectedData,
      },
    );
    expect(result.sections.conclusions).toContain('confirms');
  });

  it('returns draft status when no LLM and data is insufficient', async () => {
    const result = await executePmcfEvaluation(
      {
        orgId: 'org-1',
        userId: 'user-1',
        projectId: 'proj-1',
        deviceName: 'Dev',
        deviceClass: 'IIa',
      },
      { pmcfPlan, collectedData: { ...collectedData, registrySize: 5 } },
    );
    expect(result.status).toBe('draft');
  });
});
