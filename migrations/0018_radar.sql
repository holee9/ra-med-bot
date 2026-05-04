BEGIN;

-- Extend audit_action enum with 3 new values (Phase 10 Radar)
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'radar.crawler_run';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'radar.notification';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'radar.search';

-- Extend regulatory_updates table (add 8 columns — existing columns untouched)
ALTER TABLE regulatory_updates
  ADD COLUMN IF NOT EXISTS source_crawler TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS raw_content_en TEXT,
  ADD COLUMN IF NOT EXISTS raw_content_ko TEXT,
  ADD COLUMN IF NOT EXISTS impact_type_hint TEXT,
  ADD COLUMN IF NOT EXISTS tier1_relevant BOOLEAN,
  ADD COLUMN IF NOT EXISTS impact_score NUMERIC(3,2);

-- Unique constraint for deduplication
ALTER TABLE regulatory_updates
  ADD CONSTRAINT regulatory_updates_external_id_key UNIQUE (external_id);

-- New table: crawler_runs (tracks each crawler execution)
CREATE TABLE IF NOT EXISTS crawler_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawler_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','rate_limited','parse_error','robots_disallowed','geo_blocked','error')),
  records_added INTEGER DEFAULT 0,
  errors_json JSONB DEFAULT '[]'::jsonb,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE
);

-- New table: org_update_relevance (per-org impact scoring)
CREATE TABLE IF NOT EXISTS org_update_relevance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  update_id UUID NOT NULL REFERENCES regulatory_updates(id) ON DELETE CASCADE,
  impact_score NUMERIC(3,2) NOT NULL CHECK (impact_score >= 0 AND impact_score <= 1),
  matched_product_categories TEXT[] DEFAULT '{}',
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, update_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_regulatory_updates_external_id ON regulatory_updates(external_id);
CREATE INDEX IF NOT EXISTS idx_regulatory_updates_source_crawler ON regulatory_updates(source_crawler);
CREATE INDEX IF NOT EXISTS idx_regulatory_updates_impact_score ON regulatory_updates(impact_score DESC) WHERE impact_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crawler_runs_started_at ON crawler_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawler_runs_crawler_name ON crawler_runs(crawler_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_update_relevance_org_impact ON org_update_relevance(org_id, impact_score DESC);
CREATE INDEX IF NOT EXISTS idx_org_update_relevance_update ON org_update_relevance(update_id);

COMMIT;
