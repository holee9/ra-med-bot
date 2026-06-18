import {
  type ImpactRequest,
  type ImpactResult,
  type ScanRequest,
  type ScanResult,
  type TraceGraph,
  traceabilityClient,
} from '@/lib/api/traceability-client';
// @MX:NOTE [AUTO] TanStack Query hooks for Traceability API (Issue #169).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type {
  ScanResult,
  TraceGraph,
  ImpactResult,
  TraceNode,
  TraceEdge,
  ImpactedNode,
} from '@/lib/api/traceability-client';

export function useScanTraceability() {
  const queryClient = useQueryClient();
  return useMutation<ScanResult, Error, ScanRequest>({
    mutationFn: (request) => traceabilityClient.scan(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['traceability', 'graph'] });
    },
  });
}

export function useTraceGraph(scanId?: string) {
  return useQuery<TraceGraph, Error>({
    queryKey: ['traceability', 'graph', scanId ?? 'latest'],
    queryFn: () => traceabilityClient.getGraph(scanId),
    enabled: true,
    staleTime: 30_000,
  });
}

export function useImpactAnalysis() {
  return useMutation<ImpactResult, Error, ImpactRequest>({
    mutationFn: (request) => traceabilityClient.analyzeImpact(request),
  });
}
