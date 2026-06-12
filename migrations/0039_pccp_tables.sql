-- REQ-PCCP-010: pccp_versions — PCCP version lifecycle per device.
-- REQ-PCCP-022: pccp_components — per-component completion tracking.
-- @MX:SPEC SPEC-REGULA-PCCP-001

CREATE TABLE pccp_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL,
  version VARCHAR(50) NOT NULL DEFAULT '1.0',
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'cleared', 'superseded')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  baseline_snapshot_jsonb JSONB,
  parent_workflow_id UUID,
  device_name VARCHAR(255) NOT NULL,
  manufacturer VARCHAR(255) NOT NULL,
  indication VARCHAR(1000),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce at most one active PCCP per device (REQ-PCCP-010, AC-9)
CREATE UNIQUE INDEX pccp_versions_device_active_idx
  ON pccp_versions (device_id)
  WHERE active = TRUE;

CREATE TABLE pccp_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pccp_version_id UUID NOT NULL REFERENCES pccp_versions(id) ON DELETE CASCADE,
  component_type VARCHAR(50) NOT NULL
    CHECK (component_type IN (
      'modification_description',
      'sps',
      'acp',
      'impact_assessment',
      'performance_testing'
    )),
  content_jsonb JSONB NOT NULL DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pccp_version_id, component_type)
);
