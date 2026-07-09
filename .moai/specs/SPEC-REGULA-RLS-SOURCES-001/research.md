# Research — SPEC-REGULA-RLS-SOURCES-001

> Issue [#317](https://github.com/holee9/ra-med-bot/issues/317) — sources/source_sections RLS 활성화 (org-isolation defense-in-depth, M-2)
> Parent SPEC: SPEC-REGULA-RLS-ENFORCE-001 (Issue #239, CLOSED)
> Baseline: main `8a6221f` | Branch: `feat/spec-regula-rls-sources-001-plan`

---

## 1. 검증된 사실 (Orchestrator 직검 + 본 세션 재직검)

모든 사실은 파일:라인 또는 migration 파일로 추적 가능. L-002 (근거 없는 주장 금지) 준수.

### Fact 1 — sources 스키마 (lib/db/schema.ts:789)

```ts
export const sources = pgTable('sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, {
    onDelete: 'cascade',
  }),  // ← NULLABLE (.notNull() 아님)
  orgLabel: text('org_label').notNull(),
  ...
```

- `organization_id` 컬럼이 **직접 존재**. RLS 정책이 직접 참조 가능.
- **NULLABLE (notNull() 아님)** — 스키마 레벨에서는 NULL을 허용하나, 코퍼스는 현재 100% org-scoped이며 NULL row가 없다 (Fact 7 직검). 정책은 strict org-match (fail-closed)로 확정됨.

### Fact 2 — source_sections 스키마 (lib/db/schema.ts:888) ★핵심 장애물

```ts
export const sourceSections = pgTable('source_sections', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceId: uuid('source_id').notNull().references(() => sources.id, {
    onDelete: 'cascade',
  }),  // ← source_id FK만 있음
  anchor: text('anchor').notNull(),
  heading: text('heading'),
  text: text('text').notNull(),
  chunkHash: text('chunk_hash'),
  sectionPath: text('section_path'),
  ingestionRunId: uuid('ingestion_run_id'),
  ingestedAt: timestamp('ingested_at', ...),
  embedding: vector('embedding'),
  createdAt: ...,
  updatedAt: ...,
  supersededBy: uuid('superseded_by'),
  feedbackScore: numeric('feedback_score', ...).notNull().default('0'),
});
```

- **`organization_id` 컬럼이 아예 없음.** Org 연결은 부모 `sources` row를 통해서만 간접적.
- 이것이 RLS 설계의 핵심 분기점. 정책 표현식이 `source_sections.organization_id`를 직접 참조할 수 없음.
- 0000_init.sql:126 원본 DDL에서도 `organization_id` 없이 생성됨 (직검 완료).

### Fact 3 — 현재 DB role = postgres (superuser) ★L-013 정정 사항

migration 0084_force_rls.sql 헤더 주석 (직검):

```sql
-- @MX:WARN 본 migration 만으로는 RLS 가 런타임에 enforce 되지 않는다.
--   이유: (1) superuser 는 항상 RLS 를 bypass (BYPASSRLS); (2) BYPASSRLS 속성을
--   가진 role 도 bypass. 현재 앱 DB role = postgres (superuser) 이므로
--   FORCE 적용 직후에도 모든 쿼리가 정책을 우회한다.
--   실제 enforce 는 migration 0085 로 생성되는 non-superuser role
--   `regula_app` (NOBYPASSRLS) 로 DATABASE_URL 을 전환한 후에야 발생한다.
```

migration 0085_app_role.sql (직검): `regula_app` role을 `NOSUPERUSER NOBYPASSRLS`로 생성. 허나 `.env.local:6`의 `DATABASE_URL`은 여전히 `postgres:test` (superuser).

**결론 (Issue 본문 전제 정정):** sources/source_sections에 RLS를 활성화해도 **현재 런타임 영향은 사실상 0**. Issue #317이 명시한 "회귀 매우 높음(RAG 핵심 경로)" 전제는 부정확 — superuser 연결 하에서는 모든 RLS 정책이 bypass됨. 카나리(AC3)는 `regula_app` 또는 별도 NOBYPASSRLS 테스트 role로만 의미가 있음. 이는 plan-auditor 및 L-013 (정적 테스트 + CI mock DB + self-report 3중 맹점) 핵심 교훈과 정확히 일치.

### Fact 4 — 0084가 sources/source_sections를 누락한 진실 원인 (AC4)

migration 0083 (WITH CHECK) + 0084 (FORCE)는 **동일한 19개 테이블**을 대상 (0084 주석 직검: "대상 19개 테이블은 migration 0083 과 동일"). 이 19개는 모두 0066~0082 migration에서 이미 `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY`가 부여된 테이블:

| migration | 테이블 수 | 테이블 |
|-----------|----------|--------|
| 0015 (docingest) | 3 | organization_documents, document_chunks, document_access_policies |
| 0066 (knowledge_gap) | 1 | unanswered_queue |
| 0067 (classify) | 1 | device_classifications |
| 0068 (traceability) | 3 | evidence_nodes, evidence_edges, stale_flags |
| 0077 (lifecycle) | 4 | prompt_registry, model_pin, change_request, approved_combination |
| 0078 (cyberdevice) | 4 | threat_model, sbom, cve_impact, cyber_evidence_bundle |
| 0080 (corpus_license) | 2 | source_license, entitlement |
| 0082 (rlhf) | 1 | answer_feedback |
| **합계** | **19** | (0015의 4번째 `ingest_jobs`는 0017 §3에서 DROP됨 — 0083 주석 직검) |

**누락 원인:** sources (0000_init:89) + source_sections (0000_init:126)는 0000 migration에서 **RLS policy 없이** 생성됨. RAG-corpus 도메인은 #239 당시 project-wide RLS scope의 별도 파트였음. 0083/0084는 "기존에 ENABLE+policy가 있는 테이블에 WITH CHECK/FORCE를 붙이는" migration이었으므로, **붙일 대상이 없었음**. Issue 본문의 "20개에서 빠졌다"는 표현은 부정확 — 실제는 19개이며(ingest_jobs DROP), sources/source_sections는 애초에 RLS policy 자체가 없어서 0083/0084의 대상 주소록에 존재하지 않았음. 이것은 scope gap이지, 20개 목록의 누락이 아님.

### Fact 5 — sources/source_sections를 touch하는 쿼리 경로 (카나리 표면)

직검 (lib/ grep):

| 파일 | 라인 | 연산 | GUC 상태 | 비고 |
|------|------|------|----------|------|
| lib/inngest/knowledge-sources/orphan-cleanup.ts | 65-67 | SELECT (group by org_id) | **미설정** (system-actor) | `db` singleton — service role로 RLS bypass |
| lib/inngest/knowledge-sources/orphan-cleanup.ts | 82-104 | SELECT/UPDATE sources + source_sections (notExists) | withTenantScope 설정 | per-org 루프 내 |
| lib/ingest/source-sections-upsert.ts | 77 | INSERT source_sections | withTenantScope 설정 | 주석: "No RLS bypass introduced" |
| lib/source-governance/delta-sync-hook.ts | 61,94 | SELECT/UPDATE sources | `dbs` (tenant-scoped) | 주석: "RLS scopes the UPDATE" |
| lib/source-governance/stale-check.ts | 56 | SELECT sources | tenant-scoped | 주석: "RLS enforces row isolation" |
| lib/source-governance/review-notifier.ts | 60-64 | SELECT sources | tenant-scoped (where orgId) | interval 기반 review due |
| lib/rlhf/retrieval-hook.ts | 45-47 | SELECT source_sections (by id) | tenant-scoped (전제) | retrieval re-ranking |
| lib/inngest/docingest/upload-processed.ts | — | ingestion | tenant-scoped | — |

**주의:** `orphan-cleanup.ts:62-67`의 "enumerate-orgs" step은 `db` singleton을 사용해 **모든** org를 조회 (주석 직검: "system-actor query, no RLS scope — db singleton bypasses RLS via the service role"). 이 쿼리는 regula_app 전환 후에도 service role로 실행되어야 정상 동작함 — 본 SPEC은 app route의 RLS만 다루며, system cron의 service-role 경로는 non-goal.

### Fact 6 — 이미 RLS가 활성화된 형제 테이블 (참조 패턴)

knowledge_sources (migration 0099:26-30, 직검) — **본 SPEC의 템플릿**:

```sql
ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_sources FORCE ROW LEVEL SECURITY;
CREATE POLICY knowledge_sources_org_isolated ON knowledge_sources
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
```

추가 참조:
- 0104 (inbox_tickets/approved_answers): `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY ... FOR ALL TO regula_app USING (org_id = ...)` — 단, **FORCE 없음, WITH CHECK 없음**. Issue #239 부채 상태. 본 SPEC은 0099 패턴(ENABLE + FORCE + USING + WITH CHECK)을 따름.
- 0080 (source_license, entitlement): RLS + FORCE (0084에서).
- 0082 (answer_feedback): org-isolation via messages→conversations→org_members join.

### Fact 7 — 코퍼스 데이터 org 분포: 100% org-scoped, NULL 0 rows (직검 확정)

regula-test-db (regula_test) 실DB 직검 결과 (Orchestrator M0 해체):

```sql
-- sources
SELECT organization_id IS NULL AS is_null, count(*) FROM sources GROUP BY 1;
-- is_null=false → 1 row; is_null=true → 0 rows
SELECT DISTINCT organization_id FROM sources;
-- → 00000000-0000-0000-0000-000000000010 (1 org)

-- source_sections
SELECT count(*) FROM source_sections;  -- → 3 rows (모두 위 1 source의 children)

-- RLS 상태 (현재 비활성)
SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('sources','source_sections');
-- → (false, false), (false, false) — 둘 다 미활성
SELECT count(*) FROM pg_policy WHERE polrelid IN ('sources'::regclass, 'source_sections'::regclass);
-- → 0 (기존 policy 없음)
```

**결론:** 코퍼스는 현재 **100% org-scoped, NULL row 0건**. 글로벌 규제 문서(FDA/EU MDR/MFDS/NMPA/PMDA)도 단일 org로 ingestion되어 있음.

### Fact 8 — knowledge_sources.organization_id NOT NULL (아키텍처 일관성)

`lib/db/schema.ts:3274` 직검:

```ts
export const knowledge_sources = pgTable('knowledge_sources', {
  ...
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, {
    onDelete: 'cascade',
  }),  // ← NOT NULL — ingestion 파이프라인은 항상 org-scoped
  ...
```

ingestion 파이프라인(knowledge_sources → sources → source_sections)은 **아키텍처적으로 항상 org-scoped**이다. 글로벌 규제 문서조차 per-org로 ingestion된다. global-corpus 저장 경로(NULL organization_id)는 존재하지 않는다.

### Fact 9 — Charter [지양-1] 재해석 (정정)

[지양-1]은 RAG corpus의 **content**(FDA/EU MDR/MFDS/NMPA/PMDA + 내부 SOP)를 규정한다. **storage nullability가 아니다**. "글로벌 문서 = NULL org, 모든 org 공유"는 오독이었다. 저장 모델은 per-org ingestion(Fact 8). 따라서 NULL `organization_id`는 의도된 상태가 아니라 **bug**이며, strict org-match 정책이 fail-closed로 차단하는 것이 defense-in-depth 정답이다.

### NULL 정책 결정 (DEFINITIVE — Fact 7 + Fact 8 + Fact 9 기반)

**선택: strict org-match (fail-closed)**

```sql
-- sources
USING (organization_id = current_setting('app.current_org_id', true)::uuid)
WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid)

-- source_sections (subquery)
USING (EXISTS (SELECT 1 FROM sources s WHERE s.id = source_sections.source_id
               AND s.organization_id = current_setting('app.current_org_id', true)::uuid))
WITH CHECK (EXISTS (SELECT 1 FROM sources s WHERE s.id = source_sections.source_id
                    AND s.organization_id = current_setting('app.current_org_id', true)::uuid))
```

**근거 (3중):**
1. **real-DB 분포 (Fact 7):** 코퍼스 100% org-scoped, NULL 0 rows — 글로벌 문서 공유를 위해 NULL을 허용할 실익이 없음
2. **아키텍처 (Fact 8):** `knowledge_sources.organization_id` NOT NULL → ingestion은 항상 org-scoped → NULL org_id는 bug
3. **defense-in-depth:** NULL org_id row가 bug로 유입될 경우, strict 정책이 read( invisible) + write(rejected) 양단에서 차단 — 의료기기 RA 도구에서 의도된 fail-closed

**기각된 대안 (NULL 허용 정책):**
- 과거 권장: `organization_id IS NULL OR organization_id = current_setting(...)` (글로벌 문서 모든 org 가시)
- 기각 이유: Fact 7(real-DB NULL 0 rows) + Fact 8(아키텍처 NOT NULL)에 의해 근거 상실. Charter [지양-1]은 content 규정이지 storage nullability 규정이 아님 (Fact 9).

---

## 2. source_sections RLS 정책 설계 — Option A vs Option B (핵심 설계 결정)

source_sections에는 `organization_id` 컬럼이 없으므로 (Fact 2), 두 가지 설계가 가능:

### Option A — subquery/JOIN 정책 (스키마 변경 없음) ★권장

```sql
CREATE POLICY source_sections_org_isolated ON source_sections
  FOR ALL
  TO regula_app
  USING (
    EXISTS (
      SELECT 1 FROM sources s
      WHERE s.id = source_sections.source_id
        AND s.organization_id = current_setting('app.current_org_id', true)::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sources s
      WHERE s.id = source_sections.source_id
        AND s.organization_id = current_setting('app.current_org_id', true)::uuid
    )
  );
```

**USING** (기존 row 읽기): 부모 source가 현재 org 소유인 section만 접근 허용 (strict org-match — `IS NULL OR` disjunction 없음, Fact 7/8/9 기반).
**WITH CHECK** (새 row 쓰기): 부모 source가 반드시 현재 org 소속여야 함 (NULL-org source에 section insert는 항상 차단 — ingestion은 항상 org-scoped).

**장점:**
1. 스키마 변경 없음 — migration 1건 (ENABLE + FORCE + CREATE POLICY)
2. 백업(backfill) 불필요 — 기존 모든 row에 즉시 적용
3. `sources.organization_id`가 단일 진실 원천(single source of truth) — Option B의 동기화 불변성(sync invariant) 부재
4. Charter [지양-5] + Enforce Simplicity 원칙 부합 — 최소 변경
5. subquery는 `sources.id` PK 인덱스上进行 — Postgres planner 비용 미미

**단점:**
1. row 평가마다 subquery 실행 — hot retrieval 경로(rlhf/retrieval-hook.ts)에서 비용 우려
2. 단, retrieval 쿼리는 `WHERE id IN (...)` (특정 chunk ID 조회)이며, `source_sections.id`는 PK이고 `source_id`에 UNIQUE(source_id, anchor) 인덱스가 있어 planner 최적화 유리

### Option B — denormalized organization_id 컬럼 추가

```sql
-- migration 1: ALTER TABLE source_sections ADD COLUMN organization_id uuid;
-- backfill: UPDATE source_sections ss SET organization_id = s.organization_id
--           FROM sources s WHERE ss.source_id = s.id;
-- migration 2: CREATE POLICY ... USING (organization_id = current_setting(...)) WITH CHECK (...)
```

더불어 lib/ingest/source-sections-upsert.ts의 INSERT 경로와 schema.ts에 `organizationId` 컬럼을 추가해야 함.

**장점:**
1. 정책 표현식 단순 (subquery 없음)
2. row 평가 비용 최저

**단점:**
1. schema.ts + migration + backfill + write path 수정 = 3+ 파일 변경 (Rule 2 분해 필요)
2. **새로운 동기화 불변성**: 모든 INSERT/UPDATE 경로가 organization_id를 올바르 설정해야 함. 누락 시 RLS가 row를 차단 = silent data loss
3. `sources.organization_id`가 변경될 때 (org 이전 등) source_sections도 갱신해야 함 — 현재 그런 워크플로우 없음
4. 기존 row backfill 중 source가 이미 삭제된 고아 section 존재 시 (FK cascade가 잡아야 하지만) 위험

### 결정: Option A (subquery 정책)

**근거:**
1. **Enforce Simplicity** — staff engineer라면 "왜 그냥 subquery 안 써?"라고 물음. Option B는 현재 superuser 하에서 런타임 이점이 0인 추가 불변성을 도입
2. **동기화 불변성 회피** — Option B의 가장 큰 위험은 silent data loss. source_sections는 RAG 핵심 데이터이며, 동기화 버그는 검색 품질 저하로 직결
3. **측정 우선 (L-007)** — subquery 비용 우려는 가정. M3 카나리에서 `EXPLAIN ANALYZE`로 실측 후, 문제가 입증되면 Option B로 additive migration (non-breaking) 가능
4. **Charter 정합성** — [지양-5] "SaaS 외판 ❌" 정신: 내부 6~8명용 설계에서 과도한 스키마 정규화 회피
5. **source_sections UNIQUE(source_id, anchor)** + `source_id` FK가 구조적으로 부모를 보장 — subquery는 항상 1 row 매칭

**Option B fallback 조건 (M3에서 입증 시):**
- `EXPLAIN ANALYZE`에서 subquery 정책이 hot path에 sequential scan 유발
- retrieval P95 지연이 50ms 이상 악화
- 이 경우 Option B로 additive migration (기존 정책 DROP + 새 컬럼 + 새 정책) — non-breaking

---

## 3. regula_app role 전환 의존성

본 SPEC의 RLS 정책은 **활성화 즉시 런타임에 동작하지 않음** (Fact 3). 실제 enforce는 ops가 `DATABASE_URL`을 `regula_app`으로 전환한 후에 발생:

```
0084 (FORCE) → 0085 (regula_app role 생성) → [본 SPEC] sources/source_sections ENABLE+FORCE+policy
  → ops가 DATABASE_URL을 postgres → regula_app으로 전환 → 런타임 enforce
```

**본 SPEC의 산출물은 위 체인의 세 번째 고리.** ops 전환은 본 SPEC scope 외부 (non-goal). 단, 카나리(AC3)는 이 사실을 반영하여 NOBYPASSRLS 테스트 role로 수행해야 함 — 그렇지 않으면 false-green.

---

## 4. 보안 근거 (Security Rationale)

### defense-in-depth, NOT current vulnerability

Charter [지양-2~4] 및 21 CFR Part 11 §11.10(c) 감사 추적성 요구사항에 근거:

1. **현재 상태**: app-level WHERE filters (`withTenantScope`, Fact 5)가 org-isolation을 이미 시행 중. RLS는 백업 계층(backstop layer).
2. **RLS의 가치**: superuser 권한 버그, privilege escalation, raw SQL 실행 시에도 org-scope 유지 → 규제 위반 방지
3. **21 CFR Part 11 §11.10(c)**: 감사 추적성과 tenant isolation의 이중 안전망. 의료기기 RA 도구에서 org 간 데이터 누출은 규제 위반
4. **비-goal 명시**: 다른 테이블의 RLS 수정 안 함, RAG pipeline 재구조화 안 함, 무관 정책에 WITH CHECK 추가 안 함

### M-2 (Milestone 2) 의미

Parent #239 (M-1)가 project-wide RLS의 토대(정책 형상 + role 생성)를 완료. 본 SPEC은 #239가 누락한 sources/source_sections (RAG 핵심 도메인)를 메우는 후속 작업 = M-2.

---

## 5. 직검 로그 (L-007/L-013 준수)

| 항목 | 방법 | 결과 |
|------|------|------|
| sources schema | schema.ts:789 + 0000_init.sql:89 | organization_id nullable 확인 |
| source_sections schema | schema.ts:888 + 0000_init.sql:126 | organization_id 컬럼 없음 확인 |
| 0084 대상 테이블 수 | migrations/0084_force_rls.sql 직독 | 19개 (ingest_jobs DROP 반영) |
| regula_app role | migrations/0085_app_role.sql 직독 | NOSUPERUSER NOBYPASSRLS |
| knowledge_sources 패턴 | migrations/0099_knowledge_sources.sql 직독 | ENABLE+FORCE+policy 템플릿 |
| 쿼리 경로 | lib/ grep (8 파일) | tenant-scoped vs system-actor 구분 |
| DATABASE_URL | .env.local:6 | postgres:test (superuser) — 런타임 RLS inert |
| 다음 migration 번호 | migrations/ ls | 0113이 최신 → 본 SPEC은 0114 사용 |
| regula-test-db 접속 | Orchestrator 직검 (drizzle/docker 경유) | Fact 7 해결: NULL 0 rows, 1 org |
| sources NULL 분포 (Fact 7) | regula-test-db 실DB 직검 | NULL 0 rows, distinct org 1개, source_sections 3 rows (부모 1 source) |
| RLS 현재 상태 | pg_class 직검 | sources/source_sections 모두 relrowsecurity=f, relforcerowsecurity=f (미활성 확인) |
| 기존 policy 수 | pg_policy 직검 | sources/source_sections 모두 0건 (policy 없음 확인) |
| knowledge_sources NOT NULL | lib/db/schema.ts:3274 | organizationId.notNull() → ingestion 항상 org-scoped (Fact 8) |

### Fact 7 분포 직검 — RESOLVED (Orchestrator M0 해체)

Orchestrator가 regula-test-db (regula_test) 실DB 직검으로 Fact 7을 해결함. 결과: 코퍼스는 100% org-scoped, NULL row 0건 (Fact 7 본문 참조). 이에 따라 NULL 정책은 **strict org-match (fail-closed)**로 확정 — Fact 8 (knowledge_sources NOT NULL) + Fact 9 (Charter [지양-1] 재해석)와 함께 3중 근거. 과거 "NULL 허용 권장"은 기각된 대안으로 명시 (위 "NULL 정책 결정" 본문 참조).

---

## 6. Open Questions (Run Phase / Orchestrator 결정 필요)

1. **~~코퍼스 org 분포 (Fact 7)~~ — RESOLVED**: Orchestrator real-DB 직검 완료. NULL-org source 0건, 코퍼스 100% org-scoped (Fact 7). 정책은 **strict org-match (fail-closed)**로 확정 — Fact 8 (knowledge_sources NOT NULL) + Fact 9 (Charter [지양-1] content vs storage 재해석) 기반. run phase M0는 이제 "정책 결정"이 아니라 "migration 전 no-NULL-row 데이터 무결성 가드"로 reframe됨 (plan.md M0).
2. **카나리 role 운용 방식**: `regula_app` role을 카나리에 직접 사용할 것인가, 아니면 별도 `rls_canary` role을 migration에 생성할 것인가? (0085가 이미 regula_app을 만들었으므로, 카나리는 `SET ROLE regula_app` 패턴이 단순 — 별도 role 추가 불필요 권장)
3. **ops 전환 일정**: `DATABASE_URL`을 `regula_app`으로 전환하는 ops 작업의 타임라인. 본 SPEC과 독립적이나, RLS가 실제 enforce되는 시점을 결정.

---

## 7. 참조

- Parent SPEC: `.moai/specs/SPEC-REGULA-RLS-ENFORCE-001/tasks.md` (Issue #239)
- Issue: [#317](https://github.com/holee9/ra-med-bot/issues/317)
- Migration 템플릿: migrations/0099_knowledge_sources.sql
- RLS inert 경고: migrations/0084_force_rls.sql @MX:WARN
- GUC 메커니즘: lib/db/client.ts:54-69 (`withTenantScope`)
- Charter: `.moai/specs/CHARTER.md` (지양-1~5)
- Lessons: L-007 (직검), L-010 (migration 실DB 테스트), L-013 (3중 맹점), L-015 (ci:* 전 단계 로컬 직검)
