// @MX:NOTE SourceCard tests — verification hints, type pill styling.
// @MX:SPEC Issue #158

/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SourceItem } from '../../../types/streaming';
import { SourceCard } from '../SourceCard';

describe('SourceCard — Issue #158 enhancements', () => {
  const mockSource: SourceItem = {
    id: '1',
    citeIndex: 1,
    orgLabel: 'FDA',
    title: '21 CFR 820 Quality System Regulation',
    year: 2023,
    type: 'Regulation',
    url: 'https://www.fda.gov',
    anchor: '820.30',
    offset: 120,
  };

  it('shows verification hint for verifiable sources', () => {
    render(<SourceCard source={mockSource} />);

    expect(screen.getByTitle(/검증 가능/)).toBeInTheDocument();
    expect(screen.getByText(/820.30/i)).toBeInTheDocument();
    expect(screen.getByText(/offset 120/i)).toBeInTheDocument();
  });

  it('shows unverified excerpt hint when no anchor/offset', () => {
    const unverifiableSource: SourceItem = {
      ...mockSource,
      anchor: '',
      offset: 0,
    };

    render(<SourceCard source={unverifiableSource} />);

    expect(screen.getByTitle(/검증 불가/)).toBeInTheDocument();
    expect(screen.getByText(/발췌 요약/i)).toBeInTheDocument();
  });

  it('renders type pill with border using token colors', () => {
    const { container } = render(<SourceCard source={mockSource} />);

    const pill = container.querySelector('.rounded.border');
    expect(pill).toHaveClass('bg-brand-100');
    expect(pill).toHaveClass('text-brand-700');
    expect(pill).toHaveClass('border-brand-300');
  });

  it('renders Guidance type with success tokens', () => {
    const guidanceSource: SourceItem = {
      ...mockSource,
      type: 'Guidance',
    };

    const { container } = render(<SourceCard source={guidanceSource} />);

    const pill = container.querySelector('.rounded.border');
    expect(pill).toHaveClass('bg-success-50');
    expect(pill).toHaveClass('text-success-700');
    expect(pill).toHaveClass('border-success-200');
  });

  it('renders Industry type with warn tokens', () => {
    const industrySource: SourceItem = {
      ...mockSource,
      type: 'Industry',
    };

    const { container } = render(<SourceCard source={industrySource} />);

    const pill = container.querySelector('.rounded.border');
    expect(pill).toHaveClass('bg-warn-50');
    expect(pill).toHaveClass('text-warn-700');
    expect(pill).toHaveClass('border-warn-200');
  });

  it('renders Internal type with ink tokens', () => {
    const internalSource: SourceItem = {
      ...mockSource,
      type: 'Internal',
    };

    const { container } = render(<SourceCard source={internalSource} />);

    const pill = container.querySelector('.rounded.border');
    expect(pill).toHaveClass('bg-ink-100');
    expect(pill).toHaveClass('text-ink-700');
    expect(pill).toHaveClass('border-ink-200');
  });
});
