import { describe, expect, it } from 'vitest';
import { type ComplianceInput, checkArticle83to86 } from '../compliance-check';

// SPEC-REGULA-PMS-001 (REQ-PMS-007, AC-06): EU MDR Article 83-86 compliance
// check. The checker inspects a PMS document body and reports which articles
// are satisfied, missing, or partially met.

describe('checkArticle83to86 — EU MDR Article 83-86 compliance', () => {
  const baseInput: ComplianceInput = {
    deviceClass: 'IIa',
    hasPmsPlan: true,
    hasPmsReport: true,
    hasVigilanceData: true,
    hasPmcfPlan: true,
    hasPmcfEvaluation: true,
    complaintCount: 5,
    susarCount: 0,
  };

  it('returns all 4 articles as satisfied when every requirement is met', () => {
    const result = checkArticle83to86(baseInput);
    expect(result.overall).toBe('compliant');
    expect(result.articles).toHaveLength(4);
    expect(result.articles.map((a) => a.article).sort()).toEqual([
      'Article 83',
      'Article 84',
      'Article 85',
      'Article 86',
    ]);
    for (const a of result.articles) {
      expect(a.status).toBe('satisfied');
    }
  });

  it('flags Article 83 (PMS system) as missing when hasPmsPlan is false', () => {
    const result = checkArticle83to86({ ...baseInput, hasPmsPlan: false });
    expect(result.overall).toBe('non_compliant');
    const art83 = result.articles.find((a) => a.article === 'Article 83');
    expect(art83?.status).toBe('missing');
    expect(art83?.detail).toMatch(/PMS plan/i);
  });

  it('flags Article 84 (PMS plan update) as partial when complaintCount is 0', () => {
    const result = checkArticle83to86({ ...baseInput, complaintCount: 0 });
    const art84 = result.articles.find((a) => a.article === 'Article 84');
    expect(art84?.status).toBe('partial');
  });

  it('flags Article 85 (PMS report) as missing when hasPmsReport is false for IIa+', () => {
    const result = checkArticle83to86({ ...baseInput, hasPmsReport: false });
    const art85 = result.articles.find((a) => a.article === 'Article 85');
    expect(art85?.status).toBe('missing');
  });

  it('does NOT require PMCF for Class I devices (Annex XIV Part B is IIa+ only)', () => {
    const result = checkArticle83to86({
      ...baseInput,
      deviceClass: 'I',
      hasPmcfPlan: false,
      hasPmcfEvaluation: false,
    });
    const art86 = result.articles.find((a) => a.article === 'Article 86');
    // Class I is exempt from PMCF — Article 86 should be N/A.
    expect(art86?.status).toBe('not_applicable');
  });

  it('flags Article 86 (PMCF) as partial when IIa+ has plan but no evaluation', () => {
    const result = checkArticle83to86({ ...baseInput, hasPmcfEvaluation: false });
    const art86 = result.articles.find((a) => a.article === 'Article 86');
    expect(art86?.status).toBe('partial');
  });

  it('flags Article 86 as missing when IIa+ has no PMCF plan at all', () => {
    const result = checkArticle83to86({
      ...baseInput,
      hasPmcfPlan: false,
      hasPmcfEvaluation: false,
    });
    const art86 = result.articles.find((a) => a.article === 'Article 86');
    expect(art86?.status).toBe('missing');
  });

  it('flags SUSAR presence as non_compliant when susarCount > 0 and no vigilance reporting', () => {
    const result = checkArticle83to86({
      ...baseInput,
      susarCount: 2,
      hasVigilanceData: false,
    });
    expect(result.overall).toBe('non_compliant');
  });

  it('overall is partial when at least one article is partial but none missing', () => {
    const result = checkArticle83to86({ ...baseInput, complaintCount: 0 });
    expect(result.overall).toBe('partial');
  });
});
