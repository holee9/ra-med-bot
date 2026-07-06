/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Step1Product } from '../Step1Product';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('Step1Product', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders productId input field (AC-IMP-UI-02)', () => {
    const onNext = vi.fn();
    render(<Step1Product onNext={onNext} productId="" setProductId={vi.fn()} />);

    expect(screen.getByTestId('impact-product-input')).toBeInTheDocument();
    expect(screen.getByTestId('impact-next-button')).toBeInTheDocument();
  });

  it('disables Next button when productId is empty (AC-IMP-UI-02)', () => {
    const onNext = vi.fn();
    render(<Step1Product onNext={onNext} productId="" setProductId={vi.fn()} />);

    expect(screen.getByTestId('impact-next-button')).toBeDisabled();
  });

  it('enables Next button when productId has 1+ characters (AC-IMP-UI-02)', () => {
    const onNext = vi.fn();
    const setProductId = vi.fn();
    render(<Step1Product onNext={onNext} productId="x" setProductId={setProductId} />);

    expect(screen.getByTestId('impact-next-button')).not.toBeDisabled();
  });

  it('calls setProductId when input changes (AC-IMP-UI-02)', () => {
    const onNext = vi.fn();
    const setProductId = vi.fn();
    render(<Step1Product onNext={onNext} productId="" setProductId={setProductId} />);

    const input = screen.getByTestId('impact-product-input');
    fireEvent.change(input, { target: { value: 'xray-src-001' } });

    expect(setProductId).toHaveBeenCalledWith('xray-src-001');
  });

  it('calls onNext when Next button is clicked (AC-IMP-UI-02)', () => {
    const onNext = vi.fn();
    render(<Step1Product onNext={onNext} productId="test" setProductId={vi.fn()} />);

    fireEvent.click(screen.getByTestId('impact-next-button'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('prevents submit when productId is empty (Edge Case 1)', () => {
    const onNext = vi.fn();
    render(<Step1Product onNext={onNext} productId="" setProductId={vi.fn()} />);

    const button = screen.getByTestId('impact-next-button');
    expect(button).toBeDisabled();

    // Simulate form submit attempt - button should remain disabled
    fireEvent.click(button);
    expect(onNext).not.toHaveBeenCalled();
  });
});
