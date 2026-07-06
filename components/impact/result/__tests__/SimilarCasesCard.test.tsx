/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SimilarCasesCard } from '../SimilarCasesCard';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('SimilarCasesCard (AC-IMP-UI-09)', () => {
  it('renders empty state when similarCases is undefined (low-confidence, Edge Case 8)', () => {
    render(<SimilarCasesCard similarCases={undefined} />);
    expect(screen.getByTestId('similar-cases')).toBeInTheDocument();
    expect(screen.getByText('result.similarCasesSkipped')).toBeInTheDocument();
  });

  it('renders "no similar cases" message when similarCases is empty array (high-confidence, no matches)', () => {
    render(<SimilarCasesCard similarCases={[]} />);
    expect(screen.getByTestId('similar-cases')).toBeInTheDocument();
    expect(screen.getByText('result.noSimilarCases')).toBeInTheDocument();
  });

  it('renders list of cases with <sup> citations when similarCases has items', () => {
    const cases = [
      { id: 'case-1', title: 'Case 1', content: 'Content 1', similarity: 0.9 },
      { id: 'case-2', title: 'Case 2', content: 'Content 2', similarity: 0.85 },
    ];
    const { container } = render(<SimilarCasesCard similarCases={cases} />);

    expect(screen.getByTestId('similar-cases')).toBeInTheDocument();
    expect(screen.getByText('result.similarHeader')).toBeInTheDocument();

    // Verify each case has <sup> citation
    const citations = container.querySelectorAll('sup.cite');
    expect(citations).toHaveLength(2);
    expect(citations[0]).toHaveTextContent('1');
    expect(citations[1]).toHaveTextContent('2');

    // Verify case titles are rendered
    expect(screen.getByText('Case 1')).toBeInTheDocument();
    expect(screen.getByText('Case 2')).toBeInTheDocument();
  });

  it('renders data-src attribute on each citation sup', () => {
    const cases = [{ id: 'case-1', title: 'Case 1', content: 'Content 1', similarity: 0.9 }];
    const { container } = render(<SimilarCasesCard similarCases={cases} />);

    const citation = container.querySelector('sup.cite');
    expect(citation).toHaveAttribute('data-src', 'case-1');
  });
});
