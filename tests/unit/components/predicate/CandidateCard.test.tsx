// @MX:NOTE Unit tests for CandidateCard — SPEC-REGULA-PREDICATE-001 (Task 9 Item A).
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CandidateCard from '../../../../components/predicate/CandidateCard';
import type { PredicateCandidate } from '../../../../lib/predicate/types';

const candidate: PredicateCandidate = {
  k_number: 'K123456',
  applicant_name: 'Acme Medical Inc.',
  device_name: 'Acme Infusion Pump',
  decision_date: '2018-05-12',
  decision: 'SESE',
  product_code: 'FRN',
  statement_or_summary: 'summary',
  device_description: 'An infusion pump.',
};

const neCandidate: PredicateCandidate = {
  ...candidate,
  k_number: 'K999000',
  decision: 'SNNS',
};

afterEach(() => cleanup());

describe('CandidateCard', () => {
  it('renders the K-number and core fields', () => {
    render(<CandidateCard candidate={candidate} onSelect={vi.fn()} />);
    expect(screen.getByText('K123456')).toBeTruthy();
    expect(screen.getByText('Acme Medical Inc.')).toBeTruthy();
    expect(screen.getByText('Acme Infusion Pump')).toBeTruthy();
    expect(screen.getByText('FRN')).toBeTruthy();
  });

  it('links the K-number to FDA CDRH with the K prefix stripped', () => {
    render(<CandidateCard candidate={candidate} onSelect={vi.fn()} />);
    const link = screen.getByRole('link', { name: /K123456/ }) as HTMLAnchorElement;
    expect(link.href).toContain(
      'accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=123456',
    );
    expect(link.href).not.toContain('ID=K123456');
  });

  it('shows a green Substantially Equivalent badge for SE decisions', () => {
    render(<CandidateCard candidate={candidate} onSelect={vi.fn()} />);
    const badge = screen.getByTestId('decision-badge');
    expect(badge.textContent).toContain('Substantially Equivalent');
    expect(badge.className).toMatch(/success/);
  });

  it('shows a red Not Substantially Equivalent badge for NSE decisions', () => {
    render(<CandidateCard candidate={neCandidate} onSelect={vi.fn()} />);
    const badge = screen.getByTestId('decision-badge');
    expect(badge.textContent).toContain('Not Substantially Equivalent');
    expect(badge.className).toMatch(/danger/);
  });

  it('calls onSelect with the candidate when the select button is clicked', () => {
    const onSelect = vi.fn();
    render(<CandidateCard candidate={candidate} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Select as Predicate/i }));
    expect(onSelect).toHaveBeenCalledWith(candidate);
  });

  it('is not selected by default (REQ-PRE-011)', () => {
    render(<CandidateCard candidate={candidate} onSelect={vi.fn()} />);
    const card = screen.getByTestId('candidate-card');
    expect(card.getAttribute('aria-selected')).toBe('false');
  });

  it('marks the card as selected when isSelected is true', () => {
    render(<CandidateCard candidate={candidate} onSelect={vi.fn()} isSelected />);
    const card = screen.getByTestId('candidate-card');
    expect(card.getAttribute('aria-selected')).toBe('true');
  });

  it('expands to reveal device description when the header is clicked', () => {
    render(<CandidateCard candidate={candidate} onSelect={vi.fn()} />);
    // collapsed by default
    expect(screen.queryByText('An infusion pump.')).toBeNull();
    fireEvent.click(screen.getByTestId('candidate-card-header'));
    expect(screen.getByText('An infusion pump.')).toBeTruthy();
  });
});
