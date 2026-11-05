-- @MX:NOTE [AUTO] 이슈 552 — llm-wiki catalog 임베딩 캐시 (A안).
-- catalog 엔트리(title+summary)의 MRL 1536 벡터 보관.
-- content_hash 기반 증분: 엔트리 텍스트가 변하지 않으면 재임베딩하지 않는다
-- (전량 64K건 ≈ 4시간 — 매일 갱신 계약상 증분 필수).
-- Rollback: DROP TABLE llm_wiki_catalog_entries;

CREATE TABLE IF NOT EXISTS llm_wiki_catalog_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sha text NOT NULL,
  path text NOT NULL,
  content_hash text NOT NULL,
  type text NOT NULL,
  title text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at text,
  embedding vector(1536)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_llm_wiki_catalog_hash
  ON llm_wiki_catalog_entries (content_hash);
CREATE INDEX IF NOT EXISTS idx_llm_wiki_catalog_path
  ON llm_wiki_catalog_entries (path);
