-- @MX:NOTE [AUTO] Phase 5 Enterprise Hardening — org_members and project_members tables.
-- CF-2 fix: These tables are required for RBAC 2-tier membership model
-- (Technical Decision 2) but were absent from FOUNDATION schema.
--
-- org_members: tracks which users belong to which organizations.
-- project_members: tracks which users can access which projects.
--
-- Both use composite primary keys (user_id, org_id) / (user_id, project_id)
-- to enforce uniqueness without a surrogate key.
-- IF NOT EXISTS guards ensure idempotency.
--
-- Note: organizations table has no FK reference here because org_id will
-- reference the organizations table. If the organizations table does not
-- have the referenced org, the FK constraint will catch it at DML time.

CREATE TABLE IF NOT EXISTS org_members (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id)
);

CREATE TABLE IF NOT EXISTS project_members (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);

-- Indexes for reverse lookups (find all users in an org/project).
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON org_members (org_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members (project_id);

-- Rollback (Phase 6 down script placeholder):
-- DROP TABLE IF EXISTS project_members;
-- DROP TABLE IF EXISTS org_members;
