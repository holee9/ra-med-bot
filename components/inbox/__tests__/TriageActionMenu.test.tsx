/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import type { TriageState } from '@/lib/domains/inbox/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TriageActionMenu } from '../TriageActionMenu';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock useTriageTransition
vi.mock('@/lib/queries/useInbox', () => ({
  useTriageTransition: () => ({
    mutate: vi.fn(),
  }),
}));

// Wrapper with QueryClient
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('TriageActionMenu - T-015 VALID_TRANSITIONS compliance', () => {
  const mockOnTransition = vi.fn();

  it('should render menu button for auto state (AC-UI-003 scenario 1)', () => {
    render(
      <TestWrapper>
        <TriageActionMenu ticketId="test-1" currentState="auto" onTransition={mockOnTransition} />
      </TestWrapper>,
    );

    // Should have menu button
    const menuButton = screen.getByRole('button', { name: /actions.open/i });
    expect(menuButton).toBeDefined();
  });

  it('should render menu button for waiting state', () => {
    render(
      <TestWrapper>
        <TriageActionMenu
          ticketId="test-2"
          currentState="waiting"
          onTransition={mockOnTransition}
        />
      </TestWrapper>,
    );

    // Should have menu button
    const menuButton = screen.getByRole('button', { name: /actions.open/i });
    expect(menuButton).toBeDefined();
  });

  it('should render menu button for needs-review state', () => {
    render(
      <TestWrapper>
        <TriageActionMenu
          ticketId="test-3"
          currentState="needs-review"
          onTransition={mockOnTransition}
        />
      </TestWrapper>,
    );

    // Should have menu button
    const menuButton = screen.getByRole('button', { name: /actions.open/i });
    expect(menuButton).toBeDefined();
  });

  it('should show correct transition options when menu opened for auto state', () => {
    render(
      <TestWrapper>
        <TriageActionMenu ticketId="test-1" currentState="auto" onTransition={mockOnTransition} />
      </TestWrapper>,
    );

    const menuButton = screen.getByRole('button', { name: /actions.open/i });
    fireEvent.click(menuButton);

    // Should only show "needs review" option
    const needsReviewButton = screen.getByRole('button', { name: /needs review/i });
    expect(needsReviewButton).toBeDefined();

    // Should not show other options
    expect(screen.queryByRole('button', { name: /escalated/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /waiting/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /closed/i })).toBeNull();
  });

  it('should not render menu for non ra-lead users (REQ-V3-UI-032)', () => {
    const { container } = render(
      <TestWrapper>
        <TriageActionMenu
          ticketId="test-4"
          currentState="auto"
          onTransition={mockOnTransition}
          userRole="ra-member"
        />
      </TestWrapper>,
    );

    // Menu should not be visible for non-lead users
    expect(container.firstChild).toBeNull();
  });

  it('should render menu for ra-lead users', () => {
    const { container } = render(
      <TestWrapper>
        <TriageActionMenu
          ticketId="test-5"
          currentState="auto"
          onTransition={mockOnTransition}
          userRole="ra-lead"
        />
      </TestWrapper>,
    );

    // Menu should be visible for ra-lead
    expect(container.firstChild).not.toBeNull();
  });
});
