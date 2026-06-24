// @MX:NOTE [AUTO] Unit tests for assessChange engine (REQ-003~006, REQ-010).
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-004, REQ-005, REQ-006)
//
// Uses the deterministic stub path (no fetchFn) so tests never hit the network.
// Three scenarios exercised:
//   1. Happy path with grounded stub citations (REQ-004 verdicts produced)
//   2. No sources retrieved → conservative verdict, no hallucination (C2)
//   3. LLM emits ungrounded citations → REQ-006 reject path

import { describe, expect, it } from 'vitest';
import type { RetrieverResult } from '../../ai/retrievers/internal-docs';
import { assessChange } from '../engine';
import type { ChangeInput, RetrievedSourceRef } from '../types';

const GROUNDED_RETRIEVER = async (_query: string): Promise<RetrieverResult> => {
  const results: RetrievedSourceRef[] = [
    { source: '21 CFR 807.81(a)(3)', section: 'significant change' },
    { source: 'EU MDR Article 120(3)', section: 'MDCG 2020-3' },
    { source: '의료기기법 제12조', section: '변경 허가/신고 기준' },
    { source: 'NMPA 변경 등록 기준', section: 'significant change' },
    { source: 'PMDA 일부변경 승인', section: '部分変更承認' },
  ];
  return {
    results: results.map((r, i) => ({
      id: `src-${i}`,
      content: `${r.source} ${r.section}: regulatory text excerpt grounding.`,
      score: 0.9 - i * 0.05,
      documentId: `doc-${i}`,
      docClass: 'regulation',
      metadata: { source: r.source, section: r.section },
    })),
    expertReviewRequired: false,
  };
};

const EMPTY_RETRIEVER = async (): Promise<RetrieverResult> => ({
  results: [],
  expertReviewRequired: false,
});

const designInput: ChangeInput = {
  changeType: 'design',
  description: 'Reduced device dimensions',
  impactScope: 'Housing and form factor',
  targetMarkets: ['FDA', 'EU'],
};

describe('assessChange — happy path (REQ-004/005 verdicts produced)', () => {
  it('produces a verdict per target-market jurisdiction with grounded citations', async () => {
    const result = await assessChange(designInput, {
      orgId: 'org-1',
      userId: 'user-1',
      retrieveFn: GROUNDED_RETRIEVER,
      // fetchFn omitted → engine uses grounded stubVerdict
    });

    expect(result.verdicts).toHaveLength(2); // FDA + EU_MDR only
    const jurisdictions = result.verdicts.map((v) => v.jurisdiction).sort();
    expect(jurisdictions).toEqual(['EU_MDR', 'FDA']);

    for (const v of result.verdicts) {
      expect(v.verdict).toMatch(
        /^(new_submission_required|change_notification|internal_record_only|not_applicable)$/,
      );
      expect(v.citationRejected).toBe(false);
      expect(v.citations.length).toBeGreaterThan(0);
      // REQ-006 grounded citation persists — every excerpt is non-empty.
      for (const c of v.citations) {
        expect(c.excerpt.length).toBeGreaterThan(0);
      }
    }
  });

  it('uses design change-type hint for FDA verdict (REQ-003/004)', async () => {
    const result = await assessChange(designInput, {
      orgId: 'org-1',
      userId: 'user-1',
      retrieveFn: GROUNDED_RETRIEVER,
    });
    const fda = result.verdicts.find((v) => v.jurisdiction === 'FDA');
    expect(fda?.verdict).toBe('new_submission_required'); // DEFAULT_VERDICT_HINT.design.FDA
  });
});

describe('assessChange — no sources retrieved (C2: no hallucination)', () => {
  it('produces internal_record_only verdicts with unverified confidence when retrieval is empty', async () => {
    const result = await assessChange(designInput, {
      orgId: 'org-1',
      userId: 'user-1',
      retrieveFn: EMPTY_RETRIEVER,
    });

    for (const v of result.verdicts) {
      expect(v.verdict).toBe('internal_record_only');
      expect(v.confidence).toBe('unverified');
      expect(v.citations).toHaveLength(0);
      expect(v.citationRejected).toBe(false); // rejected is for REQ-006 LLM hallucination; this is the C2 no-sources path
    }
  });
});

describe('assessChange — REQ-006 reject path (LLM emits ungrounded citations)', () => {
  it('rejects the verdict when the LLM emits only hallucinated citations', async () => {
    // fetchFn returns an LLM payload with NO citation matching retrieved sources.
    const hallucinatingFetch = async (): Promise<{ json: () => Promise<unknown> }> => ({
      json: async () => ({
        result: JSON.stringify({
          verdict: 'new_submission_required',
          rationale: 'this is totally a real rule',
          citations: [
            {
              source: 'Hallucinated FDA Rule',
              section: 'fake section 999',
              excerpt: 'fake excerpt',
            },
          ],
        }),
      }),
    });

    const result = await assessChange(designInput, {
      orgId: 'org-1',
      userId: 'user-1',
      retrieveFn: GROUNDED_RETRIEVER,
      fetchFn: hallucinatingFetch,
    });

    const fda = result.verdicts.find((v) => v.jurisdiction === 'FDA');
    expect(fda?.citationRejected).toBe(true);
    expect(fda?.verdict).toBe('internal_record_only'); // downgraded
    expect(fda?.confidence).toBe('unverified');
    expect(fda?.citations).toHaveLength(0);
    expect(fda?.rationale).toContain('citation required');
  });
});

describe('assessChange — jurisdiction resolution (REQ-005)', () => {
  it('resolves target markets to the canonical jurisdiction union', async () => {
    const result = await assessChange(
      {
        changeType: 'labeling',
        description: 'Added new warning',
        impactScope: 'IFU only',
        targetMarkets: ['US', 'KR', 'JP'],
      },
      {
        orgId: 'org-1',
        userId: 'user-1',
        retrieveFn: GROUNDED_RETRIEVER,
      },
    );
    const jurisdictions = result.verdicts.map((v) => v.jurisdiction).sort();
    expect(jurisdictions).toEqual(['FDA', 'MFDS', 'PMDA']);
  });
});
