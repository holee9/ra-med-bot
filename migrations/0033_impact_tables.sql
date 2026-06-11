-- SPEC-REGULA-IMPACT-001: regulatory_impact_assessments + impact_action_items tables.
-- REQ-IMPACT-001 (per-project assessment), REQ-IMPACT-002 (action items).
-- Branch: feat/issue-41-impact-tracker

CREATE TABLE regulatory_impact_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regulatory_update_id UUID NOT NULL REFERENCES regulatory_updates(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  impact_level TEXT NOT NULL DEFAULT 'info',
  affected_sections JSONB NOT NULL DEFAULT '[]',
  analysis_summary TEXT,
  confidence NUMERIC(3,2),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ria_update_project_key UNIQUE(regulatory_update_id, project_id),
  CONSTRAINT ria_impact_level_check
    CHECK (impact_level IN ('critical','high','medium','info'))
);

CREATE INDEX idx_ria_project_impact
  ON regulatory_impact_assessments(project_id, impact_level);
CREATE INDEX idx_ria_update
  ON regulatory_impact_assessments(regulatory_update_id);

CREATE TABLE impact_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL
    REFERENCES regulatory_impact_assessments(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  priority TEXT NOT NULL DEFAULT 'medium',
  document_type TEXT,
  section_reference TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT iai_priority_check
    CHECK (priority IN ('critical','high','medium','info')),
  CONSTRAINT iai_status_check
    CHECK (status IN ('open','in_progress','resolved'))
);
