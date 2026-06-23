// @MX:NOTE [AUTO] Unit tests for lib/classify/engine.ts — SPEC-REGULA-CLASSIFY-001.
// The LLM fetcher and RAG retriever are mocked; these tests never hit the network.

import { describe, expect, it, vi } from 'vitest';
import { type ClassifyFetchFn, classifyDevice } from '../engine';
import { buildClassificationPrompt, parseJurisdictionResult } from '../prompt';
import type { WizardAnswers } from '../types';

const answers: WizardAnswers = {
  deviceDescription: 'Wireless insulin pump with bolus calculator software.',
  deviceType: 'active',
  contactType: 'internal',
  hasSoftware: true,
  hasAiMl: false,
  isSterile: false,
};

describe('buildClassificationPrompt', () => {
  it('includes the jurisdiction name', () => {
    const p = buildClassificationPrompt('FDA', answers, '');
    expect(p).toContain('FDA');
  });

  it('includes the device description and wizard answers', () => {
    const p = buildClassificationPrompt('EU_MDR', answers, 'Rule 5 text');
    expect(p).toContain('Wireless insulin pump');
    expect(p).toContain('internal');
    expect(p).toContain('Rule 5 text');
  });

  it('instructs the model to return JSON only', () => {
    const p = buildClassificationPrompt('MFDS', answers, '');
    expect(p).toContain('JSON');
  });
});

describe('parseJurisdictionResult', () => {
  it('parses a well-formed response', () => {
    const raw = JSON.stringify({
      class: 'Class II',
      path: '510(k)',
      ruleNumbers: ['21 CFR 880.2900'],
      citations: [{ source: '21 CFR', id: '880.2900' }],
      rationale: 'Active internal-contact device requires 510(k).',
      nextSteps: ['predicate_comparison'],
    });
    const r = parseJurisdictionResult(raw);
    expect(r.class).toBe('Class II');
    expect(r.path).toBe('510(k)');
    expect(r.ruleNumbers).toEqual(['21 CFR 880.2900']);
    expect(r.citations).toHaveLength(1);
    expect(r.nextSteps).toEqual(['predicate_comparison']);
  });

  it('throws on missing class', () => {
    expect(() => parseJurisdictionResult(JSON.stringify({ rationale: 'x' }))).toThrow(TypeError);
  });

  it('throws on non-JSON input', () => {
    expect(() => parseJurisdictionResult('not json')).toThrow(SyntaxError);
  });
});

describe('classifyDevice', () => {
  const mockRetrieve = vi.fn().mockResolvedValue({
    results: [{ content: 'FDA 510(k) regulation text' }],
    expertReviewRequired: false,
  });

  const llmPayload = (klass: string) => ({
    result: JSON.stringify({
      class: klass,
      path: '510(k)',
      ruleNumbers: ['R1'],
      citations: [{ source: 'FDA', id: '880' }],
      rationale: 'rationale',
      nextSteps: ['predicate_comparison'],
    }),
  });

  function mockFetchFor(klassByJur: Record<string, string>): ClassifyFetchFn {
    return vi.fn(async (_endpoint: string, init?: RequestInit) => ({
      json: async () => {
        // The engine passes { jurisdiction, prompt } in the request body.
        const parsed = init?.body
          ? (JSON.parse(init.body as string) as { jurisdiction?: string })
          : {};
        const j = parsed.jurisdiction ?? 'FDA';
        return llmPayload(klassByJur[j] ?? 'Class II');
      },
    }));
  }

  it('returns a result for all 5 jurisdictions via Promise.all', async () => {
    const fetchFn = mockFetchFor({
      FDA: 'Class II',
      EU_MDR: 'Class IIa',
      MFDS: '2등급',
      NMPA: 'II',
      PMDA: 'Class II',
    });
    const out = await classifyDevice(answers, {
      orgId: 'org-1',
      userId: 'user-1',
      fetchFn,
      retrieveFn: mockRetrieve,
    });
    expect(out.fda.class).toBe('Class II');
    expect(out.euMdr.class).toBe('Class IIa');
    expect(out.mfds.class).toBe('2등급');
    expect(out.nmpa.class).toBe('II');
    expect(out.pmda.class).toBe('Class II');
    // RAG retriever called once per jurisdiction
    expect(mockRetrieve).toHaveBeenCalledTimes(5);
  });

  it('sets samdFlag=detected when hasAiMl is true', async () => {
    const fetchFn = mockFetchFor({});
    const out = await classifyDevice(
      { ...answers, hasAiMl: true },
      { orgId: 'org-1', userId: 'user-1', fetchFn, retrieveFn: mockRetrieve },
    );
    expect(out.samdFlag).toBe('detected');
  });

  it('sets samdFlag=none when hasAiMl is false', async () => {
    const fetchFn = mockFetchFor({});
    const out = await classifyDevice(answers, {
      orgId: 'org-1',
      userId: 'user-1',
      fetchFn,
      retrieveFn: mockRetrieve,
    });
    expect(out.samdFlag).toBe('none');
  });

  it('falls back to the deterministic stub when no fetchFn is provided', async () => {
    const out = await classifyDevice(answers, {
      orgId: 'org-1',
      userId: 'user-1',
      retrieveFn: mockRetrieve,
    });
    // Stub produces distinct values per jurisdiction for an internal-contact active device
    expect(out.fda.class).toBe('Class III'); // internal contact → III
    expect(out.euMdr.class).toBe('Class IIb'); // invasive
    expect(out.pmda.class).toBe('Class III');
    // samdFlag still derived from answers
    expect(out.samdFlag).toBe('none');
  });
});
