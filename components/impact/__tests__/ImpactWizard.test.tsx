/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImpactWizard } from '../ImpactWizard';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const { mutateSpy, isPendingRef } = vi.hoisted(() => ({
  mutateSpy: vi.fn(),
  isPendingRef: { current: false },
}));

vi.mock('@/lib/queries/useImpactCheck', () => ({
  useImpactCheck: () => ({
    mutate: mutateSpy,
    get isPending() {
      return isPendingRef.current;
    },
    isError: false,
    error: null,
    data: null,
    reset: vi.fn(),
  }),
}));

function createWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('ImpactWizard (M3 + M4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPendingRef.current = false;
  });

  it('renders without crashing', () => {
    render(<ImpactWizard orgId="org-123" />, { wrapper: createWrapper });
    expect(screen.getByTestId('step1-product')).toBeInTheDocument();
  });

  describe('Step navigation', () => {
    it('starts at Step 1', () => {
      render(<ImpactWizard orgId="org-123" />, { wrapper: createWrapper });
      expect(screen.getByTestId('step1-product')).toBeInTheDocument();
    });

    it('navigates to Step 2 after Step 1 completion', async () => {
      render(<ImpactWizard orgId="org-123" />, { wrapper: createWrapper });

      const input = screen.getByTestId('impact-product-input');
      fireEvent.change(input, { target: { value: 'test-product' } });

      fireEvent.click(screen.getByTestId('impact-next-button'));

      await waitFor(() => {
        expect(screen.getByTestId('step2-category')).toBeInTheDocument();
      });
    });

    it('navigates to Step 3 after Step 2 completion', async () => {
      render(<ImpactWizard orgId="org-123" />, { wrapper: createWrapper });

      // Step 1
      fireEvent.change(screen.getByTestId('impact-product-input'), {
        target: { value: 'test' },
      });
      fireEvent.click(screen.getByTestId('impact-next-button'));

      await waitFor(() => {
        expect(screen.getByTestId('step2-category')).toBeInTheDocument();
      });

      // Step 2
      fireEvent.click(screen.getByTestId('category-bom'));
      fireEvent.click(screen.getByTestId('impact-next-button'));

      await waitFor(() => {
        expect(screen.getByTestId('step3-detail')).toBeInTheDocument();
      });
    });

    it('navigates to Step 4 after Step 3 completion', async () => {
      render(<ImpactWizard orgId="org-123" />, { wrapper: createWrapper });

      // Step 1
      fireEvent.change(screen.getByTestId('impact-product-input'), {
        target: { value: 'test' },
      });
      fireEvent.click(screen.getByTestId('impact-next-button'));

      // Step 2
      await waitFor(() => {
        expect(screen.getByTestId('step2-category')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('category-bom'));
      fireEvent.click(screen.getByTestId('impact-next-button'));

      // Step 3
      await waitFor(() => {
        expect(screen.getByTestId('step3-detail')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId('impact-detail-textarea'), {
        target: { value: '1234567890' },
      });
      fireEvent.click(screen.getByTestId('impact-next-button'));

      await waitFor(() => {
        expect(screen.getByTestId('step4-markets')).toBeInTheDocument();
      });
    });

    it('navigates back from Step 2 to Step 1', async () => {
      render(<ImpactWizard orgId="org-123" />, { wrapper: createWrapper });

      // Complete Step 1
      fireEvent.change(screen.getByTestId('impact-product-input'), {
        target: { value: 'test' },
      });
      fireEvent.click(screen.getByTestId('impact-next-button'));

      await waitFor(() => {
        expect(screen.getByTestId('step2-category')).toBeInTheDocument();
      });

      // Go back
      fireEvent.click(screen.getByTestId('impact-back-button'));

      await waitFor(() => {
        expect(screen.getByTestId('step1-product')).toBeInTheDocument();
      });
    });

    it('navigates back from Step 3 to Step 2', async () => {
      render(<ImpactWizard orgId="org-123" />, { wrapper: createWrapper });

      // Step 1 -> Step 2
      fireEvent.change(screen.getByTestId('impact-product-input'), {
        target: { value: 'test' },
      });
      fireEvent.click(screen.getByTestId('impact-next-button'));

      await waitFor(() => {
        expect(screen.getByTestId('step2-category')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('category-bom'));
      fireEvent.click(screen.getByTestId('impact-next-button'));

      await waitFor(() => {
        expect(screen.getByTestId('step3-detail')).toBeInTheDocument();
      });

      // Go back to Step 2
      fireEvent.click(screen.getByTestId('impact-back-button'));

      await waitFor(() => {
        expect(screen.getByTestId('step2-category')).toBeInTheDocument();
      });
    });

    it('navigates back from Step 4 to Step 3', async () => {
      render(<ImpactWizard orgId="org-123" />, { wrapper: createWrapper });

      // Step 1 -> Step 2 -> Step 3
      fireEvent.change(screen.getByTestId('impact-product-input'), {
        target: { value: 'test' },
      });
      fireEvent.click(screen.getByTestId('impact-next-button'));

      await waitFor(() => {
        expect(screen.getByTestId('step2-category')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('category-bom'));
      fireEvent.click(screen.getByTestId('impact-next-button'));

      await waitFor(() => {
        expect(screen.getByTestId('step3-detail')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('impact-detail-textarea'), {
        target: { value: '1234567890' },
      });
      fireEvent.click(screen.getByTestId('impact-next-button'));

      await waitFor(() => {
        expect(screen.getByTestId('step4-markets')).toBeInTheDocument();
      });

      // Go back to Step 3
      fireEvent.click(screen.getByTestId('impact-back-button'));

      await waitFor(() => {
        expect(screen.getByTestId('step3-detail')).toBeInTheDocument();
      });
    });
  });

  describe('Form submission (M3)', () => {
    it('calls useImpactCheck with all form data on submit', async () => {
      render(<ImpactWizard orgId="org-123" />, { wrapper: createWrapper });

      // Complete all steps
      fireEvent.change(screen.getByTestId('impact-product-input'), {
        target: { value: 'xray-src-001' },
      });
      fireEvent.click(screen.getByTestId('impact-next-button'));

      await waitFor(() => {
        expect(screen.getByTestId('step2-category')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('category-sw'));
      fireEvent.click(screen.getByTestId('impact-next-button'));

      await waitFor(() => {
        expect(screen.getByTestId('step3-detail')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('impact-detail-textarea'), {
        target: { value: 'Software algorithm retraining for improved accuracy' },
      });
      fireEvent.click(screen.getByTestId('impact-next-button'));

      await waitFor(() => {
        expect(screen.getByTestId('step4-markets')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('market-us'));
      fireEvent.click(screen.getByTestId('market-eu'));
      fireEvent.click(screen.getByTestId('impact-submit-button'));

      expect(mutateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-123',
          productId: 'xray-src-001',
          changeType: 'sw',
          markets: expect.arrayContaining(['us', 'eu']),
          changeDetail: 'Software algorithm retraining for improved accuracy',
        }),
        expect.anything(),
      );
      expect(mutateSpy).toHaveBeenCalledTimes(1);
    });

    it('prevents duplicate submission during pending (Edge Case 6, M4)', async () => {
      render(<ImpactWizard orgId="org-123" />, { wrapper: createWrapper });

      // Quick path to Step 4
      fireEvent.change(screen.getByTestId('impact-product-input'), {
        target: { value: 'test' },
      });
      fireEvent.click(screen.getByTestId('impact-next-button'));

      await waitFor(() => {
        expect(screen.getByTestId('step2-category')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('category-bom'));
      fireEvent.click(screen.getByTestId('impact-next-button'));

      await waitFor(() => {
        expect(screen.getByTestId('step3-detail')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('impact-detail-textarea'), {
        target: { value: '1234567890' },
      });
      fireEvent.click(screen.getByTestId('impact-next-button'));

      await waitFor(() => {
        expect(screen.getByTestId('step4-markets')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('market-us'));

      // Before submit, button should exist and be enabled
      const submitButton = screen.getByTestId('impact-submit-button');
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).not.toBeDisabled();

      // Mock mutate to flip isPending on first call (simulates real useMutation state).
      // Subsequent calls must be blocked by the isPending guard in handleSubmit.
      mutateSpy.mockImplementation(() => {
        isPendingRef.current = true;
      });

      // First click triggers the mutation; second click must be a no-op (AC-IMP-UI-06).
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);

      // Exactly one mutate call despite double click — duplicate submission prevented.
      await waitFor(() => {
        expect(mutateSpy).toHaveBeenCalledTimes(1);
      });
    });
  });
});
