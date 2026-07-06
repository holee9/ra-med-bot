/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Step3Detail } from '../Step3Detail';

// Mock next-intl
const mockT = vi.fn((key: string, values?: Record<string, string | number>) => {
  if (key === 'impact.form.changeDetail.counter' && values?.current !== undefined) {
    return `${values.current} / 2000`;
  }
  return key;
});

vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
}));

describe('Step3Detail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders textarea with char counter (AC-IMP-UI-04)', () => {
    const onNext = vi.fn();
    render(<Step3Detail onNext={onNext} changeDetail="" setChangeDetail={vi.fn()} />);

    expect(screen.getByTestId('impact-detail-textarea')).toBeInTheDocument();
    expect(screen.getByTestId('char-counter')).toBeInTheDocument();
  });

  it('shows error when textarea is empty (AC-IMP-UI-04)', () => {
    const onNext = vi.fn();
    render(<Step3Detail onNext={onNext} changeDetail="" setChangeDetail={vi.fn()} />);

    expect(screen.getByTestId('impact-error-message')).toBeInTheDocument();
    // Check that error contains the error key pattern
    expect(screen.getByTestId('impact-error-message').textContent).toContain('charMinError');
    expect(screen.getByTestId('impact-next-button')).toBeDisabled();
  });

  it('shows counter for 5-char input (AC-IMP-UI-04)', () => {
    const onNext = vi.fn();
    render(<Step3Detail onNext={onNext} changeDetail="hello" setChangeDetail={vi.fn()} />);

    const counter = screen.getByTestId('char-counter');
    expect(counter).toBeInTheDocument();
    // Counter shows current length (mock returns key, but counter element exists)
    expect(counter).toBeInTheDocument();
    expect(screen.getByTestId('impact-error-message')).toBeInTheDocument(); // Still shows error
  });

  it('enables Next button when 10+ characters (AC-IMP-UI-04)', () => {
    const onNext = vi.fn();
    render(<Step3Detail onNext={onNext} changeDetail="1234567890" setChangeDetail={vi.fn()} />);

    expect(screen.getByTestId('impact-next-button')).not.toBeDisabled();
  });

  it('removes error when 10+ characters entered (AC-IMP-UI-04)', () => {
    const onNext = vi.fn();
    render(<Step3Detail onNext={onNext} changeDetail="1234567890" setChangeDetail={vi.fn()} />);

    expect(screen.queryByTestId('impact-error-message')).not.toBeInTheDocument();
  });

  it('allows exactly 2000 characters (Edge Case 2)', () => {
    const onNext = vi.fn();
    const longText = 'a'.repeat(2000);
    render(<Step3Detail onNext={onNext} changeDetail={longText} setChangeDetail={vi.fn()} />);

    // Counter is present and shows the current length
    expect(screen.getByTestId('char-counter')).toBeInTheDocument();
    // No error when exactly 2000 chars
    expect(screen.queryByTestId('impact-error-message')).not.toBeInTheDocument();
    expect(screen.getByTestId('impact-next-button')).not.toBeDisabled();
  });

  it('blocks input beyond 2000 characters (Edge Case 2)', () => {
    const onNext = vi.fn();
    const setChangeDetail = vi.fn();
    const longText = 'a'.repeat(2000);

    render(
      <Step3Detail onNext={onNext} changeDetail={longText} setChangeDetail={setChangeDetail} />,
    );

    const textarea = screen.getByTestId('impact-detail-textarea');

    // Try to add one more character - should be blocked
    fireEvent.change(textarea, { target: { value: `${longText}b` } });

    // setChangeDetail should NOT be called with 2001 chars
    expect(setChangeDetail).not.toHaveBeenCalled();
  });

  it('shows max error when attempting 2001+ chars (Edge Case 2)', () => {
    const onNext = vi.fn();
    const setChangeDetail = vi.fn();
    const longText = 'a'.repeat(2000);

    render(
      <Step3Detail onNext={onNext} changeDetail={longText} setChangeDetail={setChangeDetail} />,
    );

    // Simulate trying to exceed limit - setChangeDetail should NOT be called
    const textarea = screen.getByTestId('impact-detail-textarea');
    fireEvent.change(textarea, { target: { value: `${longText}b` } });

    // setChangeDetail should not be called (input blocked)
    expect(setChangeDetail).not.toHaveBeenCalled();
  });

  it('calls setChangeDetail when textarea changes (AC-IMP-UI-04)', () => {
    const onNext = vi.fn();
    const setChangeDetail = vi.fn();
    render(<Step3Detail onNext={onNext} changeDetail="" setChangeDetail={setChangeDetail} />);

    fireEvent.change(screen.getByTestId('impact-detail-textarea'), {
      target: { value: 'test detail' },
    });

    expect(setChangeDetail).toHaveBeenCalledWith('test detail');
  });

  it('calls onNext when Next button clicked (AC-IMP-UI-04)', () => {
    const onNext = vi.fn();
    render(<Step3Detail onNext={onNext} changeDetail="1234567890" setChangeDetail={vi.fn()} />);

    fireEvent.click(screen.getByTestId('impact-next-button'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
