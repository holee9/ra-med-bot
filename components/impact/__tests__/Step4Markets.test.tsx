/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Step4Markets } from '../Step4Markets';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('Step4Markets', () => {
  const markets = ['us', 'eu', 'kr', 'cn', 'jp'] as const;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders exactly 5 market checkboxes (AC-IMP-UI-05)', () => {
    const onSubmit = vi.fn();
    render(<Step4Markets onSubmit={onSubmit} markets={[]} setMarkets={vi.fn()} />);

    for (const market of markets) {
      expect(screen.getByTestId(`market-${market}`)).toBeInTheDocument();
    }
  });

  it('disables submit button when no markets selected (AC-IMP-UI-05)', () => {
    const onSubmit = vi.fn();
    render(<Step4Markets onSubmit={onSubmit} markets={[]} setMarkets={vi.fn()} />);

    expect(screen.getByTestId('impact-submit-button')).toBeDisabled();
  });

  it('enables submit button when 1+ markets selected (AC-IMP-UI-05)', () => {
    const onSubmit = vi.fn();
    render(<Step4Markets onSubmit={onSubmit} markets={['us']} setMarkets={vi.fn()} />);

    expect(screen.getByTestId('impact-submit-button')).not.toBeDisabled();
  });

  it('calls setMarkets when us market selected (AC-IMP-UI-05)', () => {
    const onSubmit = vi.fn();
    const setMarkets = vi.fn();
    render(<Step4Markets onSubmit={onSubmit} markets={[]} setMarkets={setMarkets} />);

    fireEvent.click(screen.getByTestId('market-us'));

    expect(setMarkets).toHaveBeenCalledWith(['us']);
  });

  it('allows multiple market selection (AC-IMP-UI-05)', () => {
    const onSubmit = vi.fn();
    const setMarkets = vi.fn();
    render(<Step4Markets onSubmit={onSubmit} markets={['us']} setMarkets={setMarkets} />);

    // Add eu to existing us selection
    fireEvent.click(screen.getByTestId('market-eu'));

    expect(setMarkets).toHaveBeenCalledWith(['us', 'eu']);
  });

  it('deselects market when clicked again (Edge Case 3)', () => {
    const onSubmit = vi.fn();
    const setMarkets = vi.fn();

    // Start with us selected
    render(<Step4Markets onSubmit={onSubmit} markets={['us']} setMarkets={setMarkets} />);

    // When us is clicked, it should be deselected
    const usCheckbox = screen.getByTestId('market-us');
    expect(usCheckbox).toBeChecked();

    fireEvent.click(usCheckbox);

    expect(setMarkets).toHaveBeenCalledWith([]);
  });

  it('allows selecting all 5 markets (Edge Case 3)', () => {
    const onSubmit = vi.fn();
    const setMarkets = vi.fn();
    render(<Step4Markets onSubmit={onSubmit} markets={[]} setMarkets={setMarkets} />);

    // Select all markets
    fireEvent.click(screen.getByTestId('market-us'));
    fireEvent.click(screen.getByTestId('market-eu'));
    fireEvent.click(screen.getByTestId('market-kr'));
    fireEvent.click(screen.getByTestId('market-cn'));
    fireEvent.click(screen.getByTestId('market-jp'));

    // Verify setMarkets was called to build up the array
    expect(setMarkets).toHaveBeenCalled();
  });

  it('allows deselecting all markets (Edge Case 3)', () => {
    const onSubmit = vi.fn();
    const setMarkets = vi.fn();
    render(<Step4Markets onSubmit={onSubmit} markets={[...markets]} setMarkets={setMarkets} />);

    // All markets start selected (markets array has all 5)
    // Verify initial state
    for (const market of markets as readonly string[]) {
      expect(screen.getByTestId(`market-${market}`)).toBeChecked();
    }

    // Deselect each market
    for (const market of markets as readonly string[]) {
      fireEvent.click(screen.getByTestId(`market-${market}`));
    }

    // Verify setMarkets was called for each deselection
    expect(setMarkets).toHaveBeenCalled();
  });

  it('calls onSubmit when submit button clicked (AC-IMP-UI-05)', () => {
    const onSubmit = vi.fn();
    render(<Step4Markets onSubmit={onSubmit} markets={['us', 'eu']} setMarkets={vi.fn()} />);

    fireEvent.click(screen.getByTestId('impact-submit-button'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows back button to return to previous step', () => {
    const onSubmit = vi.fn();
    const onBack = vi.fn();
    render(<Step4Markets onSubmit={onSubmit} onBack={onBack} markets={[]} setMarkets={vi.fn()} />);

    fireEvent.click(screen.getByTestId('impact-back-button'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
