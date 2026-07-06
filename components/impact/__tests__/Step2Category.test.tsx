/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Step2Category } from '../Step2Category';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('Step2Category', () => {
  const categories = ['bom', 'sw', 'sw-minor', 'label', 'warn', 'process', 'sterile'] as const;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders exactly 7 category options (AC-IMP-UI-03)', () => {
    const onNext = vi.fn();
    render(<Step2Category onNext={onNext} changeType="" setChangeType={vi.fn()} />);

    for (const cat of categories) {
      expect(screen.getByTestId(`category-${cat}`)).toBeInTheDocument();
    }
  });

  it('disables Next button when no category selected (AC-IMP-UI-03)', () => {
    const onNext = vi.fn();
    render(<Step2Category onNext={onNext} changeType="" setChangeType={vi.fn()} />);

    expect(screen.getByTestId('impact-next-button')).toBeDisabled();
  });

  it('enables Next button when category selected (AC-IMP-UI-03)', () => {
    const onNext = vi.fn();
    render(<Step2Category onNext={onNext} changeType="bom" setChangeType={vi.fn()} />);

    expect(screen.getByTestId('impact-next-button')).not.toBeDisabled();
  });

  it('calls setChangeType when bom selected (AC-IMP-UI-03)', () => {
    const onNext = vi.fn();
    const setChangeType = vi.fn();
    render(<Step2Category onNext={onNext} changeType="" setChangeType={setChangeType} />);

    fireEvent.click(screen.getByTestId('category-bom'));

    expect(setChangeType).toHaveBeenCalledWith('bom');
  });

  it('calls onNext when Next button clicked (AC-IMP-UI-03)', () => {
    const onNext = vi.fn();
    render(<Step2Category onNext={onNext} changeType="sw" setChangeType={vi.fn()} />);

    fireEvent.click(screen.getByTestId('impact-next-button'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('maintains single selection - only one category can be selected (AC-IMP-UI-03)', () => {
    const onNext = vi.fn();
    const setChangeType = vi.fn();
    render(<Step2Category onNext={onNext} changeType="" setChangeType={setChangeType} />);

    // Click bom
    fireEvent.click(screen.getByTestId('category-bom'));
    expect(setChangeType).toHaveBeenLastCalledWith('bom');

    // Click sw - should replace bom
    fireEvent.click(screen.getByTestId('category-sw'));
    expect(setChangeType).toHaveBeenLastCalledWith('sw');
    expect(setChangeType).toHaveBeenCalledTimes(2); // Only 2 calls, not 3
  });

  it('shows all 7 categories with radio behavior (AC-IMP-UI-03)', () => {
    const onNext = vi.fn();
    render(<Step2Category onNext={onNext} changeType="bom" setChangeType={vi.fn()} />);

    // Check all categories are radio-type inputs
    for (const cat of categories) {
      const input = screen.getByTestId(`category-${cat}`);
      expect(input).toHaveAttribute('type', 'radio');
    }
  });
});
