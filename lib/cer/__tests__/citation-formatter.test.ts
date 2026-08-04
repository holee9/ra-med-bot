// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/cer/citation-formatter (SPEC-REGULA-CER-001).
// @MX:SPEC SPEC-REGULA-CER-001 (REQ-CER-020/021)

import { describe, expect, it } from 'vitest';
import { formatVancouver } from '../citation-formatter';
import type { PubMedArticle } from '../pubmed-client';

function art(overrides: Partial<PubMedArticle> = {}): PubMedArticle {
  return {
    pmid: '123',
    title: 'T',
    abstract: '',
    authors: [],
    journal: 'J',
    year: 2024,
    ...overrides,
  };
}

describe('formatVancouver (REQ-CER-020/021)', () => {
  it('formats a complete article', () => {
    expect(
      formatVancouver(
        art({
          authors: ['Smith J', 'Jones A'],
          title: 'Effect of X on Y',
          journal: 'N Engl J Med',
          year: 2023,
          volume: '388',
          pages: '1234-1240',
        }),
      ),
    ).toBe('Smith J, Jones A. Effect of X on Y. N Engl J Med. 2023;388:1234-1240.');
  });

  it('appends et al. when more than 6 authors', () => {
    const authors = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'];
    const result = formatVancouver(art({ authors, title: 'T', journal: 'J', year: 2024 }));
    expect(result).toContain('A1, A2, A3, A4, A5, A6, et al.');
    expect(result).not.toContain('A7');
  });

  it('handles missing journal gracefully', () => {
    const result = formatVancouver(
      art({ authors: ['Doe'], title: 'Title', journal: '', year: 2024 }),
    );
    expect(result).toBe('Doe. Title. 2024.');
  });

  it('handles year-only (no volume/pages)', () => {
    const result = formatVancouver(art({ authors: [], title: 'T', journal: 'J', year: 2024 }));
    expect(result).toContain('2024.');
  });

  it('drops tail when year is missing or invalid', () => {
    const result = formatVancouver(art({ authors: ['Doe'], title: 'T', journal: 'J', year: 0 }));
    expect(result).toBe('Doe. T. J.');
  });

  it('preserves a title that already ends with a period', () => {
    const result = formatVancouver(art({ authors: [], title: 'Done.', journal: '', year: 0 }));
    expect(result).toBe('Done.');
  });

  it('handles all fields empty', () => {
    expect(formatVancouver(art({ authors: [], title: '', journal: '', year: 0 }))).toBe('');
  });
});
