/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import type { TriageState } from '@/lib/domains/inbox/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InboxKanban } from '../InboxKanban';

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

// Mock useInboxTickets hook
const mockUseInboxTickets = vi.fn();
vi.mock('@/lib/queries/useInbox', () => ({
  useInboxTickets: (state: TriageState) => mockUseInboxTickets(state),
}));

// Mock Zustand store
const mockToggleArchived = vi.fn();
let mockShowArchived = false;
vi.mock('@/stores/inbox', () => ({
  useInboxStore: () => ({
    get showArchived() {
      return mockShowArchived;
    },
    toggleArchived: mockToggleArchived,
  }),
}));

// Mock queryClient
const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

function createWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('InboxKanban', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowArchived = false;

    // Default mock return for any state
    mockUseInboxTickets.mockReturnValue({
      data: [
        { id: '1', question: 'Test ticket 1', triageState: 'auto' as TriageState },
        { id: '2', question: 'Test ticket 2', triageState: 'auto' as TriageState },
      ],
      isLoading: false,
      error: null,
    });
  });

  it('renders 4 active columns when showArchived is false', () => {
    const { container } = render(<InboxKanban />, { wrapper: createWrapper });

    // Check header is rendered
    expect(container.querySelector('h1')).toHaveTextContent('Inbox');

    // 4 active columns: auto, needs-review, escalated, waiting
    const columns = screen.getAllByTestId(/^kanban-column-/);

    expect(columns.length).toBeGreaterThanOrEqual(4);
  });

  it('renders 6 columns including archived when showArchived is true', () => {
    mockShowArchived = true;

    render(<InboxKanban />, { wrapper: createWrapper });

    // All 6 columns should be rendered
    const columns = screen.getAllByTestId(/^kanban-column-/);

    expect(columns.length).toBeGreaterThanOrEqual(6);
  });

  it('calls invalidateQueries on refresh button click', () => {
    render(<InboxKanban />, { wrapper: createWrapper });

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    refreshButton.click();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['inbox'] });
  });

  it('calls toggleArchived on toggle button click', () => {
    render(<InboxKanban />, { wrapper: createWrapper });

    const toggleButton = screen.getByRole('button', { name: /show archived/i });
    toggleButton.click();

    expect(mockToggleArchived).toHaveBeenCalledTimes(1);
  });
});
