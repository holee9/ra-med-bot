// @MX:ANCHOR [AUTO] useInboxTickets/useInboxTicket — inbox data fetching hooks.
// @MX:REASON Fan-in ≥3: Kanban board (4 columns), ticket detail page, viewer ticket summary.
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-002, REQ-V3-UI-045, Issue #320)

import type { TriageState } from '@/lib/domains/inbox/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface InboxTicket {
  id: string;
  question: string;
  triageState: TriageState;
  // Additional API fields can be added as needed
  createdAt?: string;
  updatedAt?: string;
  assigneeId?: string | null;
}

interface UseInboxTicketsResult {
  data: InboxTicket[] | undefined;
  isLoading: boolean;
  error: unknown;
}

interface UseInboxTicketResult {
  data: InboxTicket | undefined;
  isLoading: boolean;
  error: unknown;
}

interface TriageTransitionInput {
  ticketId: string;
  toState: TriageState;
  reason?: string;
}

interface ApproveTicketInput {
  ticketId: string;
  password: string;
  esigSignature: string;
}

interface MutationError extends Error {
  status: number;
  message: string;
}

/**
 * Fetch inbox tickets grouped by triage state (Kanban column query).
 * REQ-V3-UI-002: GET /api/inbox?state=<state>&limit=50
 * REQ-V3-UI-045: staleTime: 60_000, revalidateOnFocus: true
 */
export function useInboxTickets(state: TriageState): UseInboxTicketsResult {
  const query = useQuery({
    queryKey: ['inbox', state],
    queryFn: async () => {
      const res = await fetch(`/api/inbox?state=${state}&limit=50`);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
      const json = await res.json();
      return json.tickets as InboxTicket[];
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
 * Fetch a single inbox ticket by ID.
 */
export function useInboxTicket(id: string): UseInboxTicketResult {
  const query = useQuery({
    queryKey: ['inbox', id],
    queryFn: async () => {
      const res = await fetch(`/api/inbox/${id}`);
      if (!res.ok) throw new Error(`Failed to fetch ticket: ${res.statusText}`);
      return res.json() as Promise<InboxTicket>;
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
 * Mutation hook for triage state transitions.
 * REQ-V3-UI-021: Optimistic update + rollback
 * REQ-V3-UI-022: 409 → rollback + toast
 * REQ-V3-UI-023: 404 → remove from cache + console warn
 */
export function useTriageTransition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticketId, toState, reason }: TriageTransitionInput) => {
      const res = await fetch(`/api/inbox/${ticketId}/triage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toState, reason }),
      });
      if (!res.ok) {
        const errorBody = await res.json();
        const err = new Error(errorBody.error || 'Transition failed') as MutationError;
        err.status = res.status;
        throw err;
      }
      return res.json();
    },
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['inbox'] });

      // Snapshot previous value
      const previousTickets = queryClient.getQueryData(['inbox', variables.toState]);

      // Optimistically update to the new value
      queryClient.setQueryData(['inbox', variables.toState], (old: InboxTicket[] = []) => [
        ...(old || []),
        { id: variables.ticketId, triageState: variables.toState },
      ]);

      // Return context with previous value for rollback
      return { previousTickets };
    },
    onError: (error: MutationError, variables, context) => {
      // Rollback on error
      if (error.status === 409) {
        // Rollback optimistic update (REQ-V3-UI-022)
        queryClient.setQueryData(
          ['inbox', variables.toState],
          (context as { previousTickets?: InboxTicket[] }).previousTickets,
        );
        console.error('Triage transition failed: Conflict - state changed since fetch');
      } else if (error.status === 404) {
        // Remove from cache (IDOR - REQ-V3-UI-023)
        queryClient.setQueryData(['inbox', variables.toState], (old: InboxTicket[] = []) =>
          (old || []).filter((t) => t.id !== variables.ticketId),
        );
        console.warn('Triage transition failed: Ticket not found (IDOR)');
      }
    },
    onSuccess: () => {
      // Invalidate both columns on success (REQ-V3-UI-016)
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

/**
 * Mutation hook for ESIG approval.
 * REQ-V3-UI-013: POST /api/inbox/[id]/approve with {password, esigSignature}
 * REQ-V3-UI-014: 401 → inline password error
 * REQ-V3-UI-015: 400 → blocking "missing final_answer" message
 * REQ-V3-UI-016: 200 → invalidate cache + navigate Kanban + success toast
 */
export function useApproveTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticketId, password, esigSignature }: ApproveTicketInput) => {
      const res = await fetch(`/api/inbox/${ticketId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, esigSignature }),
      });
      if (!res.ok) {
        const errorBody = await res.json();
        const err = new Error(errorBody.error || 'Approval failed') as MutationError;
        err.status = res.status;
        throw err;
      }
      return res.json();
    },
    onError: (error: MutationError) => {
      if (error.status === 401) {
        // Inline password error (REQ-V3-UI-014)
        console.error('Invalid password');
      } else if (error.status === 400) {
        // Missing final_answer blocking message (REQ-V3-UI-015)
        console.error('Cannot promote: missing final_answer');
      }
    },
    onSuccess: () => {
      // Invalidate inbox cache on success (REQ-V3-UI-016)
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}
