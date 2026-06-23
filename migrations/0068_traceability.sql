-- SPEC-REGULA-TRACEABILITY-001 (Issue #47) — Local evidence graph layer.
--
-- Lays a thin abstract graph (evidence_nodes / evidence_edges / stale_flags)
-- over the existing 53 tables. Nodes reference existing rows via
-- (ref_table, ref_id); edges encode derived_from / cites / reviewed_by /
-- exported_in / mitigates / satisfies relations; stale_flags propagate when
-- a source or regulation is superseded.
--
-- This migration is STRICTLY separate from Issue #169's BFF proxy
-- (/api/ra/traceability/*) which delegates to hybrid-ra-saas. The local
-- graph owns project-scoped evidence traceability for audit-ready RA packets.
--
-- Single-file convention: this project uses ONE numbered SQL file per
-- migration (see tests/unit/enterprise-migrations.test.ts).

-- ---------------------------------------------------------------------------
-- 1. New pgEnums: evidence_node_type, evidence_edge_relation, stale_reason
-- ---------------------------------------------------------------------------

CREATE TYPE evidence_node_type AS ENUM (
  'source_section',
  'message_source',
  'message',
  'workflow_run',
  'expert_review',
  'submission_package',
  'risk_item',
  'regulatory_update'
);

CREATE TYPE evidence_edge_relation AS ENUM (
  'derived_from',
  'cites',
  'reviewed_by',
  'exported_in',
  'mitigates',
  'satisfies'
);

CREATE TYPE stale_reason AS ENUM (
  'superseded_source',
  'superseded_regulation'
);

-- ---------------------------------------------------------------------------
-- 2. audit_action enum extensions (4 traceability-specific values)
--    These are distinct from #169's workflow.start — local-graph audit trail.
-- ---------------------------------------------------------------------------

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'traceability.edge_created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'traceability.edge_deleted';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'traceability.packet_exported';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'traceability.stale_propagated';

-- ---------------------------------------------------------------------------
-- 3. evidence_nodes — graph nodes pointing at existing rows
-- ---------------------------------------------------------------------------

CREATE TABLE evidence_nodes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  node_type       evidence_node_type NOT NULL,
  ref_table       TEXT NOT NULL,
  ref_id          TEXT NOT NULL,
  authority       TEXT,
  version         TEXT,
  effective_date  TIMESTAMPTZ,
  reviewer_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  artifact_hash   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX idx_evidence_nodes_ref ON evidence_nodes (ref_table, ref_id);
CREATE INDEX idx_evidence_nodes_project ON evidence_nodes (project_id);
CREATE INDEX idx_evidence_nodes_org ON evidence_nodes (org_id);
CREATE UNIQUE INDEX uq_evidence_nodes_ref ON evidence_nodes (org_id, node_type, ref_table, ref_id);

ALTER TABLE evidence_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_evidence_nodes"
  ON evidence_nodes
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- ---------------------------------------------------------------------------
-- 4. evidence_edges — typed relations between nodes (no self-references)
-- ---------------------------------------------------------------------------

CREATE TABLE evidence_edges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_node_id  UUID NOT NULL REFERENCES evidence_nodes(id) ON DELETE CASCADE,
  to_node_id    UUID NOT NULL REFERENCES evidence_nodes(id) ON DELETE CASCADE,
  relation      evidence_edge_relation NOT NULL,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT evidence_edges_no_self CHECK (from_node_id <> to_node_id)
);

CREATE INDEX idx_evidence_edges_from ON evidence_edges (from_node_id);
CREATE INDEX idx_evidence_edges_to ON evidence_edges (to_node_id);
CREATE INDEX idx_evidence_edges_relation ON evidence_edges (relation);
-- Dedup envelope: one logical relation per (from, to, relation) within an org.
CREATE UNIQUE INDEX uq_evidence_edges_relation ON evidence_edges (org_id, from_node_id, to_node_id, relation);

ALTER TABLE evidence_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_evidence_edges"
  ON evidence_edges
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- ---------------------------------------------------------------------------
-- 5. stale_flags — supersession propagation markers (idempotent upsert target)
-- ---------------------------------------------------------------------------

CREATE TABLE stale_flags (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  node_id                 UUID NOT NULL REFERENCES evidence_nodes(id) ON DELETE CASCADE,
  reason                  stale_reason NOT NULL,
  propagated_from_node_id UUID REFERENCES evidence_nodes(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stale_flags_node ON stale_flags (node_id);
CREATE INDEX idx_stale_flags_org ON stale_flags (org_id);
-- Idempotency: a node is flagged stale at most once per reason.
CREATE UNIQUE INDEX uq_stale_flags_node_reason ON stale_flags (node_id, reason);

ALTER TABLE stale_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_stale_flags"
  ON stale_flags
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
