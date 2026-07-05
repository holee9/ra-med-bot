import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
/** @vitest-environment jsdom */
// RED Phase — M6-Foundation: useConsult hooks will be implemented next
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useConsultSession,
  useConsultSessions,
  useCreateConsultSession,
  useCreateTurn,
} from '../useConsult';

type ConsultSession = {
  id: string;
  orgId: string;
  userId: string;
  projectId: string | null;
  title: string;
  locale: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

global.fetch = vi.fn();

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

describe('useConsultSessions (M6-RED-001)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch sessions from /api/consult/sessions with limit and offset params', async () => {
    const mockSessions = [
      {
        id: 'session-1',
        orgId: 'org-1',
        userId: 'user-1',
        projectId: 'project-1',
        title: 'Test Session',
        locale: 'ko',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
        deletedAt: null,
      },
    ];
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: mockSessions,
        pagination: { limit: 50, offset: 0, count: 1 },
      }),
    });

    const { result } = renderHook(() => useConsultSessions({ limit: 50, offset: 0 }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(mockSessions);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/consult/sessions?limit=50&offset=0'),
    );
  });

  it('should use default limit=50 when not provided', async () => {
    const mockSessions: ConsultSession[] = [];
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: mockSessions,
        pagination: { limit: 50, offset: 0, count: 0 },
      }),
    });

    const { result } = renderHook(() => useConsultSessions({}), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/consult/sessions?limit=50'),
    );
  });
});

describe('useConsultSession (M6-RED-002)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch single session with turns from /api/consult/sessions/:sessionId', async () => {
    const mockSession = {
      session: {
        id: 'session-1',
        orgId: 'org-1',
        userId: 'user-1',
        projectId: 'project-1',
        title: 'Test Session',
        locale: 'ko',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
        deletedAt: null,
      },
      turns: [
        {
          id: 'turn-1',
          sessionId: 'session-1',
          turnNumber: 1,
          question: 'Test question',
          answer: 'Test answer',
          citations: [{ sourceId: 'src-1', text: 'Test citation' }],
          sources: [{ id: 'src-1', title: 'Test Source' }],
          confidence: 0.9,
          error: null,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
    };
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSession,
    });

    const { result } = renderHook(() => useConsultSession('session-1'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(mockSession);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/consult/sessions/session-1'),
    );
  });
});

describe('useCreateConsultSession (M6-RED-003)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should POST to /api/consult/sessions with title, projectId, locale', async () => {
    const newSession = {
      session: {
        id: 'session-1',
        title: 'New Session',
        projectId: 'project-1',
        locale: 'ko',
      },
    };
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => newSession,
    });

    const { result } = renderHook(() => useCreateConsultSession(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      title: 'New Session',
      projectId: 'project-1',
      locale: 'ko',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/consult/sessions',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('New Session'),
      }),
    );
  });
});

describe('useCreateTurn (M6-RED-004)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should POST to /api/consult/sessions/:sessionId/turns with question', async () => {
    const newTurn = {
      turn: {
        id: 'turn-1',
        sessionId: 'session-1',
        turnNumber: 1,
        question: 'Test question',
        answer: 'Test answer',
        citations: [],
        sources: [],
        confidence: 0.9,
        error: null,
        createdAt: '2026-01-01T00:00:00Z',
      },
    };
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => newTurn,
    });

    const { result } = renderHook(() => useCreateTurn('session-1'), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({ question: 'Test question' });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/consult/sessions/session-1/turns',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('Test question'),
      }),
    );
  });

  it('should handle 400 error with turn in response', async () => {
    const errorTurn = {
      turn: {
        id: 'turn-1',
        sessionId: 'session-1',
        turnNumber: 1,
        question: 'Test question',
        answer: null,
        citations: [],
        sources: [],
        confidence: null,
        error: 'timeout',
        createdAt: '2026-01-01T00:00:00Z',
      },
    };
    const mockErrorResponse = { error: 'Request timeout', turn: errorTurn.turn };
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => mockErrorResponse,
    });

    const { result } = renderHook(() => useCreateTurn('session-1'), {
      wrapper: createWrapper(),
    });

    try {
      await result.current.mutateAsync({ question: 'Test question' });
      expect.fail('Should have thrown an error');
    } catch (error) {
      const turn = (error as { turn?: unknown }).turn;
      expect(turn).toBeDefined();
      expect(turn).toEqual(errorTurn.turn);
    }
  });
});
