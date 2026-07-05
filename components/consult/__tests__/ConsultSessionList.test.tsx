import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
/** @vitest-environment jsdom */
// RED Phase — M6-SessionList: ConsultSessionList will be implemented next
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConsultSessionList from '../ConsultSessionList';

interface MockSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

global.fetch = vi.fn();

// ConsultSessionList uses useTranslations('consult') — provide next-intl mock.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// ConsultSessionList renders <NewSessionDialog/> which uses useRouter + useCreateConsultSession.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/queries/useConsult', async () => {
  const actual = await vi.importActual<typeof import('@/lib/queries/useConsult')>(
    '@/lib/queries/useConsult',
  );
  return {
    ...actual,
    useCreateConsultSession: () => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    }),
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 60000, refetchOnWindowFocus: true },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function screenByText(text: string) {
  const elements = document.querySelectorAll('*');
  for (const el of elements) {
    if (el.textContent?.includes(text)) {
      return el;
    }
  }
  return null;
}

describe('ConsultSessionList (M6-RED-005)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    const mockSessions: MockSession[] = [];
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: mockSessions,
        pagination: { limit: 50, offset: 0, count: 0 },
      }),
    });

    render(<ConsultSessionList />, { wrapper: createWrapper() });
    const loadingElement = screen.queryByTestId(/loading/i);
    expect(loadingElement).not.toBeNull();
  });

  it('should render session cards when data loaded', async () => {
    const mockSessions: MockSession[] = [
      {
        id: 'session-1',
        title: 'Test Session',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      },
    ];
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: mockSessions,
        pagination: { limit: 50, offset: 0, count: 1 },
      }),
    });

    render(<ConsultSessionList />, { wrapper: createWrapper() });

    // Wait for loading to complete
    await vi.waitFor(() => {
      const loadingElement = screen.queryByTestId(/loading/i);
      expect(loadingElement).toBeNull();
    });

    const titleElement = screenByText('Test Session');
    expect(titleElement).not.toBeNull();
  });

  it('should render empty state when no sessions', async () => {
    const mockSessions: MockSession[] = [];
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: mockSessions,
        pagination: { limit: 50, offset: 0, count: 0 },
      }),
    });

    render(<ConsultSessionList />, { wrapper: createWrapper() });

    await vi.waitFor(() => {
      const loadingElement = screen.queryByTestId(/loading/i);
      expect(loadingElement).toBeNull();
    });

    const emptyElement = screen.queryByTestId(/empty/i);
    expect(emptyElement).not.toBeNull();
  });
});
