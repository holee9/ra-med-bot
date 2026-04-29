---
id: SPEC-REGULA-FOUNDATION-001
doc_type: research
created: 2026-04-22
updated: 2026-04-22
spec_version: 0.2.0
author: manager-spec
---

# Research — SPEC-REGULA-FOUNDATION-001

본 문서는 `spec.md`의 EARS 요구사항과 기술 결정의 **근거 기록**이다. Phase 2 이후 설계 검토와 컴플라이언스 감사에서 참조된다.

**v0.2.0 업데이트 (2026-04-22):** plan-auditor의 iteration 1 감사(`audit-001.md`) 결과 23개 findings(Critical 5 / High 8 / Medium 7 / Low 3) 반영. 주요 변경:
- LLM Orchestration(LangChain.js) 결정을 Phase 2 기록으로 이동 (AUD-013)
- `source_sections` 테이블 복구 (AUD-001)
- `--font-serif` 스택 순서 교정 (AUD-002)
- audit_logs 변경 차단 범위 확장: UPDATE/DELETE/TRUNCATE + `app_role` 권한 REVOKE + migrations role 분리 (AUD-003)
- `tailwind.config.ts` 산출물 복구 (AUD-004)
- DB 컬럼 제약(nullable/default/FK onDelete) 결정론 명시 (AUD-005)
- `lib/env.ts` zod fail-fast 검증 도입 (AUD-010)

상세 반영 내역은 `audit-001-response.md` 참조.

---

## 조사 배경

Regula는 의료기기 RA 전문가용 RAG 챗봇으로, 제품 특성상 **후행 보강이 극히 어려운 규제 준수 제약**이 다수 존재한다. 구체적으로:

1. **`audit_logs` append-only 속성**: 일반 테이블로 먼저 생성하면 이후 Postgres 트리거로 mutation 차단 전환 시 기존 row의 감사 무결성 입증이 어렵다. Day 1부터 `BEFORE UPDATE OR DELETE` 트리거로 원천 봉쇄해야 한다.
2. **`message_sources.cite_index` 컬럼**: Phase 2에서 citation 후처리 로직을 도입할 때 schema migration이 아닌 **런타임 로직만으로도** 동작 가능하려면 스키마 컬럼이 선행 확보되어야 한다.
3. **Noto Serif KR + Pretendard 폰트 우선순위**: 한국어 우선 사용자 대상이므로 폰트 로딩 순서가 초기 LCP에 직접 영향. Phase 1에서 `next/font/google` 설정과 preload 순서를 확정해야 Phase 2 성능 회귀를 방지.
4. **`noindex` 전역 정책**: `app/(app)/layout.tsx` metadata에서 기본값으로 선언하지 않으면 개별 페이지가 실수로 크롤러에 노출될 위험. Phase 1에 템플릿으로 박아두는 편이 안전.

본 Phase는 이들 Day-1 제약과 Next.js/Drizzle/Auth.js 스캐폴딩을 결합한 **최소 실행 가능한 구조**를 정의한다. RAG·스트리밍·구조화 블록은 의도적으로 배제하여 범위를 관리한다.

---

## 기술 선택 근거

### 결정 1: Vector DB — pgvector vs Pinecone

**선택: pgvector**

- **운영 단순화**: 별도 벡터 서비스 계약·네트워크 경계 없이 Postgres 단일 스택. Supabase/Neon 모두 `CREATE EXTENSION vector` 기본 지원. 백업·복구도 Postgres 표준 절차로 일원화.
- **데이터 레지던시**: handoff §16 "EU 고객 → EU-only 호스팅". pgvector는 Postgres 인스턴스와 동일 리전에 배치되어 데이터 이동 없음. Pinecone은 별도 리전 매핑 필요.
- **탈락 사유**: Pinecone은 대규모(수억 벡터) 코퍼스에서 성능 우위가 있으나, Regula는 FDA+EU MDR+MFDS+NMPA+PMDA+ISO+SOP 합계 수백만 청크 수준으로 예상되어 pgvector 한계(수천만 벡터)에 미달.
- **재평가 트리거**: P95 검색 지연 500ms 초과 또는 코퍼스 50M 청크 돌파 시.

### 결정 2: Queue / Worker — Inngest vs Trigger.dev

**선택: Inngest**

- **Vercel 통합**: Inngest는 Next.js Route Handler로 직접 이벤트 수신 가능, 별도 워커 배포 인프라 불필요. Vercel Functions 위에서 cold-start 수용 가능한 수준.
- **Event-driven 적합성**: RAG 코퍼스 재수집, 규제 업데이트 크롤링 등 **정기 이벤트 중심** 워크로드에 Inngest의 step function 모델이 적합.
- **탈락 사유**: Trigger.dev도 강력하나, 현 시점에 v3 안정화 중이며 Vercel 네이티브 통합은 Inngest가 앞섬.
- **재평가 트리거**: Inngest step 제한 초과 또는 장시간 실행 작업(> 5분) 증가 시.

### 결정 3 [v0.2.0: Phase 2로 이동 — AUD-013]: LLM Orchestration

**현재 상태: Phase 1에서 결정하지 않음.**

- **AUD-013 지적:** Phase 1 산출물 어디에도 LangChain.js 의존성 추가가 포함되지 않으므로, Phase 1에 결정을 잠그는 이익이 없음. 오히려 Phase 2 착수 시점 재평가가 타당.
- **Phase 2 후보:** LangChain.js (1차 후보) vs LlamaIndex TS. 판단 기준:
  - LangChain.js의 리트리버 생태계 성숙도 (pgvector, Cohere Rerank, hybrid search 공식 모듈)
  - Citation-strict 프롬프트 + Zod 출력 파서 지원
  - Phase 2 착수 시점의 최신 버전 breaking change 상황
- **실행자:** Phase 2 Kickoff 시 `regula-architect`가 재평가 후 최종 결정. `package.json` 의존성 추가는 Phase 2 구현 단계.
- **Phase 1 영향:** `package.json`에 `langchain` / `llamaindex` 의존성 **미추가**. 본 SPEC의 Technical Decision 테이블 "Phase 2 기록" 섹션만 참고용으로 유지.

### 결정 3 (이전 #4): `message_blocks` 단일 테이블 통합 [v0.2.0에서 `source_sections` 유지 명시]

**선택: `message_blocks` + `block_type` enum 단일화, `checklist_items` 별도 테이블 제거**

- **데이터 모델 단순성**: 6종 블록(`prose` / `checklist` / `comparison` / `timeline` / `sources` / `related`)을 균일하게 `block_json`으로 저장하면 Phase 3 렌더링 로직이 폴리모픽으로 단순화.
- **확장성**: 새 블록 타입 추가 시 enum 값만 추가하면 되어 마이그레이션 비용 최소.
- **단점 및 완화**: 체크박스 완료 상태(`completed`, `completed_by`, `completed_at`) 같은 mutable field가 `block_json` 내부 JSON에 묻히면 쿼리·인덱싱이 어려움. Phase 3에서 별도 `checklist_completions` 테이블(`block_id`, `item_key`, `user_id`, `completed_at`)을 도입하여 정규화 예정. Phase 1은 스키마를 단순하게 유지.
- **handoff 원문과의 차이**: handoff §12는 `message_blocks`와 `checklist_items`를 별도 테이블로 sketch했으나, 이는 "rough sketch"이며 production에서는 `message_blocks`에 통합하는 것이 일관성이 높다고 판단.
- **[v0.2.0 명시 — AUD-001]** 이 통합은 **`checklist_items` 제거만** 의미하며, `source_sections` 테이블은 **Phase 1에서 반드시 유지**한다. handoff §12 line 704 원문에 `source_sections (id, source_id, anchor, heading, text, embedding vector(1536))`가 독립 테이블로 명시되어 있으며, product.md §9 시나리오 2 "Citation 클릭 → DocViewer 모달 → `#source=N&offset=M` 딥링크" 기능은 `source_sections.anchor` 컬럼에 전적으로 의존한다. v0.1.0에서 silent drop 되었던 문제를 v0.2.0 REQ-FND-044a/b/c로 복구.

### 결정 4: audit_logs 변경 차단 범위 [v0.2.0 신규 — AUD-003]

**선택: UPDATE/DELETE + TRUNCATE 모두 차단 + `app_role` 권한 REVOKE + migrations role 분리**

- **v0.1.0 gap:** `BEFORE UPDATE OR DELETE` 트리거만으로는 `TRUNCATE TABLE audit_logs`, `ALTER TABLE audit_logs DISABLE TRIGGER ALL`, `CREATE OR REPLACE FUNCTION tg_audit_logs_block_mutation()`으로 쉽게 우회 가능. 21 CFR Part 11 §11.10(c) "protection of records" 엄격 해석 시 미충족.
- **3-layer defense:**
  1. **Row-level trigger** (`BEFORE UPDATE OR DELETE ON audit_logs`) — 개별 row 변이 차단
  2. **Statement-level trigger** (`BEFORE TRUNCATE ON audit_logs`) — TRUNCATE 전용 이벤트 봉쇄
  3. **Role 권한 박탈** (`REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES ON audit_logs FROM <app_role>`) — 앱 연결 layer에서 근본 차단
  4. **Migrations role 분리** — 트리거 함수 owner를 별도 `<migrations_role>`로 지정하여 `app_role`에서 `CREATE OR REPLACE FUNCTION` 우회 차단
- **DBA 환경 제약:** Supabase 관리형 서비스는 superuser 권한 제한으로 role 분리가 어려울 수 있음 (v0.2.0 Risks 표 참조). 불가 환경이면 감사 로그를 별도 DB/스키마로 아카이브하는 대안 필요.
- **재평가 트리거:** DBA가 role 분리를 거부하거나 Supabase 정책 변경 시.

### 결정 5: `/api/ra/projects` · `/api/ra/sources` 스키마 연기

**선택: Phase 4 범위로 이동**

- **handoff 상세 부족**: §11에서 엔드포인트 이름만 명시되고 Zod 스키마 세부가 없음. Phase 1에서 임의 확정 시 Phase 4 실구현 시 재설계 비용.
- **Phase 1 스코프 정렬**: Phase 1은 스캐폴딩이며 API 라우트 파일조차 `/api/auth/[...nextauth]`만 필수. 나머지는 Phase 2(`/consult`) 및 Phase 4(breadth views)에서 단계적 도입.
- **영향**: Phase 1 출력에는 `/api/ra/projects` 관련 코드 없음. `regula-architect`가 Phase 4 착수 시 결정.

### 결정 6: 21 CFR Part 11 전자 서명 연기

**선택: Post-launch (Phase 1 미구현)**

- **법무 판단 필요**: 전자 서명(electronic signatures, 21 CFR §11.50~11.300) 요건은 "GxP 레코드 생성" 여부에 따라 적용 범위가 달라짐. Regula는 **자문/조언 도구**이며 제출 문서 자체를 생성하지 않으므로 GxP record가 아닐 가능성이 크지만, 사내 RA 리더 판단 필요.
- **Day 1 필수는 append-only + 7년 보존만**: 21 CFR §11.10(c) "protection of records" 및 §11.10(e) "audit trail" 요건은 본 SPEC의 REQ-FND-044~REQ-FND-050으로 충족.
- **재평가 트리거**: Post-launch 컴플라이언스 감사 결과에 따라 별도 `SPEC-REGULA-ESIG-XXX` 발행.

---

## handoff 해석 메모

Phase 1 실행 시 compliance-qa/architect가 참조할 **해석 결정**을 기록한다.

### 해석 1: `messages.confidence_level` 필드 타입
handoff §12는 `confidence_level` 타입을 명시하지 않음. EARS REQ-FND-036에서 **Drizzle pgEnum (`high` | `med` | `low` | null)**로 결정. 이유: handoff §8.2 ConfidenceBadge 컴포넌트가 3단계 색상 매핑이므로 enum이 자연스러움.

### 해석 2: `message_blocks.order_index` 컬럼 추가
handoff §12 sketch에는 없으나, Phase 3 렌더링 시 블록 순서(prose → checklist → comparison → timeline → sources → related)가 고정되지 않을 수 있음. `order_index integer NOT NULL` 컬럼을 추가하여 결정론적 정렬 보장.

### 해석 3: `session.strategy = 'database'` 선택
handoff §15는 "idle 30분 세션 타임아웃"만 명시, JWT vs DB 세션 미결정. DB 세션을 선택한 이유:
1. 관리자 강제 로그아웃 구현 용이 (JWT는 서버 측 무효화 불가)
2. `audit_logs` 감사 시 session_id join 가능
3. Drizzle adapter 공식 지원

### 해석 4: `locale: 'ko'` 기본값
handoff §6은 "한국어 UI가 기본"이라 언급. `<html lang="ko">` 하드코딩 및 `users.locale` 기본값 `'ko'`로 확정. 런타임 로케일 스위처는 Phase 5에서 도입.

### 해석 5: `messages.content_prose` vs `message_blocks[block_type='prose']` 중복
handoff §12 sketch는 `messages.content_prose` (텍스트) + `message_blocks` (구조화) 이원화 구조. 이대로 유지하되, Phase 2 Chat core 구현 시 "prose는 `messages.content_prose`, 구조화 블록만 `message_blocks`"로 규칙 명시 예정. Phase 1 스키마는 양쪽 모두 허용.

### 해석 6: Middleware **only** for auth redirect [v0.2.0 — AUD-014]
v0.1.0은 `middleware.ts` **또는** `app/(app)/layout.tsx` server-side session check 둘 다 허용했으나, plan-auditor AUD-014에서 결정론 부재를 지적. v0.2.0에서 **middleware-only로 단일화**: 엣지 레벨 조기 차단 + RSC 번들 절약 + matcher 화이트리스트(REQ-FND-053)로 public path 보호 + `/login`에서 인증된 사용자 리다이렉트 커버. server-side layout session 읽기는 "개인화"(예: Sidebar 사용자명) 목적으로 허용되나 **redirect 로직은 금지**.

### 해석 7: `--font-serif` 순서 — 영문(Source Serif 4) 우선 [v0.2.0 — AUD-002 교정]
v0.1.0은 "한국어 우선 사용자" 원칙을 폰트 stack 순서로 그대로 옮겨 `'Noto Serif KR', 'Source Serif 4', Georgia, serif`로 역전 선언. 그러나 CSS font-family stack은 **존재 시 앞 폰트 우선 적용**이므로, 이 순서는 영문 텍스트에도 Noto Serif KR를 강제하여 Source Serif 4의 italic·OpenType 피처를 무효화하고 브랜드 요건(Non-Obvious Constraint #5)을 위반.

**v0.2.0 교정:** handoff §6 line 287 원문과 정확히 동일한 `'Source Serif 4', 'Noto Serif KR', Georgia, serif` 순서로 변경. 한국어 친화 렌더링은 `--font-sans`의 Pretendard (IBM Plex Sans → Pretendard 폴백) 배치에서 책임.

**Browser rendering 이해:** font-family stack은 "글자별로 첫 번째 available glyph 매칭"이 아니라 "첫 번째 available font 전체 적용"이 원칙. 단, **글자가 폰트에 없으면 다음 폰트로 fallback**. 따라서 영문 본문은 Source Serif 4가 전체 커버, 한국어 본문은 Source Serif 4에 글리프 부재 시 Noto Serif KR로 자연 폴백.

### 해석 8: audit_logs 컬럼 확장 [v0.2.0 — AUD-005]
handoff §12 sketch는 `audit_logs (id, actor_id, action, resource_type, resource_id, meta_json, created_at)` 7개 컬럼. v0.2.0에서 `conversation_id` FK (RESTRICT) 컬럼 추가. 이유: expert-review 플래그, 특정 대화에 대한 LLM 호출 등은 conversation 단위 조회 감사가 필요하며, `meta_json`에 UUID를 밀어넣는 대신 정규 FK로 인덱싱·조회 효율화.

### 해석 9: `messages.tokens_in/out/model` Phase 1 nullable 배치 [v0.2.0 — AUD-018]
Phase 1에는 LLM 호출 로직이 없어 값이 비어있지만, 컬럼을 **Phase 1에 확보**함으로써 Phase 2 구현 시 `ALTER TABLE` 불필요. Phase 4 Dashboard (`§7.9` Recharts bar chart)의 token/cost 집계 기반을 Day-1에 잠근다. 모든 3개 컬럼 nullable default NULL이므로 Phase 1 backfill 불필요.

---

## 참조 문헌

실행 에이전트가 직접 확인할 **공식 문서 링크만** 제공한다. 추측·요약 없음.

### Next.js 15 / App Router
- Next.js 15 공식 문서: https://nextjs.org/docs
- App Router 레이아웃: https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts
- Route Groups: https://nextjs.org/docs/app/building-your-application/routing/route-groups
- Metadata API: https://nextjs.org/docs/app/api-reference/functions/generate-metadata

### Tailwind CSS v4
- v4 공식 소개: https://tailwindcss.com/blog/tailwindcss-v4
- `@theme` directive: https://tailwindcss.com/docs/v4-beta#theme-configuration

### Drizzle ORM
- 공식 문서: https://orm.drizzle.team/docs/overview
- Postgres 스키마 정의: https://orm.drizzle.team/docs/sql-schema-declaration
- pgvector 확장 사용: https://orm.drizzle.team/docs/extensions/pg#pg_vector
- Drizzle Kit 마이그레이션: https://orm.drizzle.team/kit-docs/overview

### Auth.js v5 (NextAuth)
- v5 마이그레이션 가이드: https://authjs.dev/guides/upgrade-to-v5
- Microsoft Entra ID provider: https://authjs.dev/getting-started/providers/microsoft-entra-id
- Google provider: https://authjs.dev/getting-started/providers/google
- Drizzle adapter: https://authjs.dev/getting-started/adapters/drizzle

### pgvector
- GitHub 공식: https://github.com/pgvector/pgvector
- 인덱스 타입 비교 (ivfflat vs hnsw): https://github.com/pgvector/pgvector#indexing

### 21 CFR Part 11
- FDA 공식 텍스트: https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11
- §11.10 Controls for closed systems (append-only audit trail): https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11/subpart-B/section-11.10

### Anthropic Claude
- Claude 모델 문서 (Sonnet/Haiku 4.5): https://docs.anthropic.com/en/docs/about-claude/models
- 프롬프트 캐싱 공식 가이드: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching

### Biome / Vitest / Playwright
- Biome 설정: https://biomejs.dev/reference/configuration/
- Vitest 공식: https://vitest.dev/
- Playwright 공식: https://playwright.dev/docs/intro

### 폰트
- IBM Plex: https://fonts.google.com/specimen/IBM+Plex+Sans
- Source Serif 4: https://fonts.google.com/specimen/Source+Serif+4
- Noto Serif KR: https://fonts.google.com/noto/specimen/Noto+Serif+KR
- Pretendard (셀프 호스팅): https://github.com/orioncactus/pretendard — npm 패키지: `@fontsource-variable/pretendard`

---

## Phase 경계 메모

Phase 1 완료 이후 Phase 2~6으로 연기되는 **핵심 작업 목록**. 각 항목은 향후 별도 SPEC 발행 대상.

### Phase 2 — Chat core로 연기
- `/api/ra/consult` SSE 스트리밍 Route Handler
- `useStreamingAnswer` 훅 (meta → trace → prose_delta → structured blocks → done 이벤트 파싱)
- Composer 컴포넌트 (React Hook Form + Zod, 8k chars 제한, rate limit 60/hour)
- Thinking 트레이스 UI (500ms 간격 단계별 표시)
- AnswerBlock + Citation `<sup>` 렌더링
- DocViewer 모달 + `#source=N&offset=M` 딥링크
- Citation 후처리 강제 (시스템 프롬프트 + 후처리 검증 두 겹)
- RAG 파이프라인 8단계 (Haiku 분류 → 쿼리 재작성 → 하이브리드 검색 → Cohere Rerank → Sonnet 답변 → 후처리)
- 단일 코퍼스 wiring (FDA 부터 시작)
- LangChain.js 코드 기반 구축
- Inngest worker (코퍼스 재수집 이벤트)

### Phase 3 — Structured outputs로 연기
- Checklist 블록 렌더링 + 완료 상태 지속성 (`checklist_completions` 테이블 신규)
- ComparisonTable (region chip, vertical-align top)
- Timeline (세로 1px 선, current = amber bullet)
- SuggestedFollowups (SuggestionPill)
- RightContextPanel (출처 목록 + 프로젝트 컨텍스트)

### Phase 4 — Breadth로 연기
- History view (TanStack Virtual 가상화, 100행+)
- Templates view (3열 그리드, `.docx`/`.pdf` 다운로드)
- Knowledge Base (출처 투명성 공개)
- Regulatory Updates 피드
- Dashboard (Recharts 바 차트)
- Projects 전환 (Zustand `currentProjectId`)
- `/api/ra/projects`, `/api/ra/sources`, `/api/ra/templates`, `/api/ra/updates` Zod 스키마 확정
- Settings page

### Phase 5 — Enterprise hardening으로 연기
- Expert review 워크플로우 (`/api/ra/expert-review` POST, RA 리드 큐 UI)
- Expert review 자동 게이팅 (confidence < 0.7 OR 차단 키워드)
- RBAC 세분화, 조직/프로젝트 ACL (Supabase RLS)
- 다크 모드 런타임 토글 (Zustand `ui.theme` + localStorage + prefers-color-scheme)
- i18n 런타임 스위처 (ko ↔ en, 대화 유지)
- 접근성 감사 (axe-core 0 violations, WCAG 2.1 AA)
- Sentry 에러 트래킹
- PostHog 제품 분석
- Langfuse LLM trace + 비용 이상 알림
- CSP strict (nonce 기반), HSTS, `X-Frame-Options: DENY`
- 7년 retention 실제 archival job

### Phase 6 — Quality & launch로 연기
- promptfoo LLM eval harness (50+ RA 질문 회귀 세트)
- Playwright e2e 시나리오 (login, new consultation, citation click, expert review, project switch)
- 부하 테스트 (동시 60 queries/sec)
- 보안 리뷰 (OWASP, Penetration test)
- 공개 문서 / 지원 가이드

### Post-launch
- 21 CFR Part 11 전자 서명 (필요 시 별도 SPEC)
- 문서 diff 뷰어 (handoff §19)
- 제출 플래너 Gantt (handoff §19)
- Regula API (외부 통합용)
- 모바일 앱
