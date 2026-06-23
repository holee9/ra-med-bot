// @MX:NOTE [AUTO] Real-pipeline regression test for executePmsReport.
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-002, REQ-PMS-008, AC-02)
//
// CRITICAL: This is the regression guard that the existing
// pms-report/__tests__/executor.test.ts MOCK-BASED tests cannot provide.
// The unit tests inject synthetic fetchFn/retrieveFn that return canned data.
// This test runs the REAL executor pipeline end-to-end with only the I/O
// boundaries (LLM HTTP call, retriever) stubbed — exactly the pattern from
// knowledge-gap-replay-real.test.ts.
//
// Strategy:
//   1. Do NOT mock executePmsReport — the real function runs Stages 1-6.
//   2. Inject a realistic retriever that returns EU MDR Article 85 + MDCG
//      2022-21 sources (the production retrieval shape).
//   3. Inject a realistic fetchFn that returns an LLM response with
//      _citations including both grounded AND hallucinated refs.
//   4. Assert: validatePmsCitations strips the hallucinated ref, confidence
//      downgrades to 'unverified', status remains 'complete' (partial match).
//   5. Assert: zero-results path returns pending + llmCalled=false.
//
// External API keys not required — fetchFn is injected, no real network.
// Graceful skip: if process.env.SKIP_PMS_REAL_PIPELINE === 'true', skip.

import { executePmsReport } from '@/lib/workflows/pms-report/executor';
import type { PmsRetrievedSource } from '@/lib/workflows/pms-report/validate';
import { describe, expect, it } from 'vitest';

const skipSuite = process.env.SKIP_PMS_REAL_PIPELINE === 'true';

const baseOptions = {
  orgId: '00000000-0000-0000-0000-000000000001',
  userId: '00000000-0000-0000-0000-000000000002',
  projectId: '00000000-0000-0000-0000-000000000003',
  deviceName: 'CardiacMonitor IIa',
  deviceClass: 'IIa' as const,
};

// Realistic retrieved sources matching the production retrieval shape.
const realisticSources: PmsRetrievedSource[] = [
  { source: 'EU MDR', section: 'Article 83' },
  { source: 'EU MDR', section: 'Article 84' },
  { source: 'EU MDR', section: 'Article 85' },
  { source: 'EU MDR', section: 'Article 86' },
  { source: 'MDCG 2022-21', section: '§4.2 PMS Plan Content' },
];

// Injectable retriever returning realistic EU MDR sources.
function realisticRetriever(_query: string): Promise<PmsRetrievedSource[]> {
  return Promise.resolve(realisticSources);
}

// Injectable fetchFn returning a realistic LLM response with mixed citations.
function makeRealisticFetchFn(opts?: { withHallucination?: boolean }) {
  const withHallucination = opts?.withHallucination ?? true;
  return async () => ({
    json: async () => ({
      result: JSON.stringify({
        executive_summary: 'This PMS report covers the CardiacMonitor IIa device.',
        device_description: 'Class IIa active implantable cardiac monitor.',
        // Mix grounded + hallucinated citations.
        _citations: withHallucination
          ? [
              { ref: 'Article 85', source: 'EU MDR' }, // grounded
              { ref: '§4.2', source: 'MDCG 2022-21' }, // grounded
              { ref: '21 CFR 822', source: 'FDA' }, // hallucinated — not in retrieved
              { ref: 'ISO 14971', source: 'ISO' }, // hallucinated — not in retrieved
            ]
          : [
              { ref: 'Article 85', source: 'EU MDR' },
              { ref: '§4.2', source: 'MDCG 2022-21' },
            ],
      }),
    }),
  });
}

describe.skipIf(skipSuite)('executePmsReport — real pipeline regression', () => {
  it('runs full pipeline: retrieve → LLM → validatePmsCitations → buildSections', async () => {
    const result = await executePmsReport(baseOptions, {
      fetchFn: makeRealisticFetchFn({ withHallucination: true }),
      retrieveFn: realisticRetriever,
      cerData: null,
    });

    // Stage 1: retrieval returned sources (not mocked away).
    expect(result.llmCalled).toBe(true);

    // Stage 2: LLM was called and sections were built.
    expect(Object.keys(result.sections)).toHaveLength(11);
    expect(result.sections.executive_summary).toContain('CardiacMonitor');

    // Stage 3: validatePmsCitations stripped hallucinated refs.
    expect(result.citations.some((c) => c.ref === 'Article 85')).toBe(true);
    expect(result.citations.some((c) => c.ref === '§4.2')).toBe(true);
    expect(result.citations.some((c) => c.ref === '21 CFR 822')).toBe(false);
    expect(result.citations.some((c) => c.ref === 'ISO 14971')).toBe(false);

    // Stage 4: confidence downgraded because some citations were unmatched.
    expect(result.confidence).toBe('unverified');

    // Stage 5: status is 'complete' because at least one citation matched.
    expect(result.status).toBe('complete');
  });

  it('returns verified confidence when all citations are grounded', async () => {
    const result = await executePmsReport(baseOptions, {
      fetchFn: makeRealisticFetchFn({ withHallucination: false }),
      retrieveFn: realisticRetriever,
      cerData: null,
    });

    expect(result.confidence).toBe('verified');
    expect(result.status).toBe('complete');
    expect(result.citations).toHaveLength(2);
  });

  it('zero-results path: pending status, LLM NOT called (C2 pattern)', async () => {
    const result = await executePmsReport(baseOptions, {
      fetchFn: makeRealisticFetchFn(),
      retrieveFn: async () => [], // zero sources
      cerData: null,
    });

    expect(result.status).toBe('pending');
    expect(result.confidence).toBe('unverified');
    expect(result.llmCalled).toBe(false);
    expect(result.citations).toHaveLength(0);
  });

  it('auto-links CER data and injects into pmcf_findings section', async () => {
    const result = await executePmsReport(baseOptions, {
      fetchFn: makeRealisticFetchFn({ withHallucination: false }),
      retrieveFn: realisticRetriever,
      cerData: {
        cerId: 'cer-uuid-1234',
        deviceName: 'CardiacMonitor IIa',
        intendedUse: 'continuous cardiac monitoring',
        riskProfile: 'moderate',
      },
    });

    expect(result.cerLinked).toBe(true);
    expect(result.cerRefId).toBe('cer-uuid-1234');
    // CER linkage is injected into pmcf_findings.
    expect(result.sections.pmcf_findings).toContain('cer-uuid-1234');
    expect(result.sections.pmcf_findings).toContain('continuous cardiac monitoring');
  });

  it('prompt injection in deviceName does not break pipeline (structured fields only)', async () => {
    // The LLM is called with deviceName as a structured field in the request
    // body, not interpolated into a prompt template. A malicious deviceName
    // with injection attempts should pass through as data, not command.
    const injectionAttempt = await executePmsReport(
      { ...baseOptions, deviceName: 'Device"; DROP TABLE pms_documents; --' },
      {
        fetchFn: makeRealisticFetchFn({ withHallucination: false }),
        retrieveFn: realisticRetriever,
        cerData: null,
      },
    );

    // The executor must complete normally — the injection is data, not SQL.
    expect(injectionAttempt.status).toBe('complete');
    expect(injectionAttempt.llmCalled).toBe(true);
  });
});
