/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import type { TriageState } from '@/lib/domains/inbox/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KanbanColumn } from '../KanbanColumn';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'inbox.columns.auto': 'Auto',
      'inbox.columns.needs-review': 'Needs Review',
      'inbox.columns.escalated': 'Escalated',
      'inbox.columns.waiting': 'Waiting',
      'inbox.columns.closed': 'Closed',
      'inbox.columns.rejected': 'Rejected',
      'inbox.empty': 'No tickets',
      'inbox.loading': 'Loading...',
      'inbox.errors.transitionFailed': 'Transition failed',
      'inbox.actions.refresh': 'Retry',
    };
    return translations[key] || key;
  },
}));

function createWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('KanbanColumn', () => {
  const mockTickets = [
    { id: '1', question: 'Test question 1', triageState: 'auto' as TriageState },
    { id: '2', question: 'Test question 2', triageState: 'auto' as TriageState },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header with title and count', () => {
    render(<KanbanColumn title="Auto" state="auto" tickets={mockTickets} />, {
      wrapper: createWrapper,
    });

    const title = screen.getByText('Auto');
    expect(title).toBeInTheDocument();

    const count = screen.getByText('2');
    expect(count).toBeInTheDocument();
  });

  it('renders list of TicketCard components', () => {
    render(<KanbanColumn title="Auto" state="auto" tickets={mockTickets} />, {
      wrapper: createWrapper,
    });

    expect(screen.getByText('Test question 1')).toBeInTheDocument();
    expect(screen.getByText('Test question 2')).toBeInTheDocument();
  });

  it('renders empty state when no tickets', () => {
    render(<KanbanColumn title="Auto" state="auto" tickets={[]} />, {
      wrapper: createWrapper,
    });

    const emptyState = screen.getByTestId('column-empty');
    expect(emptyState).toBeInTheDocument();
    // The i18n key 'inbox.empty' is mocked to return 'empty'
    expect(emptyState.textContent).toBe('empty');
  });

  it('renders loading skeleton when isLoading is true', () => {
    render(<KanbanColumn title="Auto" state="auto" tickets={[]} isLoading />, {
      wrapper: createWrapper,
    });

    const loading = screen.getByTestId('column-loading');
    expect(loading).toBeInTheDocument();
    // Verify skeleton elements are present
    const skeletons = loading.querySelectorAll('div[aria-label="Loading ticket"]');
    expect(skeletons).toHaveLength(3);
  });

  it('renders error state with retry button when error provided', () => {
    const onRetry = vi.fn();
    render(
      <KanbanColumn
        title="Auto"
        state="auto"
        tickets={[]}
        error={new Error('Failed')}
        onRetry={onRetry}
      />,
      { wrapper: createWrapper },
    );

    const errorState = screen.getByTestId('column-error');
    expect(errorState).toBeInTheDocument();

    const retryButton = screen.getByRole('button');
    expect(retryButton).toBeInTheDocument();

    retryButton.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render error state when error is null', () => {
    render(<KanbanColumn title="Auto" state="auto" tickets={[]} error={null} />, {
      wrapper: createWrapper,
    });

    expect(screen.queryByTestId('column-error')).not.toBeInTheDocument();
  });
});
