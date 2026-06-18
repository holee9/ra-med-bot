import {
  type ApprovalRequest,
  type ApprovalResponse,
  type SessionRequest,
  type SessionResponse,
  type SessionState,
  authoringClient,
} from '@/lib/api/authoring-client';
// @MX:NOTE [AUTO] TanStack Query hooks for Authoring API (Issue #171).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type {
  SessionRequest,
  SessionResponse,
  SessionState,
  ApprovalRequest,
  ApprovalResponse,
} from '@/lib/api/authoring-client';

export function useCreateAuthoringSession() {
  const queryClient = useQueryClient();
  return useMutation<SessionResponse, Error, SessionRequest>({
    mutationFn: (request) => authoringClient.createSession(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['authoring', 'sessions'] });
    },
  });
}

export function useAuthoringSession(sessionId: string) {
  return useQuery<SessionState, Error>({
    queryKey: ['authoring', 'sessions', sessionId],
    queryFn: () => authoringClient.getSession(sessionId),
    enabled: !!sessionId,
    staleTime: 30_000,
    refetchInterval: 5000,
  });
}

export function useApproveSession() {
  return useMutation<ApprovalResponse, Error, { sessionId: string; request: ApprovalRequest }>({
    mutationFn: ({ sessionId, request }) => authoringClient.approveSession(sessionId, request),
  });
}

export function useRejectSession() {
  return useMutation<ApprovalResponse, Error, { sessionId: string; request: ApprovalRequest }>({
    mutationFn: ({ sessionId, request }) => authoringClient.rejectSession(sessionId, request),
  });
}
