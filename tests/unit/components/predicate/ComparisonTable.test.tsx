// @MX:NOTE Unit tests for ComparisonTable — SPEC-REGULA-PREDICATE-001 (Task 9 Item C).
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ComparisonTable from '../../../../components/predicate/ComparisonTable';
import type {
  ComparisonCell,
  PredicateCandidate,
  PredicateComparison,
} from '../../../../lib/predicate/types';

const predicate = (k: string): PredicateCandidate => ({
  k_number: k,
  applicant_name: '',
  device_name: '',
  decision_date: '',
  decision: '',
  product_code: '',
  statement_or_summary: '',
  device_description: '',
});

const cell = (
  dimension: ComparisonCell['dimension'],
  overrides: Partial<ComparisonCell> = {},
): ComparisonCell => ({
  dimension,
  subject_text: `subject ${dimension}`,
  predicate_texts: ['pred text'],
  llm_suggestions: ['llm suggestion'],
  approved: [false],
  ...overrides,
});

const comparison: PredicateComparison = {
  subject_device_name: 'Test Device',
  selected_predicates: [predicate('K111111')],
  cells: [
    cell('intended_use'),
    cell('indications'),
    cell('tech_characteristics'),
    cell('materials'),
    cell('performance'),
  ],
  created_at: new Date('2024-01-01'),
};

afterEach(() => cleanup());

describe('ComparisonTable', () => {
  it('renders the substantial-equivalence disclaimer at the top (REQ-PRE-014)', () => {
    render(<ComparisonTable comparison={comparison} onApprove={vi.fn()} />);
    const disclaimer = screen.getByTestId('se-disclaimer');
    expect(disclaimer.textContent).toContain(
      'predicate identification only',
    );
    expect(disclaimer.textContent).toContain('cannot be automated');
  });

  it('renders five dimension rows', () => {
    render(<ComparisonTable comparison={comparison} onApprove={vi.fn()} />);
    expect(screen.getAllByTestId('comparison-row')).toHaveLength(5);
  });

  it('renders a header column for each predicate K-number', () => {
    render(<ComparisonTable comparison={comparison} onApprove={vi.fn()} />);
    const header = screen.getByTestId('comparison-header');
    expect(within(header).getByText('Dimension')).toBeTruthy();
    expect(within(header).getByText('Subject Device')).toBeTruthy();
    expect(within(header).getByText('K111111')).toBeTruthy();
  });

  it('shows an Approve button on cells with unapproved suggestions', () => {
    render(<ComparisonTable comparison={comparison} onApprove={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: /Approve/i }).length).toBeGreaterThan(0);
  });

  it('calls onApprove with the dimension and predicate index', () => {
    const onApprove = vi.fn();
    render(<ComparisonTable comparison={comparison} onApprove={onApprove} />);
    const [firstApprove] = screen.getAllByRole('button', { name: /Approve/i });
    fireEvent.click(firstApprove as HTMLElement);
    expect(onApprove).toHaveBeenCalledWith('intended_use', 0);
  });

  it('shows a checkmark and no Approve button on approved cells', () => {
    const approvedComparison: PredicateComparison = {
      ...comparison,
      cells: [
        cell('intended_use', { approved: [true] }),
        cell('indications'),
        cell('tech_characteristics'),
        cell('materials'),
        cell('performance'),
      ],
    };
    render(<ComparisonTable comparison={approvedComparison} onApprove={vi.fn()} />);
    // one fewer approve button than the 4 remaining unapproved cells
    expect(screen.getAllByRole('button', { name: /Approve/i })).toHaveLength(4);
    expect(screen.getAllByTestId('approved-check').length).toBeGreaterThan(0);
  });

  it('renders a horizontally scrollable container for mobile (REQ-PRE-030)', () => {
    render(<ComparisonTable comparison={comparison} onApprove={vi.fn()} />);
    const scroll = screen.getByTestId('comparison-scroll');
    expect(scroll.className).toMatch(/overflow-x-auto/);
  });
});
