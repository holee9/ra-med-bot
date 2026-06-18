import {
  type BinderRequest,
  type BinderResponse,
  type EvidenceLink,
  type LinkRequest,
  type LinkResponse,
  evidenceClient,
} from '@/lib/api/evidence-client';
// @MX:NOTE [AUTO] TanStack Query hooks for Evidence API (Issue #168).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type {
  LinkRequest,
  LinkResponse,
  EvidenceLink,
  BinderRequest,
  BinderResponse,
} from '@/lib/api/evidence-client';

export function useCreateEvidenceLink() {
  const queryClient = useQueryClient();
  return useMutation<LinkResponse, Error, LinkRequest>({
    mutationFn: (request) => evidenceClient.createLink(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', 'links'] });
    },
  });
}

export function useEvidenceLinks(reqId: string) {
  return useQuery<EvidenceLink[], Error>({
    queryKey: ['evidence', 'links', reqId],
    queryFn: () => evidenceClient.getLinks(reqId),
    enabled: !!reqId,
    staleTime: 30_000,
  });
}

export function useCreateBinder() {
  return useMutation<BinderResponse, Error, BinderRequest>({
    mutationFn: (request) => evidenceClient.createBinder(request),
  });
}
