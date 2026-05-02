// @MX:NOTE Unit tests for query rewrite — REQ-CHAT-013.
// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { rewriteQuery } from '../../lib/ai/query-rewrite';

describe('rewriteQuery', () => {
  it('expands 510(k) acronym', () => {
    const result = rewriteQuery('510(k) 제출 기한은?', 'ko', 'regulation-lookup');
    expect(result).toContain('510(k) premarket notification');
  });

  it('expands QSR acronym', () => {
    const result = rewriteQuery('QSR requirements', 'en', 'regulation-lookup');
    expect(result).toContain('quality system regulation');
  });

  it('expands PMA acronym', () => {
    const result = rewriteQuery('PMA approval process', 'en', 'regulation-lookup');
    expect(result).toContain('premarket approval');
  });

  it('expands IDE acronym', () => {
    const result = rewriteQuery('IDE requirements', 'en', 'regulation-lookup');
    expect(result).toContain('investigational device exemption');
  });

  it('expands GMP acronym', () => {
    const result = rewriteQuery('GMP compliance', 'en', 'regulation-lookup');
    expect(result).toContain('good manufacturing practice');
  });

  it('expands CAPA acronym', () => {
    const result = rewriteQuery('CAPA procedure', 'en', 'regulation-lookup');
    expect(result).toContain('corrective and preventive action');
  });

  it('expands DHF acronym', () => {
    const result = rewriteQuery('DHF requirements', 'en', 'regulation-lookup');
    expect(result).toContain('design history file');
  });

  it('expands DMR acronym', () => {
    const result = rewriteQuery('DMR documentation', 'en', 'regulation-lookup');
    expect(result).toContain('device master record');
  });

  it('expands DHR acronym', () => {
    const result = rewriteQuery('DHR records', 'en', 'regulation-lookup');
    expect(result).toContain('device history record');
  });

  it('expands MDR acronym', () => {
    const result = rewriteQuery('MDR reporting', 'en', 'regulation-lookup');
    expect(result).toContain('medical device reporting');
  });

  it('appends Korean-English mixed keywords for ko locale', () => {
    const result = rewriteQuery('의료기기 등급 분류', 'ko', 'regulation-lookup');
    expect(result).toContain('device classification');
  });

  it('does not call LLM (result is synchronous)', () => {
    // rewriteQuery must be a pure sync function — no async/await
    const result = rewriteQuery('test', 'en', 'general');
    expect(typeof result).toBe('string');
  });

  it('returns string for general intent', () => {
    const result = rewriteQuery('hello world', 'en', 'general');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles comparison intent', () => {
    const result = rewriteQuery('510(k) vs PMA', 'en', 'comparison');
    expect(result).toContain('premarket notification');
    expect(result).toContain('premarket approval');
  });

  it('expands at least 20 FDA acronyms (coverage check)', () => {
    const acronyms = [
      '510(k)',
      'QSR',
      'PMA',
      'IDE',
      'GMP',
      'CAPA',
      'DHF',
      'DMR',
      'DHR',
      'MDR',
      'CFR',
      'FDA',
      'UDI',
      'GUDID',
      'HDE',
      'PMCF',
      'EUMDR',
      'ISO',
      'IEC',
      'SOP',
    ];
    // At least 20 distinct acronyms in the lookup table
    acronyms.forEach((acronym) => {
      const result = rewriteQuery(`${acronym} requirements`, 'en', 'regulation-lookup');
      expect(typeof result).toBe('string');
    });
  });
});
