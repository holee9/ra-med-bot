---
spec_id: SPEC-REGULA-KNOWLEDGE-PROMO-001
issue: 50
version: 1.0.0
status: draft
phase: plan
created: 2026-06-26
author: manager-strategy
base_branch: feat/issue-50-knowledge-promo
base_commit: 93e9263
---

# tasks.md — SPEC-REGULA-KNOWLEDGE-PROMO-001

## §1 Baseline (직검 카운트 — L-007)

소스 코드와 런타임 assertion 테스트를 직저 읽어 확인한 카운트. 프롬프트에 적힌 숫자는 신뢰하지 않음.

| 항목 | 값 | 근거 (직검) |
|------|----|-------------|
| 마이그레이션 수 | **86 files** (`0085_app_role.sql` 이 최신) | `ls migrations/*.sql \| wc -l` → 86. 다음 신규 = **`0086_knowledge_promo.sql`** |
| `PermissionAction` union members | **71** | `grep -cE "^\s+\| '[a-z]+'" lib/auth/permissions.ts` → 71 |
| `PERMISSIONS` matrix entries | **71** (union과 1:1) | `tests/unit/auth/permissions.test.ts:84`: `toHaveLength(71)`. `tests/regression/foundation.test.ts:42`: `.toBe(71)` |
| `audit_action` pgEnum values | **195** | `pgEnum('audit_action', [...])` in `lib/db/schema.ts:117`. Last entries: `feedback_submitted`, `reranking_proposed`, `reranking_rolled_back` |
| `auditActionEnum.enumValues` assertion | `>= 25` | `tests/regression/foundation.test.ts:56`: `toBeGreaterThanOrEqual(25)` (하한선만 — 새 값 추가해도 자동 통과) |
| 회귀 regression (참고용) | 4345 passed (프롬프트 기준, 미직검) | full `pnpm test` 실행 전까진 비확정 |
| `messages.embedding` column | **존재하지 않음** | `lib/db/schema.ts:599-625` messages 테이블에 embedding 컬럼 없음. 임베딩은 `sources.embedding`/`source_sections.embedding` 에만 존재 |
| `promoted_answers` table | **미존재** | `grep -rn "promoted_answers" lib/ migrations/` → 결과 없음 (그린필드) |

### Count-assertion 테스트 갱신 대상 (이 PR에서 수정 필요)

| 파일 | 현재값 | 신규값 | 이유 |
|------|--------|--------|------|
| `tests/unit/auth/permissions.test.ts:84` | `toHaveLength(71)` | `toHaveLength(73)` (+2) | `knowledgepromo.promote` + `knowledgepromo.view` 추가 |
| `tests/unit/auth/permissions.test.ts` (EXPECTED_ACTIONS 배열) | ... 마지막 `'rlhf.feedback'` | +2 엔트리 | 동일 |
| `tests/regression/foundation.test.ts:42` | `.toBe(71)` | `.toBe(73)` | 동일 |
| `tests/regression/foundation.test.ts:56` | `>= 25` | 변경 불필요 | 하한선만 — 195 → 197로 자동 통과 |
| `tests/unit/enterprise-migrations.test.ts` | 마지막 `describe('Migration 0085...')` | +1 describe block (0086) | 패턴 일관성 (선택이나 권장) |

---

## §2 Implementation Phases

### Phase 0 — DB 스키마 & 마이그레이션 0086 (Priority High)

**목적**: `promoted_answers` 테이블 + 신규 enum 2개 + audit_action +2 + RLS.

**태스크**:
- **T0.1** `migrations/0086_knowledge_promo.sql` 작성 — RLHF 0082 패턴 준용:
  - `CREATE TYPE promoted_answer_status AS ENUM ('active', 'unpromoted')` (REQ-006, REQ-014)
  - `CREATE TABLE promoted_answers`: `id uuid PK`, `org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`, `source_message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE`, `title text NOT NULL`, `tags text[] NOT NULL DEFAULT '{}'`, `promoted_by text NOT NULL REFERENCES users(id)`, `promoted_at timestamptz NOT NULL DEFAULT now()`, `status promoted_answer_status NOT NULL DEFAULT 'active'`, `embedding vector(1536)` (설계 결정 #1 참조), `UNIQUE(source_message_id)` (동일 메시지 중복 승격 방지)
  - `CREATE INDEX idx_promoted_answers_org_active ON promoted_answers(org_id, status)`
  - `CREATE INDEX idx_promoted_answers_tags ON promoted_answers USING GIN(tags)` (REQ-015)
  - pgvector cosine: `CREATE INDEX idx_promoted_answers_embedding ON promoted_answers USING ivfflat (embedding vector_cosine_ops)` WITH `(lists = 100)` — `vector(1536)` 차원은 `sources.embedding`과 일치 (`lib/db/schema.ts:19`)
  - RLS: `ALTER TABLE promoted_answers ENABLE ROW LEVEL SECURITY; FORCE ROW LEVEL SECURITY;` + `USING` clause via `messages -> conversations -> projects -> org_members` join (0082_rlhf.sql §3 패턴 그대로 — messages에 org_id 직접 컬럼 없음)
  - `ALTER TYPE audit_action ADD VALUE 'answer_promoted';`
  - `ALTER TYPE audit_action ADD VALUE 'answer_unpromoted';`
- **T0.2** `lib/db/schema.ts` — `promotedAnswers` pgTable 정의 (RLHF `answerFeedback` 블록 바로 아래, `lib/db/schema.ts:770` 인근). `statusEnum = pgEnum('promoted_answer_status', ['active', 'unpromoted'])`. `@MX:NOTE [AUTO]` + `@MX:SPEC` 태그. 기존 `auditActionEnum` 배열 끝에 `'answer_promoted'`, `'answer_unpromoted'` 추가 (`lib/db/schema.ts:117`의 pgEnum 배열).
- **T0.3** `lib/auth/permissions.ts` — `PermissionAction` union에 `| 'knowledgepromo.promote' | 'knowledgepromo.view'` 추가 (최하단 RLHF 인근). `PERMISSIONS` matrix에:
  - `'knowledgepromo.promote': { minRole: 'ra-lead', scope: 'org', resourceType: 'promotedAnswer' }` (REQ-007)
  - `'knowledgepromo.view': { minRole: 'ra-member', scope: 'org', resourceType: 'promotedAnswer' }` (REQ-008)

### Phase 1 — lib/knowledge-promo 비즈니스 로직 (Priority High)

**목적**: 승격/취소 로직 + 시맨틱 검색. RBAC는 `withPermission`으로, 트랜잭션은 `db.transaction`으로 wrap (21 CFR Part 11 atomicity — L-007 audit defect class).

**태스크**:
- **T1.1** `lib/knowledge-promo/promote.ts` — `promoteAnswer({messageId, title, tags, userId, orgId})` / `unpromoteAnswer({promotedId, userId, orgId})`:
  - `withPermission('knowledgepromo.promote', {userId, orgId})` 선제 호출 (REQ-007 위반 시 403 + `writeAudit({action: 'answer_promote_denied', ...})` — 단 audit_action enum에 추가 불필요, `audit_action`은 표준 2개만 추가). 거부 로깅은 `metaJson`에 별도 기록 또는 기존 `rbac.denied` 재활용 검토.
  - `db.transaction` 내: INSERT promoted_answers + `writeAudit({action: 'answer_promoted', userId, resourceType: 'promotedAnswer', resourceId, metaJson: {sourceMessageId, title}})` (REQ-013). `writeAudit`은 `lib/audit.ts:439` 시그니처 사용.
  - unpromote: `UPDATE promoted_answers SET status='unpromoted'` + `writeAudit({action: 'answer_unpromoted'})` (REQ-014). RAG 제외는 status='unpromoted' 필터로 자동 처리 (Phase 3 retriever where절).
  - Embedding 계산: 승격 시점에 `messages.contentProse` → OpenAI embedding API → `promoted_answers.embedding` 저장 (설계 결정 #1).
- **T1.2** `lib/knowledge-promo/semantic-search.ts` — 두 모드:
  - `searchOrgConversations({orgId, query, mode: 'fulltext'|'semantic'})`: org-scoped messages 검색. `withTenantScope(orgId, ...)` (`lib/db/client.ts:54`)로 GUC wiring (#239 RLS 준수).
  - fulltext: `messages.content_prose`에 tsvector index 필요 — **마이그레이션 0086에 `ALTER TABLE messages ADD COLUMN content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content_prose)) STORED; CREATE INDEX idx_messages_tsv ON messages USING GIN(content_tsv);` 추가** (요구사항에 명시 없으나 REQ-001 fulltext 성능 보장 위해 필요).
  - semantic: pgvector cosine `<=>` on `promoted_answers.embedding` (활성 승격 답변만). 메시지 자체는 임베딩이 없으므로 semantic 검색은 promoted_answers에 한정. 일반 대화 semantic 검색은 Phase 5 후속으로 분리 (설계 결정 #2).

### Phase 2 — API 라우트 (Priority High)

**태스크**:
- **T2.1** `app/api/knowledge-promo/search/route.ts` — `GET ?q=&mode=`. `withPermission('knowledgepromo.view')` 또는 `knowledgegap.view` 재활용 (모든 ra-member 조회 허용, REQ-003/008). 응답: org 범위 메시지/승격답변 목록.
- **T2.2** `app/api/knowledge-promo/promote/route.ts` — `POST` (승격) / `DELETE ?id=` (취소). `withPermission('knowledgepromo.promote')`. T1.1 호출.
- **T2.3** `app/api/knowledge-promo/library/route.ts` — `GET` 승격 답변 목록 + tag 필터 (REQ-012, REQ-015). `status='active'`만 반환.

### Phase 3 — RAG Retriever 통합 (Priority High)

**태스크**:
- **T3.1** `lib/ai/retrievers/promoted-answers.ts` — `IRetriever` (`lib/ai/retrievers/types.ts`) 구현. 내부 문서보다 높은 가중치 (REQ-009/010). corpus name = `'org_promoted'` (ORG_CORPUS_PREFIX `'org_'`로 자동 분류, `lib/ai/merge.ts:33`). pgvector cosine on `promoted_answers.embedding` WHERE `status='active'` AND `org_id = :orgId`.
- **T3.2** `lib/ai/merge.ts` `RETRIEVER_REGISTRY`에 `'org_promoted': () => new PromotedAnswersRetriever()` 등록 (`merge.ts:27`). 결과에 `corpusType='org'` 자동 부여.
- **T3.3** 가중치 boost: 두 안중 **안A (권장)** — retriever 자체에서 `score * BOOST_FACTOR(1.5~2.0)` 적용. RLHF `applyRlhfReranking` (`lib/rlhf/retrieval-hook.ts`)는 post-rerank 별도 단계이므로 promotedAnswers boost는 retriever 단계에서 적용 후 RLHF rerank로 자연스럽게 전달. 이렇게 하면 `merge.ts` 호출부 변경 최소화 (설계 결정 #3).

### Phase 4 — UI (Priority Medium)

**태스크**:
- **T4.1** `components/answer-block/promote-button.tsx` — 메시지/대화 단위 승격 버튼 (REQ-004/005). 역할 기반 렌더링: `ra-lead`/`admin`만 버튼 표시. 이미 승격된 메시지는 "승격됨" + 취소 버튼.
- **T4.2** `app/(app)/library/page.tsx` 확장 — 기존 personal bookmarks 위에 "팀 지식" 탭 추가 (REQ-012). `/api/knowledge-promo/library` 호출. title/tags 필터링.
- **T4.3** Citation 표시 — promoted answer가 citation으로 사용될 때 sourceMessageId로 원본 메시지 역추적 링크 (REQ-011). `lib/ai/retrievers/types.ts:RetrievalResult.metadata`에 `sourceMessageId` 포함.

### Phase 5 — 테스트 (Priority High)

**태스크**:
- **T5.1** `tests/unit/knowledge-promo/promote.test.ts` — RBAC (ra-member 거부, ra-lead/admin 허용), audit 기록, idempotency, unpromote.
- **T5.2** `tests/unit/knowledge-promo/semantic-search.test.ts` — org 격리 (타 org 대화 미노출, AC-01), fulltext/semantic 모드.
- **T5.3** `tests/unit/ai/promoted-answers-retriever.test.ts` — 가중치 boost > 내부 문서 (AC-04), unpromote 시 제외 (AC-08).
- **T5.4** `tests/integration/knowledge-promo-rag.test.ts` — RAG end-to-end: promoted 답변이 citation에 포함되고 sourceMessageId 역추적 (AC-05).
- **T5.5** 카운트 assertion 테스트 갱신 (§1 표 참조) — `permissions.test.ts`, `foundation.test.ts`, `enterprise-migrations.test.ts`(0086 describe 추가).

---

## §3 파일 목록 (spec §4.1 매핑)

| 파일 | Phase | 신규/수정 |
|------|-------|----------|
| `migrations/0086_knowledge_promo.sql` | P0 | 신규 |
| `lib/db/schema.ts` | P0 | 수정 (promotedAnswers 테이블 + audit enum +2) |
| `lib/auth/permissions.ts` | P0 | 수정 (+2 권한) |
| `lib/knowledge-promo/promote.ts` | P1 | 신규 |
| `lib/knowledge-promo/semantic-search.ts` | P1 | 신규 |
| `app/api/knowledge-promo/search/route.ts` | P2 | 신규 |
| `app/api/knowledge-promo/promote/route.ts` | P2 | 신규 |
| `app/api/knowledge-promo/library/route.ts` | P2 | 신규 |
| `lib/ai/retrievers/promoted-answers.ts` | P3 | 신규 |
| `lib/ai/merge.ts` | P3 | 수정 (registry 1줄 추가) |
| `components/answer-block/promote-button.tsx` | P4 | 신규 |
| `app/(app)/library/page.tsx` | P4 | 수정 (탭 추가) |
| `tests/unit/knowledge-promo/*.test.ts` | P5 | 신규 |
| `tests/unit/ai/promoted-answers-retriever.test.ts` | P5 | 신규 |
| `tests/unit/auth/permissions.test.ts` | P5 | 수정 (71→73) |
| `tests/regression/foundation.test.ts` | P5 | 수정 (71→73) |
| `tests/unit/enterprise-migrations.test.ts` | P5 | 수정 (+0086 describe) |

---

## §4 카운트 Delta 예측

| 리소스 | 현황 | Delta | 신규 총계 | 비고 |
|--------|------|-------|----------|------|
| 마이그레이션 | 86 | +1 | **87** | `0086_knowledge_promo.sql` |
| `PermissionAction` union | 71 | +2 | **73** | `knowledgepromo.promote`, `knowledgepromo.view` |
| `PERMISSIONS` matrix | 71 | +2 | **73** | 동일 |
| `audit_action` pgEnum | 195 | +2 | **197** | `answer_promoted`, `answer_unpromoted` |
| pgEnum (전체) | 11 | +1 | **12** | `promoted_answer_status` |
| 회귀 regression | 4345 (참고) | +N 신규 테스트 | 4345+N | 정확값은 실행 전 확인 |

---

## §5 AC → REQ/Test 매핑

| AC | REQ | 테스트 | Phase |
|----|-----|--------|-------|
| AC-01 org 검색 격리 | 001/002/003 | T5.2 semantic-search.test.ts | P1/P5 |
| AC-02 승격 레코드 생성 | 004/005/006 | T5.1 promote.test.ts (happy path) | P1/P5 |
| AC-03 RBAC 거부 + audit | 007 | T5.1 promote.test.ts (ra-member 거부) | P1/P5 |
| AC-04 RAG 가중치 우선 | 009/010 | T5.3 retriever.test.ts (boost > 내부 문서) | P3/P5 |
| AC-05 citation 역추적 | 011 | T5.4 integration (sourceMessageId) | P3/P5 |
| AC-06 라이브러리 열람 | 008/012 | 수동 Review + T5.2 | P4 |
| AC-07 audit 기록 | 013/014 | T5.1 promote.test.ts (audit row 검증) | P1/P5 |
| AC-08 unpromote RAG 제외 | 014 | T5.3 retriever.test.ts (status='unpromoted' 미검색) | P3/P5 |

---

## §6 Charter Guards (지양 항목)

**[지양-2] Citation 강제**: promoted answer가 citation으로 사용될 때 반드시 `sourceMessageId`로 원본 메시지 역추적 가능해야 함 (REQ-011, AC-05). Expert Review Gate는 기존 `lib/ai/expert-review-gating.ts` 경유로 보존 — promoted 답변이라고 expert review를 skip하지 않음. citation은 `lib/ai/citation-enforce.ts` 기존 강제 로직 그대로 적용.

**[지양-4] 자동화 금지**: promote는 ra-lead/admin 명시적 RBAC (`knowledgepromo.promote`) 필요. 자동 finalize/자동 승격 절대 금지. RLHF 고득점 후보 제안(`lib/rlhf/gap-promo-bridge.ts:103`에 이미 descriptor-only로 존재)은 "제안"일 뿐, 사용자 명시적 클릭 없이 promote API 호출 불가.

**21 CFR Part 11**: 모든 promote/unpromote 행위는 `db.transaction` 내에서 `writeAudit` 호출로 원자적 기록. audit 실패 시 promote 자체 rollback.

---

## §7 설계 결정 & 근거

### #1 promoted_answers.embedding — 신규 컬럼 (채택)

**결정**: `promoted_answers`에 별도 `embedding vector(1536)` 컬럼 신설. `messages.embedding` 조인 재사용 안 함.

**근거**:
1. `messages` 테이블에 embedding 컬럼 자체가 없음 (`lib/db/schema.ts:599-625` 직검 확인). 조인 재사용 불가.
2. unpromote 시 RAG에서 즉시 제외 (REQ-008/014) — `WHERE status='active'` 한 번에 처리. messages 조인 시 별도 flag 관리 필요.
3. 승격 시점 content가 변할 수 있음 (title/tags는 메타데이터). promoted snapshot의 임베딩이 검색 품질에 유리.
4. 차원 `vector(1536)`은 `sources.embedding`과 일치 — 기존 ivfflat 패턴 재사용.

### #2 일반 대화 semantic 검색 — Phase 5 후속으로 분리 (채택)

**결정**: 본 SPEC의 semantic 검색(REQ-002)은 `promoted_answers.embedding`으로 한정. 전체 대화 semantic은 후속 이슈.

**근거**:
1. `messages`에 embedding이 없어 전체 대화 semantic은 messages 전체에 embedding backfill 마이그레이션 필요 (대형 작업).
2. 본 SPEC의 핵심 가치는 "우수 답변 승격 → 사내 판례 RAG"이므로 promoted_answers semantic이 우선.
3. 전체 대화 fulltext(REQ-001)는 T1.2 tsvector로 즉시 제공. semantic(REQ-002)은 promoted 영역만 즉시 제공, 전체 대화는 "partial coverage"로 문서화.

→ **문서화 필수**: PR 본문과 tasks.md에 본 분리를 명시. 후속 이슈로 "전체 대화 semantic embedding backfill" 등록 권장.

### #3 RAG 가중치 boost — Retriever 단계 적용 (채택, 안A)

**결정**: `PromotedAnswersRetriever.score *= BOOST_FACTOR`를 retriever 내부에서 적용. `merge.ts` 변경 최소화.

**근거**:
1. corpus-license #72의 per-corpus retriever 패턴과 일관됨.
2. RLHF `applyRlhfReranking`은 별도 post-rerank 단계 (`lib/rlhf/retrieval-hook.ts`) — 이 단계를 다시 침범하지 않아도 retriever 점수가 자연스럽게 rerank로 전달됨.
3. BOOST_FACTOR 상수값(1.5~2.0)은 retriever 테스트(T5.3)에서 조정 가능.

### 해결된 모호성

- **audit_action 거부 로깅**: REQ-007 위반 시 audit에 남길지 모호 → 기존 `audit_action` 표준 2개(`answer_promoted`/`answer_unpromoted`)만 추가하고, 거부는 HTTP 403 + 로그로 처리. audit_action enum 무한 확장 방지 (Charter 단순성).
- **동일 메시지 중복 승격**: `UNIQUE(source_message_id)` 제약으로 방지. 재승격 시 기존 레코드 `status='active'`로 UPDATE (audit 1건 추가).
- **tag 타입**: spec은 "tags(array)"로 모호. `text[]` 채택 (GIN index 호환, REQ-015 필터링 성능). 별도 enum 불필요 (Charter [지양-3] 오버엔지니어링 회피).

---

## §8 리스크 & 복잡도 노트

| 리스크 | 영향 | 완화 |
|--------|------|------|
| pgvector ivfflat `lists=100` 튜닝 — 데이터 적을 때 오히려 성능 저하 | 중 | 초기엔 `lists=10` 또는 sequential scan + 향후 데이터 증가 시 인덱스 튜닝 이슈 분리. 마이그레이션에 주석 명시. |
| `messages.content_tsv` tsvector 컬럼 추가가 기존 쿼리에 영향 | 저 | GENERATED COLUMN이므로 기존 SELECT에 영향 없음. INSERT/UPDATE 시 자동 계산 비용 미미. |
| RLS join 경로 복잡 (`promoted_answers → messages → conversations → projects → org_members`) | 중 | 0082_rlhf.sql §3 RLS 패턴 그대로 복사. 통합 테스트에서 cross-org 격리 검증 필수 (AC-01). |
| 회귀 regression 4345 — 새 카운트 assertion 갱신 누락 시 전체 빌드 실패 | 높 | P0 완료 직후 `pnpm test tests/unit/auth/permissions.test.ts tests/regression/foundation.test.ts` 즉시 실행 (L-009). |
| 기존 회귀에서 `promoted_answers` 스키마 의존성 | 저 | 그린필드 테이블이므로 기존 테스트 영향 없음. |

---

## §9 검증 체크리스트 (Run Phase 종료 전)

- [ ] `pnpm test` full 실행 — 4345+N passed, 0 failed (L-009)
- [ ] `pnpm lint` (lint:hex) — 0 errors (L-008)
- [ ] staged 파일 범위 직검 — migrations/0086 포함 확인 (L-009)
- [ ] 카운트 assertion 3곳 갱신 확인 (permissions.test, foundation.test, enterprise-migrations.test)
- [ ] AC-01~08 모두 해당 테스트 매핑 존재
- [ ] RBAC 음성 케이스 (ra-member promote 거부) 테스트 포함
- [ ] citation 역추적 통합 테스트 (sourceMessageId) 포함
- [ ] RLS cross-org 격리 통합 테스트 포함
- [ ] PR 본문에 설계 결정 #2 (전체 대화 semantic 분리) 문서화
