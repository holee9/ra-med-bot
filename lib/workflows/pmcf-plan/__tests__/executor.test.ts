import { describe, expect, it } from 'vitest';
import { PMCF_CHECKLIST } from '../checklist';
import { executePmcfPlan } from '../executor';

// SPEC-REGULA-PMS-001 (REQ-PMS-003, AC-03): PMCF plan executor.

type FetchFn = (
  endpoint: string,
  options?: RequestInit,
) => Promise<{ json: () => Promise<unknown> }>;

function makeFetchFn(response: Record<string, unknown>): FetchFn {
  return async () => ({ json: async () => ({ result: JSON.stringify(response) }) });
}

const baseOptions = {
  orgId: '00000000-0000-0000-0000-000000000001',
  userId: '00000000-0000-0000-0000-000000000002',
  projectId: '00000000-0000-0000-0000-000000000003',
  deviceName: 'TestDevice IIa',
  deviceClass: 'IIa' as const,
};

describe('executePmcfPlan — Annex XIV Part B checklist + AI drafting', () => {
  it('includes 100% of Annex XIV Part B checklist items (AC-03)', async () => {
    const result = await executePmcfPlan(baseOptions, {
      fetchFn: makeFetchFn({}),
    });
    expect(result.checklist).toHaveLength(PMCF_CHECKLIST.length);
    // Every checklist item id is present in the result.
    for (const item of PMCF_CHECKLIST) {
      expect(result.checklist.some((c) => c.id === item.id)).toBe(true);
    }
  });

  it('returns status=complete when LLM drafts content for each checklist item', async () => {
    const drafted: Record<string, string> = {};
    for (const item of PMCF_CHECKLIST) {
      drafted[item.id] = `Drafted content for ${item.title}.`;
    }
    const result = await executePmcfPlan(baseOptions, {
      fetchFn: makeFetchFn(drafted),
    });
    expect(result.status).toBe('complete');
    for (const item of PMCF_CHECKLIST) {
      expect(result.draftedContent[item.id]).toContain('Drafted content');
    }
  });

  it('returns status=draft when LLM is not called (no fetchFn)', async () => {
    const result = await executePmcfPlan(baseOptions, {});
    expect(result.status).toBe('draft');
    for (const item of PMCF_CHECKLIST) {
      expect(result.draftedContent[item.id]).toBe('');
    }
  });

  it('returns status=partial when LLM drafts only some items', async () => {
    const result = await executePmcfPlan(baseOptions, {
      fetchFn: makeFetchFn({ pmcf_objectives: 'Objectives content...' }),
    });
    expect(result.status).toBe('partial');
    expect(result.draftedContent.pmcf_objectives).toContain('Objectives');
    expect(result.draftedContent.pmcf_methods).toBe('');
  });

  it('each checklist item includes clause reference (Annex XIV Part B)', async () => {
    const result = await executePmcfPlan(baseOptions, {});
    for (const item of result.checklist) {
      expect(item.clause).toMatch(/Annex XIV Part B/);
    }
  });
});
