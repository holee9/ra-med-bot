-- 0099_knowledge_sources.sql
-- Issue #307: 설정 지식베이스 연결 (git repo 동기화)
-- knowledge_sources: 조직별 git repo 연결 설정 (git URL·lastSyncedAt·syncStatus).
-- 코퍼스 청크는 기존 sources/source_sections (동기화 결과로 채워짐).
-- 공개 repo는 auth_token_encrypted=null (인증 없이 clone). private는 토큰(옵션).

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  git_url text NOT NULL,
  branch text NOT NULL DEFAULT 'main',
  source_host text,
  source_owner text,
  source_repo text,
  last_synced_at timestamptz,
  sync_status text NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'synced', 'failed')),
  auth_token_encrypted text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_sources_org ON knowledge_sources(organization_id);
CREATE INDEX idx_knowledge_sources_status ON knowledge_sources(sync_status);

ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_sources FORCE ROW LEVEL SECURITY;
CREATE POLICY knowledge_sources_org_isolated ON knowledge_sources
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'knowledge_source.created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'knowledge_source.updated';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'knowledge_source.deleted';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'knowledge_source.synced';
