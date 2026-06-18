/**
 * TanStack Query hooks for Checklist API
 *
 * Provides React Query hooks for checklist operations:
 * - Generate checklist from product/requirements
 * - Fetch checklist details
 * - Update checklist item status
 * - Get gap analysis
 *
 * @see lib/api/checklist-client.ts
 * @MX:NOTE: [AUTO] React Query hooks for checklist operations with cache management
 * @MX:ANCHOR: [AUTO] Checklist state management - Central cache invalidation logic
 * @MX:REASON: [AUTO] Multiple components depend on these hooks for checklist state
 */

import {
  type Checklist,
  type ChecklistItem,
  type GapAnalysisResult,
  checklistClient,
} from '@/lib/api/checklist-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Generate checklist hook
 * @MX:ANCHOR: [AUTO] Checklist generation mutation - Invalidates related queries on success
 * @MX:REASON: [AUTO] Core mutation that triggers cache updates across checklist views
 */
export function useGenerateChecklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: {
      product_type: string;
      requirement_type?: string;
      product_name?: string;
      requirements?: string[];
    }) => checklistClient.generateChecklist(request),

    onSuccess: (data: Checklist) => {
      // Invalidate and refetch checklist queries
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      queryClient.setQueryData(['checklist', data.id], data);
    },
  });
}

/**
 * Get checklist hook
 */
export function useChecklist(checklistId: string) {
  return useQuery({
    queryKey: ['checklist', checklistId],
    queryFn: () => checklistClient.getChecklist(checklistId),
    enabled: !!checklistId,
  });
}

/**
 * Update checklist item hook
 * @MX:ANCHOR: [AUTO] Checklist item update mutation - Updates cached data optimistically
 * @MX:REASON: [AUTO] Core mutation that maintains checklist cache consistency
 */
export function useUpdateChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      checklistId,
      itemId,
      request,
    }: {
      checklistId: string;
      itemId: string;
      request: { status: 'pending' | 'in_progress' | 'completed' | 'skipped'; notes?: string };
    }) => checklistClient.updateChecklistItem(checklistId, itemId, request),

    onSuccess: (updatedItem: ChecklistItem, variables) => {
      // Update the checklist cache with the updated item
      queryClient.setQueryData<Checklist>(['checklist', variables.checklistId], (old) => {
        if (!old) return old;

        return {
          ...old,
          items: old.items.map((item) => (item.id === updatedItem.id ? updatedItem : item)),
        };
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['checklist', variables.checklistId] });
      queryClient.invalidateQueries({ queryKey: ['gap-analysis', variables.checklistId] });
    },
  });
}

/**
 * Get gap analysis hook
 */
export function useGapAnalysis(checklistId: string) {
  return useQuery({
    queryKey: ['gap-analysis', checklistId],
    queryFn: () => checklistClient.getGapAnalysis(checklistId),
    enabled: !!checklistId,
  });
}

// Export types for use in components
export type { Checklist, ChecklistItem, GapAnalysisResult };
