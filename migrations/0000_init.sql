-- @MX:NOTE Initial schema migration — REQ-FND-045.
-- @MX:SPEC SPEC-REGULA-FOUNDATION-001
--
-- This migration is hand-authored (not drizzle-kit generated) because it must
-- (a) install the pgvector extension before any vector(...) column is created
-- (b) wrap everything in a single transaction so a partial failure is rolled
-- back, leaving the database in a clean state.
--
-- Order: extension -> enums -> tables (FK-dependency order) -> ivfflat indexes.

BEGIN;

-- pgvector — REQ-FND-040, REQ-FND-044b. Must precede any vector(N) column.
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- pgEnums (8) — match lib/db/schema.ts exactly.
-- ---------------------------------------------------------------------------
CREATE TYPE locale AS ENUM ('ko', 'en');
CREATE TYPE theme_pref AS ENUM ('light', 'dark', 'system');
CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
CREATE TYPE confidence_level AS ENUM ('high', 'med', 'low');
CREATE TYPE block_type AS ENUM ('prose', 'checklist', 'comparison', 'timeline', 'sources', 'related');
CREATE TYPE source_type AS ENUM ('Regulation', 'Guidance', 'Standard', 'Industry', 'Internal');
CREATE TYPE expert_review_status AS ENUM ('pending', 'in_progress', 'resolved');
-- Phase 1 audit_action: only 3 values. Phase 5 will ALTER TYPE to add more.
CREATE TYPE audit_action AS ENUM ('llm.call', 'source.access', 'expert_review.flag');

-- ---------------------------------------------------------------------------
-- Tables — FK-dependency order.
-- ---------------------------------------------------------------------------

CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  tier        text NOT NULL DEFAULT 'standard',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  name        text NOT NULL,
  role        text NOT NULL DEFAULT 'member',
  locale      locale NOT NULL DEFAULT 'ko',
  theme_pref  theme_pref NOT NULL DEFAULT 'system',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  device_class    text,
  target_markets  text[] NOT NULL DEFAULT '{}',
  color           text,
  submission_date date,
  status          text NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE conversations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid REFERENCES projects(id) ON DELETE SET NULL,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title        text,
  status       text NOT NULL DEFAULT 'active',
  created_at   timestamptz NOT NULL DEFAULT now(),
  archived_at  timestamptz
);

CREATE TABLE messages (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id        uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role                   message_role NOT NULL,
  content_prose          text NOT NULL DEFAULT '',
  confidence_level       confidence_level,
  confidence_score       numeric(4, 3),
  duration_ms            integer,
  expert_review_required boolean NOT NULL DEFAULT false,
  tokens_in              integer,
  tokens_out             integer,
  model                  text,
  meta_json              jsonb,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  org_label       text NOT NULL,
  title           text NOT NULL,
  year            integer,
  type            source_type NOT NULL,
  region          text,
  url             text,
  full_text_tsv   tsvector,
  embedding       vector(1536),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE message_sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  source_id       uuid NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  relevance_score numeric(4, 3),
  quoted_offset   integer,
  quoted_length   integer,
  cite_index      integer NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_sources_message_cite_idx UNIQUE (message_id, cite_index)
);

CREATE TABLE message_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  block_type  block_type NOT NULL,
  block_json  jsonb NOT NULL DEFAULT '{}'::jsonb,
  order_index integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX message_blocks_message_order_idx
  ON message_blocks (message_id, order_index);

CREATE TABLE source_sections (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id  uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  anchor     text NOT NULL,
  heading    text,
  text       text NOT NULL,
  embedding  vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_sections_source_anchor_idx UNIQUE (source_id, anchor)
);

CREATE TABLE templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  region      text,
  category    text,
  file_key    text NOT NULL,
  usage_count integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE regulatory_updates (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                  text NOT NULL,
  region                 text NOT NULL,
  severity               text NOT NULL DEFAULT 'info',
  published_at           timestamptz NOT NULL,
  source_url             text,
  affected_product_types text[] NOT NULL DEFAULT '{}',
  impact_analysis_text   text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE expert_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE RESTRICT,
  message_id      uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  requested_by    uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_to     uuid REFERENCES users(id) ON DELETE SET NULL,
  status          expert_review_status NOT NULL DEFAULT 'pending',
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

-- REQ-FND-044 — append-only enforcement lives in 0001_audit_append_only.sql.
CREATE TABLE audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  action          audit_action NOT NULL,
  resource_type   text NOT NULL,
  resource_id     text NOT NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE RESTRICT,
  meta_json       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_at_idx ON audit_logs (created_at);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_id);

-- ---------------------------------------------------------------------------
-- pgvector ivfflat indexes — REQ-FND-040, REQ-FND-044b.
-- `lists = 100` is a reasonable starting point; tune via ANALYZE after seed.
-- ---------------------------------------------------------------------------
CREATE INDEX sources_embedding_ivfflat_idx
  ON sources USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX source_sections_embedding_ivfflat_idx
  ON source_sections USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

COMMIT;
