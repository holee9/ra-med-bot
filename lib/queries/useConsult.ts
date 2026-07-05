// @MX:ANCHOR [AUTO] useConsultSessions/useConsultSession — consult data fetching hooks.
// @MX:REASON Fan-in ≥3: SessionList, SessionDetail, NewSessionDialog, QuestionComposer.
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-050~062)

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface ConsultSession {
  id: string;
  orgId: string;
  userId: string;
  projectId: string | null;
  title: string;
  locale: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ConsultTurn {
  id: string;
  sessionId: string;
  turnNumber: number;
  question: string;
  answer: string | null;
  citations: Array<{ sourceId: string; text: string }>;
  sources: Array<{ id: string; title: string }>;
  confidence: number | null;
  error: string | null;
  createdAt: string;
}

interface SessionWithTurns {
  session: ConsultSession;
  turns: ConsultTurn[];
}

interface UseConsultSessionsResult {
  data: ConsultSession[] | undefined;
  isLoading: boolean;
  error: unknown;
}

interface UseConsultSessionResult {
  data: SessionWithTurns | undefined;
  isLoading: boolean;
  error: unknown;
}

interface CreateSessionInput {
  title: string;
  projectId?: string;
  locale?: string;
}

interface CreateTurnInput {
  question: string;
}

interface MutationError extends Error {
  status: number;
}

/**
 * Fetch consult sessions with pagination.
 * REQ-V3-UI-050: GET /api/consult/sessions?limit=50&offset=0
 */
export function useConsultSessions({
  limit = 50,
  offset = 0,
}: { limit?: number; offset?: number } = {}): UseConsultSessionsResult {
  const query = useQuery({
    queryKey: ['consult', 'sessions', limit, offset],
    queryFn: async () => {
      const res = await fetch(`/api/consult/sessions?limit=${limit}&offset=${offset}`);
      if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.statusText}`);
      const json = await res.json();
      return json.sessions as ConsultSession[];
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}

/**
 * Fetch a single consult session with turns.
 * REQ-V3-UI-052: GET /api/consult/sessions/[sessionId]
 */
export function useConsultSession(sessionId: string): UseConsultSessionResult {
  const query = useQuery({
    queryKey: ['consult', 'session', sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/consult/sessions/${sessionId}`);
      if (!res.ok) throw new Error(`Failed to fetch session: ${res.statusText}`);
      return res.json() as Promise<SessionWithTurns>;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    enabled: !!sessionId,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}

/**
 * Mutation hook for creating a new consult session.
 * REQ-V3-UI-053: POST /api/consult/sessions with {title, projectId?, locale?}
 */
export function useCreateConsultSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, projectId, locale }: CreateSessionInput) => {
      const res = await fetch('/api/consult/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, projectId, locale }),
      });
      if (!res.ok) {
        const errorBody = await res.json();
        const err = new Error(errorBody.error || 'Session creation failed') as MutationError;
        err.status = res.status;
        throw err;
      }
      return res.json();
    },
    onSuccess: () => {
      // Invalidate sessions cache on success
      queryClient.invalidateQueries({ queryKey: ['consult', 'sessions'] });
    },
  });
}

/**
 * Mutation hook for creating a new turn in a session.
 * REQ-V3-UI-057: POST /api/consult/sessions/[sessionId]/turns with {question}
 * REQ-V3-UI-059: 400 response includes turn object (persisted with error)
 */
export function useCreateTurn(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ question }: CreateTurnInput) => {
      const res = await fetch(`/api/consult/sessions/${sessionId}/turns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) {
        // Even on error, turn is persisted (REQ-V3-UI-059)
        const errorBody = await res.json();
        const err = new Error(errorBody.error || 'Turn creation failed') as MutationError & {
          turn?: ConsultTurn;
        };
        err.status = res.status;
        // Attach turn to error for display in history (REQ-V3-UI-059)
        err.turn = errorBody.turn as ConsultTurn | undefined;
        throw err;
      }
      return res.json();
    },
    onSuccess: () => {
      // Invalidate session cache to show new turn in history
      queryClient.invalidateQueries({ queryKey: ['consult', 'session', sessionId] });
    },
  });
}
