// SPEC-REGULA-IMPACT-001 — domain types for regulatory change impact tracking.

export type ImpactLevel = 'critical' | 'high' | 'medium' | 'info';
export type ActionItemStatus = 'open' | 'in_progress' | 'resolved';

export interface AffectedSection {
  document_type: string;
  section_reference: string;
  rationale: string;
}

export interface ImpactAssessment {
  id: string;
  regulatory_update_id: string;
  project_id: string;
  project_name: string;
  impact_level: ImpactLevel;
  affected_sections: AffectedSection[];
  analysis_summary: string | null;
  confidence: number | null;
  created_by: string | null;
  created_at: Date;
  action_items?: ImpactActionItem[];
}

export interface ImpactActionItem {
  id: string;
  assessment_id: string;
  project_id: string;
  priority: ImpactLevel;
  document_type: string | null;
  section_reference: string | null;
  description: string;
  status: ActionItemStatus;
  assigned_to: string | null;
  created_at: Date;
  resolved_at: Date | null;
}

export interface ScanResult {
  project_id: string;
  project_name: string;
  impact_level: ImpactLevel;
  affected_sections: AffectedSection[];
  analysis_summary: string;
  confidence: number;
}
