// @MX:NOTE [AUTO] Browser-side Checklist API client — calls ra-med-bot BFF routes.
// @MX:SPEC SPEC-INTEGRATION-001, Issue #170
// @MX:ANCHOR [AUTO] Checklist client — all checklist state flows through this module.
// @MX:REASON Public API boundary: consumed by useChecklists hook and future UI components >= 3.

export interface Checklist {
  id: string;
  product_type: string;
  requirement_type?: string;
  product_name?: string;
  status: 'pending' | 'in_progress' | 'completed';
  items: ChecklistItem[];
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  title: string;
  description?: string;
  category: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  notes?: string;
  requirement_ref?: string;
}

export interface GapAnalysisResult {
  checklist_id: string;
  total_items: number;
  completed_items: number;
  gap_percentage: number;
  critical_gaps: Array<{ item_id: string; title: string; category: string }>;
  recommendations: string[];
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const checklistClient = {
  generateChecklist(request: {
    product_type: string;
    requirement_type?: string;
    product_name?: string;
    requirements?: string[];
  }): Promise<Checklist> {
    return apiFetch('/api/ra/checklists/generate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  getChecklist(checklistId: string): Promise<Checklist> {
    return apiFetch(`/api/ra/checklists/${checklistId}`);
  },

  updateChecklistItem(
    checklistId: string,
    itemId: string,
    request: { status: 'pending' | 'in_progress' | 'completed' | 'skipped'; notes?: string },
  ): Promise<ChecklistItem> {
    return apiFetch(`/api/ra/checklists/${checklistId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    });
  },

  getGapAnalysis(checklistId: string): Promise<GapAnalysisResult> {
    return apiFetch(`/api/ra/checklists/gap?checklist_id=${checklistId}`);
  },
};
