/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import type { ImpactCheckResponse } from '@/lib/queries/useImpactCheck';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ImpactResult } from '../ImpactResult';

const mockUseTranslations = vi.fn((key: string) => {
  if (key === 'impact.result.similarCasesSkipped') return 'result.similarCasesSkipped';
  if (key === 'impact.result.similarHeader') return 'result.similarHeader';
  return key;
});

vi.mock('next-intl', () => ({
  useTranslations: () => mockUseTranslations,
}));

function createWrapper() {
  const queryClient = new QueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('ImpactResult (M5 Phase 2)', () => {
  it('renders all 5 result components', () => {
    const data: ImpactCheckResponse = {
      matrix: [
        { level: 'required', ref: '21 CFR 820.30', note: 'Validation required', market: 'us' },
      ],
      signal: 'red',
      classification: { category: 'bom', confidence: 0.85, reason: 'SoC change' },
      similarCases: [{ id: 'case-1', title: 'Case 1', content: 'Content', similarity: 0.9 }],
      ticketId: 'ticket-123',
      recommendation: 'high-confidence-auto-approve',
    };

    render(<ImpactResult data={data} />, { wrapper: createWrapper() });

    expect(screen.getByTestId('signal-light')).toBeInTheDocument();
    expect(screen.getByTestId('matrix-table')).toBeInTheDocument();
    expect(screen.getByTestId('llm-classification')).toBeInTheDocument();
    expect(screen.getByTestId('similar-cases')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-cta')).toBeInTheDocument();
  });

  it('renders similarCasesCard with undefined similarCases (Edge Case 8)', () => {
    const data: ImpactCheckResponse = {
      matrix: [],
      signal: 'yellow',
      classification: { category: 'sw', confidence: 0.65, reason: 'Minor change' },
      recommendation: 'low-confidence-manual-review',
    };

    render(<ImpactResult data={data} />, { wrapper: createWrapper() });

    expect(screen.getByTestId('similar-cases')).toBeInTheDocument();
    expect(screen.getByText('result.similarCasesSkipped')).toBeInTheDocument();
  });

  it('does not render ticket-cta when ticketId is absent', () => {
    const data: ImpactCheckResponse = {
      matrix: [],
      signal: 'green',
      classification: { category: 'label', confidence: 0.95, reason: 'Label update' },
      similarCases: [],
      recommendation: 'high-confidence-auto-approve',
    };

    render(<ImpactResult data={data} />, { wrapper: createWrapper() });

    expect(screen.queryByTestId('ticket-cta')).not.toBeInTheDocument();
  });
});
