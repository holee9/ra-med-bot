# 02 · Data Model (PostgreSQL DDL)

## 필수 확장

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- sha256 hash chain
CREATE EXTENSION IF NOT EXISTS vector;      -- pgvector (RAG embeddings)
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- 검색 팔레트 fuzzy match
```

---

## users

```sql
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  initials     TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('viewer','employee','ra-member','ra-lead','admin')),
  dept         TEXT,
  title        TEXT,
  team         TEXT,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','disabled')),
  sso_provider TEXT DEFAULT 'google',
  sso_sub      TEXT UNIQUE,
  last_seen_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX users_role_idx ON users(role);
```

---

## products (BK-033 · ra-llm-wiki 자동 추출)

```sql
CREATE TABLE products (
  id           TEXT PRIMARY KEY,                 -- ex: 'xray-det'
  name         TEXT NOT NULL,
  family       TEXT NOT NULL,
  sub_type     TEXT,
  class_us     TEXT,
  class_eu     TEXT,
  class_kr     TEXT,
  owner_user   UUID REFERENCES users(id),
  source_path  TEXT NOT NULL,                    -- ra-llm-wiki/기술파일/xxx/DHF-v.pdf
  source_kind  TEXT NOT NULL DEFAULT 'auto',     -- 'auto' | 'manual' | 'override'
  standards    JSONB NOT NULL DEFAULT '[]',      -- ['IEC 60601-1', ...]
  predicate    TEXT,
  changes_14d  INT DEFAULT 0,
  extracted_at TIMESTAMPTZ,                      -- 마지막 자동 추출 시각
  overridden_by UUID REFERENCES users(id),       -- Admin override 시
  overridden_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX products_owner_idx ON products(owner_user);

CREATE TABLE product_markets (
  product_id  TEXT REFERENCES products(id) ON DELETE CASCADE,
  market_code TEXT NOT NULL,                     -- 'us'|'eu'|'kr'|'cn'|'jp'
  status      TEXT NOT NULL CHECK (status IN ('approved','in-review','pending','planning','blocked')),
  path        TEXT,                              -- '510(k) K242017 · Product Code MQB'
  since_at    DATE,
  next_event  TEXT,
  PRIMARY KEY (product_id, market_code)
);
```

---

## inbox_tickets

```sql
CREATE TABLE inbox_tickets (
  id            TEXT PRIMARY KEY,                -- 'Q-3406'
  from_user     UUID NOT NULL REFERENCES users(id),
  question      TEXT NOT NULL,
  product_id    TEXT REFERENCES products(id),
  tags          TEXT[],
  triage_state  TEXT NOT NULL CHECK (triage_state IN ('auto','needs-review','escalated','waiting','closed','rejected')),
  auto_answer   TEXT,
  auto_confidence NUMERIC(5,2),
  ra_assignee   UUID REFERENCES users(id),
  escalate_to   TEXT,                            -- 'External counsel' 등
  final_answer  TEXT,
  approved_by   UUID REFERENCES users(id),
  approved_at   TIMESTAMPTZ,
  sla_deadline  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at     TIMESTAMPTZ
);
CREATE INDEX inbox_triage_idx ON inbox_tickets(triage_state, sla_deadline);
CREATE INDEX inbox_from_user_idx ON inbox_tickets(from_user);
```

---

## approved_answers (BK-013 · Hybrid: DB + git snapshot)

```sql
CREATE TABLE approved_answers (
  id           TEXT PRIMARY KEY,                 -- 'K-2026-342'
  category     TEXT NOT NULL,
  question     TEXT NOT NULL,
  answer       TEXT NOT NULL,
  citations    JSONB NOT NULL DEFAULT '[]',
  hits         INT DEFAULT 0,
  state        TEXT NOT NULL DEFAULT 'published' CHECK (state IN ('draft','published','deprecated')),
  from_ticket  TEXT REFERENCES inbox_tickets(id),
  published_by UUID REFERENCES users(id),
  published_at TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX approved_state_idx ON approved_answers(state);
CREATE INDEX approved_ftsearch_idx ON approved_answers USING gin(to_tsvector('simple', question || ' ' || answer));
```

---

## submissions

```sql
CREATE TABLE submissions (
  id           TEXT PRIMARY KEY,                 -- 'SUB-2026-011'
  product_id   TEXT NOT NULL REFERENCES products(id),
  market_code  TEXT NOT NULL,
  type         TEXT NOT NULL,                    -- '510(k)'|'CE MDR TR'|...
  stage        TEXT NOT NULL,
  due_at       DATE,
  owner_user   UUID REFERENCES users(id),
  progress_pct INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## audit_log (§11.10(e) · append-only · hash chain)

```sql
CREATE TABLE audit_log (
  seq          BIGSERIAL PRIMARY KEY,
  ts           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor        TEXT NOT NULL,                    -- user email or 'System' or 'Regula AI'
  actor_user   UUID REFERENCES users(id),
  action       TEXT NOT NULL,                    -- 'inbox.approve' etc
  target       TEXT NOT NULL,
  ip_addr      INET,
  meta         JSONB,
  previous_hash BYTEA NOT NULL,                  -- 이전 행의 hash
  hash         BYTEA NOT NULL                    -- sha256(ts||actor||action||target||prev_hash)
);

-- append-only 강제
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;
CREATE OR REPLACE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE OR REPLACE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;

-- 자동 hash chain (BK-105)
CREATE OR REPLACE FUNCTION audit_log_hash_trigger() RETURNS trigger AS $$
DECLARE prev BYTEA;
BEGIN
  SELECT hash INTO prev FROM audit_log ORDER BY seq DESC LIMIT 1;
  NEW.previous_hash := COALESCE(prev, decode('00','hex'));
  NEW.hash := digest(
    NEW.ts::text || NEW.actor || NEW.action || NEW.target ||
    COALESCE(NEW.meta::text,'') || encode(NEW.previous_hash,'hex'),
    'sha256'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_hash_bi BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_hash_trigger();
```

**월간 검증 크론** (BK-105):
```sql
-- 전수 재계산 후 저장된 hash와 비교
WITH recompute AS (
  SELECT seq, digest(
    ts::text || actor || action || target || COALESCE(meta::text,'') ||
    encode(previous_hash,'hex'),
    'sha256'
  ) AS recalc FROM audit_log
)
SELECT COUNT(*) FILTER (WHERE r.recalc = a.hash) AS ok,
       COUNT(*) FILTER (WHERE r.recalc <> a.hash) AS mismatch
FROM audit_log a JOIN recompute r USING (seq);
```

---

## embeddings (pgvector)

```sql
CREATE TABLE embeddings (
  id           BIGSERIAL PRIMARY KEY,
  source_repo  TEXT NOT NULL CHECK (source_repo IN ('ra-llm-wiki','MD-process','ra-project')),
  source_path  TEXT NOT NULL,
  commit_hash  TEXT NOT NULL,
  chunk_idx    INT NOT NULL,
  chunk_text   TEXT NOT NULL,
  chunk_meta   JSONB,                            -- {product_id, category, regulation_refs}
  embedding    vector(1536) NOT NULL,
  ingested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX embeddings_hnsw ON embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX embeddings_repo_path_idx ON embeddings(source_repo, source_path);
```

**유사 사례 검색 (BK-034)**:
```sql
SELECT chunk_text, source_path, chunk_meta,
       1 - (embedding <=> $1::vector) AS similarity
FROM embeddings
WHERE source_repo = 'ra-llm-wiki'
  AND chunk_meta->>'product_id' = $2       -- 같은 제품
  AND chunk_meta ? 'change_type'           -- 변경 이력이 있는 청크
ORDER BY embedding <=> $1::vector
LIMIT 3;
```

---

## 그 외 테이블

- `radar_items` (regulatory scraping 결과)
- `radar_sources` (스크래퍼 설정 8종)
- `radar_impact` (사내 제품 임팩트 평가)
- `consult_sessions` + `consult_turns` (Power Chat 저장)
- `visual_assets` (Object Storage 메타)
- `personas` (내부 협업용 · Admin/Product Design)
- `usability_meetings` (M-XXX 이력)
- `backlog_items` (BK-XXX 이력)

각 테이블 컬럼 매핑은 `src/v3/data.jsx`의 시드 오브젝트 필드와 1:1 대응.

---

## 데이터 보관 정책 (adminSettings.retention)

| 테이블 | 보관 기간 | 근거 |
|---|---|---|
| `audit_log` | 10년 | 21 CFR Part 11 + MDR Art. 10(8) |
| `inbox_tickets` (closed) | 7년 | ISO 13485 §4.2.5 |
| `approved_answers` | 7년 | 위와 동일 |
| `consult_sessions` | 5년 | RA 개인 리서치 · 명시적 삭제 허용 |
| `embeddings` | 재빌드 가능 | commit_hash 매칭되면 skip |
