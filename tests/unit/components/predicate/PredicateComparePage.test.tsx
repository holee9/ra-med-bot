// @MX:NOTE Light render tests for the predicate compare page — SPEC-REGULA-PREDICATE-001 (Task 9 Item E).
// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('k=K123456'),
}));

import PredicateComparePage from '../../../../app/(app)/predicate/compare/page';

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => cleanup());

describe('PredicateComparePage', () => {
  it('renders the subject device form before any comparison exists (REQ-PRE-011)', () => {
    render(<PredicateComparePage />);
    // The 5 dimension textareas from SubjectDeviceForm are present.
    expect(screen.getByTestId('subject-input-intended_use')).toBeTruthy();
    // No comparison table / disclaimer yet — nothing pre-selected.
    expect(screen.queryByTestId('se-disclaimer')).toBeNull();
  });

  it('shows the pre-selected predicate K-number from the query param', () => {
    render(<PredicateComparePage />);
    expect(screen.getByTestId('selected-predicates').textContent).toContain('K123456');
  });
});
