// @MX:NOTE Light render tests for the predicate search page — SPEC-REGULA-PREDICATE-001 (Task 9 Item D).
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

import PredicateSearchPage from '../../../../app/(app)/predicate/page';

beforeEach(() => {
  pushMock.mockReset();
  vi.restoreAllMocks();
});
afterEach(() => cleanup());

describe('PredicateSearchPage', () => {
  it('renders the search input and button', () => {
    render(<PredicateSearchPage />);
    expect(screen.getByTestId('predicate-search-input')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Search/i })).toBeTruthy();
  });

  it('always shows the pre-2004 coverage notice for awareness (REQ-PRE-007)', () => {
    render(<PredicateSearchPage />);
    expect(screen.getByTestId('coverage-notice').textContent).toContain('2004');
  });

  it('renders candidate cards from search results and navigates on select', async () => {
    const candidate = {
      k_number: 'K123456',
      applicant_name: 'Acme',
      device_name: 'Pump',
      decision_date: '2018-05-12',
      decision: 'SESE',
      product_code: 'FRN',
      statement_or_summary: '',
      device_description: '',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [candidate],
          cached: false,
          has_coverage_gap: false,
          search_strategy: 'device_name',
        }),
      }),
    );

    render(<PredicateSearchPage />);
    fireEvent.change(screen.getByTestId('predicate-search-input'), {
      target: { value: 'pump' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Search/i }));

    await waitFor(() => expect(screen.getByTestId('candidate-card')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Select as Predicate/i }));
    expect(pushMock).toHaveBeenCalledWith('/predicate/compare?k=K123456');
  });
});
