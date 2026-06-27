// @MX:SPEC REQ-CLINLIT-021~025

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

vi.mock('@/lib/ai/llm-provider', () => ({
  getLlmModel: vi.fn(() => 'mock-model'),
}));

import { generateObject } from 'ai';
import type { AppraiserArticle } from '../../../lib/cer/evidence-synthesis';
import { synthesizeEvidence } from '../../../lib/cer/evidence-synthesis';
import type { PicoFramework } from '../../../lib/cer/pico-generator';

const MOCK_PICO: PicoFramework = {
  patient: 'adult patients requiring cardiac monitoring',
  intervention: 'implantable cardiac monitor',
  comparator: null,
  outcome: 'arrhythmia detection accuracy and safety',
  meshTerms: ['Cardiac Monitor', 'Arrhythmias, Cardiac'],
  searchQuery: '"cardiac monitor"[MeSH] AND "arrhythmia"[MeSH]',
};

const makeArticle = (pmid: string, gradeQuality: string): AppraiserArticle => ({
  pmid,
  title: `Study ${pmid}`,
  abstract: 'This study evaluated the device in clinical setting.',
  authors: ['Smith J', 'Doe A'],
  journal: 'J Med Dev',
  year: 2022,
  sign50Level: gradeQuality === 'high' ? '1++' : '2+',
  gradeQuality,
  citation: `Smith J, Doe A. Study ${pmid}. J Med Dev. 2022.`,
});

const MOCK_SYNTHESIS_RESPONSE = {
  object: {
    gradeSummary: 'The overall body of evidence is of moderate quality.',
    narrativeSynthesis: 'Studies demonstrate acceptable safety and efficacy.',
    cerSection6Draft: '## 6. Clinical Background\n\nContent here.',
    cerSection7Draft:
      '## 7. Clinical Data\n\n| Study | GRADE |\n|-------|-------|\n| Study 1 | High |',
    cerSection8Draft: '## 8. Appraisal\n\nOverall the evidence supports the device.',
  },
};

describe('synthesizeEvidence', () => {
  it('returns all required draft sections non-empty', async () => {
    vi.mocked(generateObject).mockResolvedValueOnce(MOCK_SYNTHESIS_RESPONSE as never);

    const articles = [makeArticle('11111111', 'high'), makeArticle('22222222', 'moderate')];
    const result = await synthesizeEvidence(articles, 'cardiac monitor device', MOCK_PICO);

    expect(result.gradeSummary.length).toBeGreaterThan(0);
    expect(result.narrativeSynthesis.length).toBeGreaterThan(0);
    expect(result.cerSection6Draft.length).toBeGreaterThan(0);
    expect(result.cerSection7Draft.length).toBeGreaterThan(0);
    expect(result.cerSection8Draft.length).toBeGreaterThan(0);
  });

  it('correctly counts GRADE distribution', async () => {
    vi.mocked(generateObject).mockResolvedValueOnce(MOCK_SYNTHESIS_RESPONSE as never);

    const articles = [
      makeArticle('1', 'high'),
      makeArticle('2', 'high'),
      makeArticle('3', 'moderate'),
      makeArticle('4', 'low'),
      makeArticle('5', 'very_low'),
    ];
    const result = await synthesizeEvidence(articles, 'device', MOCK_PICO);

    expect(result.gradeCounts.high).toBe(2);
    expect(result.gradeCounts.moderate).toBe(1);
    expect(result.gradeCounts.low).toBe(1);
    expect(result.gradeCounts.veryLow).toBe(1);
  });

  it('handles empty article list gracefully without additional LLM calls', async () => {
    const callsBefore = vi.mocked(generateObject).mock.calls.length;

    const result = await synthesizeEvidence([], 'device', MOCK_PICO);

    const callsAfter = vi.mocked(generateObject).mock.calls.length;
    expect(callsAfter).toBe(callsBefore); // no new calls for empty list

    expect(result.cerSection6Draft.length).toBeGreaterThan(0);
    expect(result.gradeCounts).toEqual({ high: 0, moderate: 0, low: 0, veryLow: 0 });
  });

  it('returns mock data in E2E_TEST_MODE without additional generateObject calls', async () => {
    const callsBefore = vi.mocked(generateObject).mock.calls.length;

    process.env.E2E_TEST_MODE = 'true';

    const articles = [makeArticle('9999', 'moderate')];
    const result = await synthesizeEvidence(articles, 'device', MOCK_PICO);

    const callsAfter = vi.mocked(generateObject).mock.calls.length;
    expect(callsAfter).toBe(callsBefore); // no new calls

    expect(result.cerSection6Draft.length).toBeGreaterThan(0);
    expect(result.cerSection7Draft.length).toBeGreaterThan(0);
    expect(result.cerSection8Draft.length).toBeGreaterThan(0);

    process.env.E2E_TEST_MODE = '';
  });
});

describe('screenArticles (via screening-pipeline)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps decisions correctly for each article', async () => {
    // Import once to pick up the top-level mock.
    const { screenArticles } = await import('../../../lib/cer/screening-pipeline');

    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        decisions: [
          { pmid: '11111111', decision: 'include', reason: 'Relevant to PICO' },
          { pmid: '22222222', decision: 'exclude', reason: 'Different patient population' },
        ],
      },
    } as never);

    const articles = [
      {
        pmid: '11111111',
        title: 'Cardiac monitor study',
        abstract: 'RCT in cardiac patients.',
        authors: ['Smith J'],
        journal: 'J Card',
        year: 2022,
      },
      {
        pmid: '22222222',
        title: 'Pediatric study',
        abstract: 'Study in children.',
        authors: ['Doe A'],
        journal: 'J Ped',
        year: 2021,
      },
    ];

    const results = await screenArticles(articles, MOCK_PICO, 'cardiac monitor');

    expect(results).toHaveLength(2);
    expect(results.find((r) => r.pmid === '11111111')?.decision).toBe('include');
    expect(results.find((r) => r.pmid === '22222222')?.decision).toBe('exclude');
  });
});
