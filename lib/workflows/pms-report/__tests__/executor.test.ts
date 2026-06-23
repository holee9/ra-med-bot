import { describe, expect, it } from 'vitest';
import { executePmsReport } from '../executor';
import type { PmsRetrievedSource } from '../validate';

// SPEC-REGULA-PMS-001 (REQ-PMS-002, REQ-PMS-004, REQ-PMS-008, AC-02, AC-04):
// PMS report executor — MDCG 2022-21 section structure, CER auto-linkage,
// citation grounding, zero-results handling.

// Injectable LLM fetch stub — mirrors classify ClassifyFetchFn pattern.
type FetchFn = (
  endpoint: string,
  options?: RequestInit,
) => Promise<{ json: () => Promise<unknown> }>;

// Injectable retriever — returns PmsRetrievedSource arrays for the executor.
type Retriever = (query: string) => Promise<PmsRetrievedSource[]>;

function makeRetriever(sources: PmsRetrievedSource[]): Retriever {
  return async () => sources;
}

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

describe('executePmsReport — MDCG 2022-21 section generation', () => {
  it('generates all 11 MDCG 2022-21 sections (AC-02)', async () => {
    const sources: PmsRetrievedSource[] = [
      { source: 'EU MDR', section: 'Article 85' },
      { source: 'MDCG 2022-21', section: '§4' },
    ];
    const result = await executePmsReport(baseOptions, {
      fetchFn: makeFetchFn({
        executive_summary: 'This report covers...',
        device_description: 'Class IIa active implant...',
      }),
      retrieveFn: makeRetriever(sources),
      cerData: null,
    });
    expect(Object.keys(result.sections)).toHaveLength(11);
    expect(result.sections.executive_summary).toBeTruthy();
  });

  it('auto-links CER data when cerData is provided (REQ-PMS-004, AC-04)', async () => {
    const result = await executePmsReport(baseOptions, {
      fetchFn: makeFetchFn({}),
      retrieveFn: makeRetriever([{ source: 'EU MDR', section: 'Article 85' }]),
      cerData: {
        cerId: 'cer-uuid-1',
        deviceName: 'TestDevice IIa',
        intendedUse: 'cardiac monitoring',
        riskProfile: 'moderate',
      },
    });
    expect(result.cerLinked).toBe(true);
    expect(result.cerRefId).toBe('cer-uuid-1');
  });

  it('sets cerLinked=false when no CER exists in project', async () => {
    const result = await executePmsReport(baseOptions, {
      fetchFn: makeFetchFn({}),
      retrieveFn: makeRetriever([{ source: 'EU MDR', section: 'Article 85' }]),
      cerData: null,
    });
    expect(result.cerLinked).toBe(false);
    expect(result.cerRefId).toBeNull();
  });

  it('returns pending status when retrieval yields zero sources (0-result handling)', async () => {
    const result = await executePmsReport(baseOptions, {
      fetchFn: makeFetchFn({ executive_summary: 'hallucinated' }),
      retrieveFn: makeRetriever([]),
      cerData: null,
    });
    expect(result.status).toBe('pending');
    expect(result.confidence).toBe('unverified');
    // LLM must NOT be called when retrieval returns nothing.
    expect(result.llmCalled).toBe(false);
  });

  it('strips hallucinated citations and sets confidence=unverified (REQ-PMS-008)', async () => {
    const sources: PmsRetrievedSource[] = [{ source: 'EU MDR', section: 'Article 85' }];
    const result = await executePmsReport(baseOptions, {
      fetchFn: makeFetchFn({
        _citations: [
          { ref: 'Article 85', source: 'EU MDR' }, // grounded
          { ref: '21 CFR 822', source: 'FDA' }, // hallucinated — not in retrieved
        ],
      }),
      retrieveFn: makeRetriever(sources),
      cerData: null,
    });
    expect(result.citations.some((c) => c.ref === 'Article 85')).toBe(true);
    expect(result.citations.some((c) => c.ref === '21 CFR 822')).toBe(false);
    expect(result.confidence).toBe('unverified');
  });

  it('sets confidence=verified when all citations are grounded', async () => {
    const sources: PmsRetrievedSource[] = [
      { source: 'EU MDR', section: 'Article 85' },
      { source: 'MDCG 2022-21', section: '§4' },
    ];
    const result = await executePmsReport(baseOptions, {
      fetchFn: makeFetchFn({
        _citations: [
          { ref: 'Article 85', source: 'EU MDR' },
          { ref: '§4', source: 'MDCG 2022-21' },
        ],
      }),
      retrieveFn: makeRetriever(sources),
      cerData: null,
    });
    expect(result.confidence).toBe('verified');
  });

  it('downgrades to pending when ALL citations are hallucinated', async () => {
    const sources: PmsRetrievedSource[] = [{ source: 'EU MDR', section: 'Article 85' }];
    const result = await executePmsReport(baseOptions, {
      fetchFn: makeFetchFn({
        _citations: [
          { ref: '21 CFR 822', source: 'FDA' },
          { ref: 'ISO 14971', source: 'ISO' },
        ],
      }),
      retrieveFn: makeRetriever(sources),
      cerData: null,
    });
    expect(result.citations).toHaveLength(0);
    expect(result.status).toBe('pending');
  });

  it('includes SUSAR/trend reporting section template (REQ-PMS-005)', async () => {
    const result = await executePmsReport(baseOptions, {
      fetchFn: makeFetchFn({}),
      retrieveFn: makeRetriever([{ source: 'EU MDR', section: 'Article 83' }]),
      cerData: null,
    });
    expect(result.sections.susar_trend_reporting).toContain('SUSAR');
  });
});
