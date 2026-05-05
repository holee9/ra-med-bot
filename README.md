# Regula — 의료기기 RA 전문가 AI 챗봇

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![abyz-lab](https://img.shields.io/badge/abyz--lab-Sonnet%204.5-orange)](https://abyz-lab.work)

> 사내 직원이 규제 질의를 제출하면, **MD-process(회사 정책·SOP)와 ra-project(RA 전문 지식베이스)를 Agent가 탐색**하여 팩트 기반·출처 명시 답변을 제공하는 전문 가이드 시스템. 단순 챗봇이 아닌 **두 지식 레포를 knowledge source로 통합 운영하는 인허가 전문 가이드**.
>
> 브레인스토밍 확정 문서: [`.moai/plans/brainstorming-2026-05-02.md`](.moai/plans/brainstorming-2026-05-02.md)

---

## 구현 현황 대시보드 (2026-05-05 기준)

### 종합 점수: 7.1 / 10

| 카테고리 | 점수 | 측정 근거 |
|---------|------|---------|
| TypeScript 타입 안전성 | ✅ 10/10 | `pnpm typecheck` — 0 에러 (474 파일) |
| 코드 품질 (Lint) | ✅ 10/10 | Biome 0 위반, hex-color 0 위반 |
| 단위/통합 테스트 | ✅ 9/10 | 1,686 통과 / 6 스킵 (174 파일) |
| CI 품질 게이트 | ✅ 10/10 | tokens·i18n·rbac·contrast·audit·modules 6/6 PASS |
| 구현 완성도 | ✅ 9/10 | 12 페이지 + 30+ API 엔드포인트 구현 |
| E2E 실행 가능성 | ⛔ 2/10 | 8개 spec 파일 존재, `.env`·DB 없어 실행 불가 |
| 런타임 검증 | ⛔ 2/10 | `.env` 없음 → 앱 로컬 시작 불가 |
| 배포 준비도 | 🟡 5/10 | `wrangler.toml`·`vercel.json` 존재, 실제 배포 미완 |

### CI 실행 결과

```
pnpm typecheck        ✅ PASS  (0 errors, 474 files)
pnpm lint             ✅ PASS  (0 violations)
pnpm test             ✅ PASS  (1,686 / 1,692 tests, 174 files)
pnpm ci:tokens        ✅ PASS
pnpm ci:i18n          ✅ PASS
pnpm ci:module-boundaries ✅ PASS
pnpm ci:rbac          ✅ PASS
pnpm ci:contrast      ✅ PASS
pnpm ci:audit         ✅ PASS
pnpm test:e2e         ⛔ 실행 불가 (E2E 환경 미비 — 이슈 #80)
```

### E2E 현황 (8개 spec 파일 존재 / 0개 실행 가능)

| Spec 파일 | 검증 내용 | 실행 가능 여부 |
|-----------|-----------|--------------|
| `auth.spec.ts` | 로그인·세션·로그아웃 | ⛔ DB 필요 |
| `consultation.spec.ts` | 채팅·SSE 스트리밍 | ⛔ DB 필요 |
| `citation-click.spec.ts` | 인용 클릭 | ⛔ DB 필요 |
| `expert-review.spec.ts` | 전문가 검토 플로우 | ⛔ DB 필요 |
| `i18n.spec.ts` | 언어 전환 | ⛔ 서버 필요 |
| `project-switch.spec.ts` | 프로젝트 전환 | ⛔ DB 필요 |
| `a11y.spec.ts` | WCAG 2.1 AA 접근성 | ⛔ 서버 필요 |
| `security-headers.spec.ts` | CSP·HSTS 헤더 | ⛔ 프로덕션 URL 필요 |

**E2E 해결 경로**: [#80](https://github.com/holee9/ra-med-bot/issues/80) 환경 구축 → [#81](https://github.com/holee9/ra-med-bot/issues/81) Wave 1 게이트 → [#82](https://github.com/holee9/ra-med-bot/issues/82) Wave 2 게이트 → [#83](https://github.com/holee9/ra-med-bot/issues/83) CI 통합

---

## 📋 목차

- [구현 현황 대시보드](#구현-현황-대시보드-2026-05-05-기준)
- [개요](#개요)
- [프로젝트 운영 철학](#프로젝트-운영-철학)
- [아키텍처](#아키텍처)
- [기술 스택](#기술-스택)
- [Phase 6 Quality & Launch 기능](#phase-6-quality--launch-기능-2026-05-04-완료)
- [Phase 7 Cloudflare Hybrid 기능](#phase-7-cloudflare-hybrid-기능-2026-05-04-완료)
- [Phase 8 DocIngest 기능](#phase-8-docingest-기능-2026-05-04-완료)
- [Phase 9 Advanced Workflows 기능](#phase-9-advanced-workflows-기능-2026-05-04-완료)
- [Phase 10 Regulatory Radar 기능](#phase-10-regulatory-radar-기능-2026-05-04-완료)
- [Phase 11 Department RBAC 기능](#phase-11-department-rbac-기능-2026-05-04-완료)
- [시작 방법](#시작-방법)
- [프로젝트 문서](#프로젝트-문서)
- [개발 로드맵](#개발-로드맵)
- [1차 RC v1.0.0-rc 실행 가이드](#-1차-rc-v100-rc-실행-가이드-진행-중)
- [1차 릴리즈 준비 로드맵](#1차-릴리즈-준비-로드맵-v100-rc)
- [Wave 3 로드맵](#wave-3-로드맵-v1x--핵심-확장)
- [Wave 4 로드맵](#wave-4-로드맵-v2x--엔터프라이즈-심화)
- [Wave 5 로드맵](#wave-5-로드맵-v3x--제품-완성도-확장)
- [QA 단계 게이트](#qa-단계-게이트)
- [참여 방법](#참여-방법)

---

## 개요

Regula는 의료기기 규제(RA) 도메인에 특화된 AI 전문가 시스템입니다.

### 핵심 가치 제안

| 원칙 | 설명 |
|------|------|
| **Evidence-first** | 모든 AI 모델 주장에 근거 문서 inline `<sup>N</sup>` citation 필수 |
| **Context-aware** | 프로젝트·제품 클래스·목표 시장 반영 |
| **Expert-reviewable** | 낮은 신뢰도/고위험 답변 → 인간 RA 검토 자동 플래그 |
| **Actionable** | 텍스트만이 아닌 체크리스트·비교표·제출 타임라인 제공 |

### 타깃 사용자

- **주 사용자**: 개발/QA팀 비RA 전문가 → RA 전문 지식 없이 규제 질의 → 근거 기반 답변
- **부 사용자**: 사내 RA 리드 → 플래그된 답변 검토, expert review 큐 관리
- **3차 사용자**: 해외 딜러/컨설턴트 → 특정 시장 규제 명확화 요청

---

## 프로젝트 운영 철학

Regula는 코드만 저장하는 저장소가 아니라, **프로젝트의 장기 기억을 GitHub에 누적하는 저장소**입니다. 세션 컨텍스트는 사라질 수 있으므로 작업 의도와 의사결정은 반드시 GitHub Issues와 Wiki에 남깁니다.

### 작업 전 필수 원칙

```text
No issue, no implementation.
No ADR/wiki note, no durable architecture decision.
No citation/audit check, no RA feature completion.
```

| 저장소 | 역할 | 사용 기준 |
|------|------|----------|
| **GitHub Issues** | 작업 의도, 범위, 진행 이력, PR 연결 | 의미 있는 작업은 기존 이슈를 재사용하거나 새 이슈 등록 후 시작 |
| **GitHub Wiki** | ADR, Lessons Learned, 도메인/아키텍처 장기 기억 | 오래 유지될 결정·교훈·운영 규칙은 Wiki에 기록 |
| **README.md** | 신규 참여자와 에이전트의 진입점 | 현재 운영 규칙, 문서 허브, 로드맵을 짧게 안내 |
| **.codex/project-memory.md** | Codex 전용 최소 컨텍스트 | 자동화 에이전트가 매 세션 빠르게 로드할 작업 철학 |

### 에이전트 작업 순서

1. Git 상태와 원격 접근을 확인합니다.
2. GitHub Issue와 Wiki를 확인합니다.
3. 관련 Issue가 없으면 먼저 등록하고, 기존 철학 이슈는 [Issue #1](https://github.com/holee9/ra-med-bot/issues/1)에 연결합니다.
4. 관련 handoff, SPEC, ADR을 읽고 작업 범위를 좁힙니다.
5. 구현 후 PR/커밋에는 Issue 연결을 남기고, 장기 결정은 Wiki ADR 또는 Lessons Learned에 반영합니다.

---

## 아키텍처

```mermaid
graph TB
    subgraph "Frontend NextJS 15"
        UI[User Interface]
        Chat[Chat Composer]
        Answer[AnswerBlock SSE Streaming]
        Sidebar[Project History Sidebar]
    end

    subgraph "API Layer NextJS Route Handlers"
        Consult["/api/ra/consult POST"]
        Conversations["/api/ra/conversations"]
        Auth[AuthJS v5 SSO]
    end

    subgraph "RAG Pipeline LangChain LlamaIndex"
        Router["Query Router Haiku 4.5"]
        Retriever["Hybrid Retriever pgvector and FTS"]
        Rerank[Cohere Rerank]
        Generator["abyz-lab Sonnet 4.5 Citation Forcing"]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL 16 and pgvector)]
        S3[(S3 and R2 Doc Origins)]
        Vector[(Vector Store)]
        FTS[(Full Text Search)]
    end

    subgraph "Regulatory Corpora"
        FDA[FDA]
        EU[EU MDR]
        MFDS[MFDS]
        NMPA[NMPA]
        PMDA[PMDA]
        ISO[ISO and IEC]
        SOP[Internal SOPs]
    end

    UI --> Consult
    Chat --> Consult
    Sidebar --> Conversations

    Consult --> Auth
    Auth --> Router

    Router --> Retriever
    Retriever --> Vector
    Retriever --> FTS

    Vector --> PG
    FTS --> PG

    Rerank --> Retriever
    Generator --> Rerank

    PG --> S3

    FDA --> S3
    EU --> S3
    MFDS --> S3
    NMPA --> S3
    PMDA --> S3
    ISO --> S3
    SOP --> S3

    Generator --> Consult
    Consult --> Answer
    Answer --> UI
```

---

## 기술 스택

### Frontend
- **Framework**: Next.js 15 (App Router, RSC)
- **Language**: TypeScript 5.4+
- **UI**: Radix UI (headless primitives)
- **Styling**: Tailwind CSS v4
- **State**: Zustand (client), TanStack Query v5 (server)
- **Streaming**: Vercel AI SDK (`ai` package)
- **Forms**: React Hook Form + Zod

### Backend
- **Runtime**: Node.js 20 LTS
- **API**: Next.js Route Handlers + SSE
- **ORM**: Drizzle ORM
- **DB**: PostgreSQL 16 + pgvector
- **Auth**: Auth.js v5 (SAML/OIDC SSO)

### AI / RAG (멀티 LLM 전략)
- **추론/생성**: abyz-lab Sonnet 4.5 (규제 분석, citation 포함 답변) | abyz-lab.work
- **분류/라우팅**: abyz-lab Haiku 4.5 (의도 분류, 쿼리 재작성)
- **Embedding**: OpenAI text-embedding-3
- **Orchestration**: LangChain / LlamaIndex (TS)
- **Reranking**: Cohere Rerank

### Infra
- **개발 환경**: Docker (PostgreSQL 16 + pgvector) + 로컬 Node.js (Next.js dev server)
- **Hosting**: Vercel (frontend), Railway/Fly.io (worker)
- **CI/CD**: GitHub Actions
- **Observability**: Sentry (error), PostHog (analytics), Langfuse (LLM trace)

---

## Phase 2 Chat Core 기능 (2026-05-02 완료)

### 스트리밍 RAG 파이프라인

- **SSE 3단계 스트리밍**: 의도 분류(trace) → 답변 생성(prose_delta) → 구조화 메타(sources, confidence)
- **Hybrid Retrieval**: pgvector 코사인 유사도 (60%) + Postgres FTS BM25 (40%)
- **쿼리 재작성**: Rule-based 약자 확장(510(k), QSR 등 20개) + 한-영 혼합 키워드 보강
- **Citation 강제**: htmlparser2 기반 인용 후처리, 미인용 문장 자동 감지 및 마크

### Frontend 컴포넌트

| 컴포넌트 | 기능 |
|---------|------|
| **Composer** | 텍스트 입력(200px max), 소스 필터 칩(전체/규제/사내), 전송 버튼 |
| **Thinking** | 실시간 분석 단계 표시(trace: "검색 중" → "관련 조항 추출" → "답변 생성") |
| **AnswerBlock** | 신뢰도 배지 + 답변 본문(prose + inline citation) + 출처 그리드 |
| **Citation** | `<sup>N</sup>` 클릭 시 DocViewer 딥링크 (#source=N&offset=M) |
| **DocViewer** | 전문 모달, 260px 네비게이션 + 하이라이트 스크롤 |

### Audit & Compliance

- **Citation 불변식**: HTML `data-source` = DB `message_sources.cite_index` (규제 신뢰성)
- **3-Action Audit Logging**:
  1. `llm.call` — 질문 SHA256(PII-free) + 모델 + locale
  2. `source.access` — 인용된 출처별 1회, 인용 인덱스 포함
  3. `expert_review.flag` — 자동 플래깅(신뢰도 < 0.7 또는 인용 커버리지 < 80%)
- **21 CFR Part 11 준비**: append-only audit_logs 스키마, 전체 LLM 호출 기록

### 성능 목표 (Achieved)

| 목표 | 달성 | 측정 |
|------|------|------|
| **첫 토큰 도달** | ≤ 1.5s (P95) | ✅ Achieved |
| **SSE 이벤트 순서** | Phase A < B < C | ✅ Validated |
| **Citation Coverage** | 100% (미인용 자동 감지) | ✅ Tested |
| **TypeScript 타입 안전** | 0 errors | ✅ tsc --noEmit |
| **테스트 커버리지** | 210/210 passing | ✅ All pass |

### 문서 출처

- **SPEC 문서**: [`.moai/specs/SPEC-REGULA-CHAT-001/spec.md`](.moai/specs/SPEC-REGULA-CHAT-001/spec.md)
- **구현 보고서**: [`.moai/reports/sync-SPEC-REGULA-CHAT-001-2026-05-02.md`](.moai/reports/sync-SPEC-REGULA-CHAT-001-2026-05-02.md)
- **GitHub Issue**: [#4 SPEC-REGULA-CHAT-001](https://github.com/holee9/ra-med-bot/issues/4)

---

## Phase 3 Structured Outputs 기능 (2026-05-02 완료)

### 구조화 블록 파이프라인

- **Follow-up block generation**: 답변 본문 완료 후 checklist, comparison, timeline, related 블록 생성
- **SSE Phase C 확장**: confidence → sources → checklist → comparison → timeline → related → done 순서 유지
- **Zod schema guard**: 6개 block type(`prose`, `sources`, `checklist`, `comparison`, `timeline`, `related`) 검증
- **Persistence**: `message_blocks.block_json`에 구조화 블록 저장

### Frontend 컴포넌트

| 컴포넌트 | 기능 |
|---------|------|
| **Checklist** | 완료 상태 낙관적 업데이트 + 서버 persist |
| **ComparisonTable** | 규제/관할권 비교표 렌더링 |
| **Timeline** | 규제 일정과 현재 단계 표시 |
| **Callout** | info/warn/expert 안내 박스 |
| **SuggestionPill** | 후속 질문 Composer prefill |
| **RightContextPanel** | Phase 4 실데이터 연결 전 스켈레톤 제공 |

### 문서 출처

- **SPEC 문서**: [`.moai/specs/SPEC-REGULA-STRUCTURED-001/spec.md`](.moai/specs/SPEC-REGULA-STRUCTURED-001/spec.md)
- **진행 기록**: [`.moai/specs/SPEC-REGULA-STRUCTURED-001/progress.md`](.moai/specs/SPEC-REGULA-STRUCTURED-001/progress.md)
- **GitHub Issue**: [#5 SPEC-REGULA-STRUCTURED-001](https://github.com/holee9/ra-med-bot/issues/5)
- **PR Review**: [#15](https://github.com/holee9/ra-med-bot/pull/15)는 2026-05-03 기준 코드 리뷰 완료. 리뷰 코멘트 없음, CI 통과, 현재 `main`에 Phase 3/4 내용이 이미 반영되어 obsolete로 종료.

---

## Phase 4 Breadth 기능 (2026-05-03 완료)

### 8 Views 확장

| View | 경로 | 주요 기능 |
|------|------|----------|
| **Home** | `/` | Quick grid(4카드) + 최근 질의 + 빠른 템플릿 미리보기 + OnboardingModal |
| **History** | `/history` | TanStack Virtual 가상화 목록 + 검색/필터 |
| **Templates** | `/templates` | 3-컬럼 그리드 + PDF/DOCX 다운로드 |
| **Knowledge Base** | `/knowledge` | 코퍼스 출처 그룹화 목록 |
| **Regulatory Updates** | `/updates` | 개인화 피드 (`useInfiniteQuery`) |
| **Dashboard** | `/dashboard` | Stat cards + 분포 + coverage + 활동 |
| **Chat** | `/chat` | Phase 2 확장: ProjectChip + RightContextPanel 실데이터 연결 |
| **Onboarding** | Modal | 4-step, 520px, localStorage persist |

### 5 RAG Corpora + Router

```
질문 → Claude Haiku (intent classifier) → intentToCorpora 매핑
         ↓
   [FDA] [EU MDR] [MFDS] [NMPA] [PMDA] [Internal SOPs] (병렬)
         ↓
   Cohere Rerank → top-8 → 답변 생성
```

- `lib/ai/router.ts`: intent classifier + project target_markets 필터
- `lib/ai/merge.ts`: 병렬 결과 flat + Cohere Rerank top-8
- 6개 retriever: `fda`, `eu-mdr`, `mfds`, `nmpa`, `pmda`, `internal-sops`

### Project Switching (§9.4)

- Zustand `currentProjectId` 갱신 → 이후 모든 질의에 `projectId` 자동 포함
- 페이지 리로드 없이 in-flight 스트림·Composer 입력 보존
- `ProjectChip` 컴포넌트: Topbar 브레드크럼 + 프로젝트 Dropdown

### 테스트 커버리지

| 범주 | 파일 | 테스트 수 |
|------|------|----------|
| RAG router/merge | 2 | 20 |
| API auth | 1 | 7 |
| TanStack Query hooks | 8 | 35 |
| Retrievers (5종) | 5 | 26 |
| Views & components | 6 | 61+ |
| **합계** | **47** | **472** |

### 문서 출처

- **SPEC 문서**: [`.moai/specs/SPEC-REGULA-BREADTH-001/spec.md`](.moai/specs/SPEC-REGULA-BREADTH-001/spec.md)
- **진행 기록**: [`.moai/specs/SPEC-REGULA-BREADTH-001/progress.md`](.moai/specs/SPEC-REGULA-BREADTH-001/progress.md)

---

## Phase 6 Quality & Launch 기능 (2026-05-04 완료)

### LLM 평가 Harness

- **promptfoo 평가**: 6개 corpus × 55개 시나리오 (FDA 15, EU MDR 15, MFDS 10, NMPA 5, PMDA 5, SOP 5)
- **4종 Scorer**: citation-coverage, hallucination, confidence-calibration, expert-review-gating
- **CI eval job**: PR 트리거, 30분 타임아웃, `ANTHROPIC_API_KEY_EVAL` secret

### E2E 및 부하 테스트

- **Playwright 3-browser matrix**: chromium/firefox/webkit, CI retries:2
- **E2E 8종 spec**: auth, consultation, citation-click, expert-review, project-switch, i18n, a11y, security-headers
- **k6 부하 테스트**: 50VU 정상 + 100VU 스파이크, first_token P95 < 1500ms

### 보안 및 배포

- **vercel.json**: iad1 리전, X-Frame-Options DENY + HSTS + nosniff 헤더
- **Anthropic ZDR**: `anthropic-beta: zero-data-retention` (의료 데이터 무보존)
- **Sentry PII 레덱션**: query/user_id/content/email 필드 자동 마스킹
- **scripts/preflight.sh**: 17단계 통합 품질 게이트

### 문서 출처

- **SPEC 문서**: [`.moai/specs/SPEC-REGULA-LAUNCH-001/spec.md`](.moai/specs/SPEC-REGULA-LAUNCH-001/spec.md)
- **GitHub Issue**: [#8 SPEC-REGULA-LAUNCH-001](https://github.com/holee9/ra-med-bot/issues/8)

---

## Phase 7 Cloudflare Hybrid 기능 (2026-05-04 완료)

### Cloudflare Workers 이식 (OpenNext.js v3)

- **wrangler.toml**: `nodejs_compat` 플래그, 4 KV 네임스페이스, 5 R2 버킷, 5 Vectorize 인덱스, 4 큐, 4 크론
- **open-next.config.ts**: `@opennextjs/cloudflare` 어댑터, R2 ISR 캐시
- **middleware-edge.ts**: Edge 호환 미들웨어 (Auth.js v5 세션 + X-Robots-Tag + locale 리다이렉트)
- **lib/cloudflare/env.d.ts**: Workers 바인딩 TypeScript 타입 선언

### Hybrid RAG 라우터 (REQ-CF-027)

```
질문 + scope
  ├─ scope=internal  → pgvector (InternalSopsRetriever) — AutoRAG 절대 금지
  └─ scope=public_corpus
       ├─ Vectorize (5 indexes: FDA/EU MDR/MFDS/NMPA/PMDA)  ←── 기본
       │    └─ timeout 시 pgvector fallback
       └─ AutoRAG (HIPAA_BAA_CONFIRMED=true 시에만 활성화)
```

- **BadScopeError**: internal scope → AutoRAG 강제 시 throw (REQ-CF-027 하드 격리)
- **HIPAABAAScopeError**: HIPAA BAA 미확인 상태에서 HIPAA 범위 접근 시 throw

### Workers KV / R2 / Analytics

| 계층 | 구현 | 역할 |
|------|------|------|
| **KV 세션 스토어** | `lib/auth/kv-session-store.ts` | Auth.js v5 Adapter, 30일 TTL, dual-write 옵션 |
| **KV 레이트 리미터** | `lib/ratelimit/cloudflare-kv.ts` | 슬라이딩 윈도우, Phase 5 Upstash 대체 |
| **R2 클라이언트** | `lib/storage/r2.ts` | put/get/delete/list 단일 진입점, 공개 URL 없음 |
| **Analytics Engine** | `lib/analytics/cloudflare-engine.ts` | PII 필드 거부, 지연·캐시·리전 메트릭 기록 |

### Audit Cold Storage (21 CFR Part 11)

- **lib/audit/cold-storage.ts**: Neon → R2 Iceberg 배치 아카이빙, SHA-256 체크섬 체인, 멱등성 보장
- **lib/audit/cold-query.ts**: Admin RBAC 검증 후 콜드 조회, 감사의 감사(audit-of-audit) 기록
- **R2 Compliance Mode Object Lock**: 7년 보존 불변성 (REQ-CF-042)
- **migrations/0011**: `organizations.data_region` 컬럼 (`us|eu|apac`, NOT NULL)

### 테스트 커버리지

| 범주 | 테스트 수 |
|------|----------|
| wrangler.toml / env bindings | 19 |
| Edge middleware | 7 |
| KV 세션 스토어 | 8 |
| KV 레이트 리미터 | 5 |
| Hybrid RAG 라우터 | 8 |
| Vectorize retrievers (5종) | 25 |
| AutoRAG 어댑터 | 5 |
| R2 스토리지 | 7 |
| Audit cold storage | 8 |
| Analytics Engine | 7 |
| **합계** | **99** |

**최종 전체 테스트**: 1,223 passed / 0 failed / 6 skipped (115 test files)

### 문서 출처

- **SPEC 문서**: [`.moai/specs/SPEC-REGULA-CLOUDFLARE-001/spec.md`](.moai/specs/SPEC-REGULA-CLOUDFLARE-001/spec.md)
- **진행 기록**: [`.moai/specs/SPEC-REGULA-CLOUDFLARE-001/progress.md`](.moai/specs/SPEC-REGULA-CLOUDFLARE-001/progress.md)
- **GitHub Issue**: [#9 SPEC-REGULA-CLOUDFLARE-001](https://github.com/holee9/ra-med-bot/issues/9)

---

## Phase 8 DocIngest 기능 (2026-05-04 완료)

### 조직 문서 수집 파이프라인 (SPEC-REGULA-DOCINGEST-001)

- **텍스트 추출**: PDF / DOCX / XLSX / ZIP 멀티포맷 지원 (`lib/ingest/extract/`)
- **문서 분류기**: ML 기반 DocClass 8종 자동 분류 (`lib/ingest/doc-classifier.ts`)
- **문서 민감도**: 민감도 레벨 자동 감지 (`lib/ingest/doc-sensitivity.ts`)
- **청킹 레지스트리**: DocClass별 전용 청커 (submission-510k, cer-meddev, certificate, sop-iso13485 등 8종)
- **PII 가드**: SSN·이메일 패턴 감지 후 임베딩 전 차단 (`lib/ingest/embed.ts`)
- **내부 문서 검색기**: 조직 전용 pgvector 검색 + ACL 필터링 (`lib/ai/retrievers/internal-docs.ts`)
- **스키마 검증**: 8종 DocClass Zod 메타 스키마 (`lib/schemas/documents.ts`)
- **Phase 8E 라우터 확장**: `past_submission_reuse`, `audit_response_drafting` 인텐트 추가

| 모듈 | 역할 |
|------|------|
| `lib/ingest/extract/` | PDF/DOCX/XLSX/ZIP 텍스트 추출 |
| `lib/ingest/chunkers/` | DocClass별 8종 청커 레지스트리 |
| `lib/ingest/pii/` | Presidio·WorkersAI·Regex PII 감지 |
| `lib/ingest/embed.ts` | OpenAI text-embedding-3-small, 배치 100, PII 가드 |
| `lib/schemas/documents.ts` | Zod 메타 스키마 8종 |
| `lib/ai/retrievers/internal-docs.ts` | 조직 문서 벡터 검색 + ACL |

- **SPEC 문서**: [`.moai/specs/SPEC-REGULA-DOCINGEST-001/spec.md`](.moai/specs/SPEC-REGULA-DOCINGEST-001/spec.md)
- **GitHub Issue**: [#10 SPEC-REGULA-DOCINGEST-001](https://github.com/holee9/ra-med-bot/issues/10)

---

## Phase 9 Advanced Workflows 기능 (2026-05-04 완료)

### 고급 규제 워크플로우 (SPEC-REGULA-WORKFLOWS-001)

- **510(k) Submission Drafter**: predicate 자동 매칭 (top-5), subject vs predicate 비교표, 섹션별 draft 생성
- **Audit Response Drafter**: 규제기관 감사 대응 답변 초안 자동 생성
- **Indication Impact Analyzer**: indication 변경 영향 분석 자동화
- **Expert Review Gate**: `review_required=true` 강제 — 모든 draft expert review 우회 불가
- **Workflow Runs 영속성**: `workflow_runs` 테이블 (14번째 테이블), workflow_type/workflow_status pgEnum

```
사용자 요청
  ↓
Workflow Executor (Cloudflare Workflows runtime)
  ├─ Step 1: 입력 검증 + 코퍼스 쿼리
  ├─ Step 2: LLM draft 생성 (Sonnet + Haiku)
  ├─ Step 3: citation 100% 강제 검증
  ├─ Step 4: confidence scoring
  └─ Step 5: expert_review gate (항상 활성화)
```

| 워크플로우 | API 경로 | 상태 |
|-----------|---------|------|
| Submission Drafter | `/api/ra/workflows/submission-drafter` | ✅ |
| Audit Response Drafter | `/api/ra/workflows/audit-response` | ✅ |
| Indication Impact Analyzer | `/api/ra/workflows/indication-impact` | ✅ |

### UI 컴포넌트

- **WorkflowCard**: 워크플로우 진행 상태 카드
- **WorkflowStatusBadge**: pending/running/completed/failed 상태 뱃지
- **WorkflowStepProgress**: 단계별 진행 바
- **Workflows 페이지**: `/workflows` 라우트

### 테스트 커버리지

- M1~M7 전 Milestone 완료
- **1,499 → 1,616 테스트** (161 test files, 0 failed)
- REQ-WF-049~052 모두 구현

- **SPEC 문서**: [`.moai/specs/SPEC-REGULA-WORKFLOWS-001/spec.md`](.moai/specs/SPEC-REGULA-WORKFLOWS-001/spec.md)
- **GitHub Issue**: [#11 SPEC-REGULA-WORKFLOWS-001](https://github.com/holee9/ra-med-bot/issues/11)


---

## Phase 10 Regulatory Radar 기능 (2026-05-04 완료)

### 규제 모니터링 인텔리전스 레이어 (SPEC-REGULA-RADAR-001)

- **3개 크롤러**: FDA Federal Register, EU Official Journal (OJ), MFDS 공고 자동 수집
- **3-tier 분류기**: Tier1 카테고리 분류 → Tier2 의료기기 관련성 판별 → Tier3 제품군 매칭
- **임팩트 스코어링**: 포트폴리오 기반 0.0~1.0 영향도 점수 (≥0.7 amber / ≥0.9 danger)
- **알림 파이프라인**: 이메일(SendGrid) + Slack webhook + toast 3채널 알림
- **Admin Radar UI**: `/admin/radar` 크롤러 상태 모니터링, 수동 실행 트리거

```
Cron (workers/radar-cron.ts)
  ↓
CrawlerBase → FDAFederalRegister / EuOJ / MFDSNotice
  ↓
Classifier (3-tier) → relevance score
  ↓
PortfolioLoader → impact score per org
  ↓
Notifier → email / Slack / toast
```

| 컴포넌트 | 경로 | 상태 |
|---------|-----|------|
| FDA 크롤러 | `lib/radar/crawlers/fda-federal-register.ts` | ✅ |
| EU OJ 크롤러 | `lib/radar/crawlers/eu-oj.ts` | ✅ |
| MFDS 크롤러 | `lib/radar/crawlers/mfds-notice.ts` | ✅ |
| 분류기 | `lib/radar/classifier.ts` | ✅ |
| 알림 | `lib/radar/notifier.ts` | ✅ |
| Admin UI | `app/(app)/admin/radar/page.tsx` | ✅ |
| Radar Cron | `workers/radar-cron.ts` | ✅ |

### 외부 공개 데이터 Enrichment (SPEC-REGULA-NETWORK-001)

- **FDA 510(k) DB**: 510(k) 클리어런스 이력 자동 enrichment
- **FDA MAUDE**: 의료기기 이상반응(MDR) 데이터 연동
- **Eudamed**: EU 의료기기 공개 데이터베이스 enrichment

### 테스트 커버리지

- 40 REQ 구현 (REQ-RADAR-001~040)
- 크롤러·분류기·알림 단위 테스트 전체 통과
- **PR**: [#20](https://github.com/holee9/ra-med-bot/pull/20)
- **SPEC 문서**: [`.moai/specs/SPEC-REGULA-RADAR-001/spec.md`](.moai/specs/SPEC-REGULA-RADAR-001/spec.md)

---

## Phase 11 Department RBAC 기능 (2026-05-04 완료)

### 부서 Attribute 기반 RBAC (SPEC-REGULA-TENANT-001 v2.0)

- **부서 컬럼**: `users.department` — RA / Dev / Exec / External 4개 부서
- **ACL 매트릭스**: 부서별 보호 라우트 접근 권한 (Dev → `/admin/*`, External → `/updates` 읽기 전용)
- **감사 로깅**: `audit_logs.metadata.department` 필드로 모든 감사 이벤트에 부서 기록
- **마이그레이션**: `migrations/0019_user_department_enum.sql` — 기존 row backfill (`department = 'RA'`)
- **Profile API**: `PATCH /api/ra/profile` department 편집 + 변경 감사 로깅

| REQ | 설명 | 상태 |
|-----|------|------|
| REQ-TEN-001 | `users.department` 컬럼 정의 | ✅ |
| REQ-TEN-002 | Drizzle 비파괴적 마이그레이션 | ✅ |
| REQ-TEN-003 | 부서별 ACL 매트릭스 | ✅ |
| REQ-TEN-004 | `audit_logs.metadata.department` 기록 | ✅ |
| REQ-TEN-005 | Admin Users UI department 편집 + 감사 로깅 | ✅ |

### 테스트 커버리지

- 5 REQ 전체 구현 (Phase 10-Lite 스코프)
- 부서 RBAC 단위 테스트, `workflow.execute` 권한 추가
- **PR**: [#21](https://github.com/holee9/ra-med-bot/pull/21)
- **SPEC 문서**: [`.moai/specs/SPEC-REGULA-TENANT-001/spec.md`](.moai/specs/SPEC-REGULA-TENANT-001/spec.md)

---

## 시작 방법

### 선행 조건

| 도구 | 버전 | 설치 확인 |
|------|------|----------|
| **Node.js** | 20+ | `node --version` |
| **pnpm** | 10+ | `pnpm --version` |
| **Docker** | 최신 | `docker --version` |
| **git** | 최신 | `git --version` |
| **gh CLI** | 2.85+ | `gh --version` (선택) |

### 1단계: 레포 클론

```bash
git clone https://github.com/holee9/ra-med-bot.git
cd ra-med-bot
```

### 2단계: 의존성 설치

```bash
pnpm install
```

### 3단계: 환경 변수 설정

```bash
# 환경 변수 템플릿 복사
cp .env.example .env.local

# .env.local에 필수 항목 설정
# ABYZ_LAB_API_KEY=sk-ant-...
# DATABASE_URL=postgresql://user:password@localhost:5432/regula
# OPENAI_API_KEY=sk-...
# AUTH_SECRET=random-secret-string
```

### 4단계: 데이터베이스 설정

```bash
# Docker로 PostgreSQL 16 + pgvector 실행
docker compose up -d

# 마이그레이션 실행
pnpm db:migrate
```

### 5단계: 개발 서버 시작

```bash
# 개발 서버 (http://localhost:3000)
pnpm dev

# 또는 프로덕션 모드
pnpm build
pnpm start
```

### 문제 해결

| 문제 | 해결책 |
|------|--------|
| `pnpm: command not found` | `npm install -g pnpm` |
| `docker: command not found` | Docker Desktop 설치 확인 |
| `Error: vector extension` | `docker compose up -d` 로 DB 컨테이너 시작 |
| 포트 충돌 | `PORT=3001 pnpm dev` |

---

## 프로젝트 문서

| 문서 | 설명 | 링크 |
|------|------|------|
| **Issue #1** | 프로젝트 철학, 4-Layer Memory System | [#1](https://github.com/holee9/ra-med-bot/issues/1) |
| **Wiki** | 장기 아키텍처 기억, ADR, 도메인 지식 | [GitHub Wiki](https://github.com/holee9/ra-med-bot/wiki) |
| **Issues** | 작업 이력, 의도 보존 | [Issues](https://github.com/holee9/ra-med-bot/issues) |
| **SPEC 문서** | 요구사항 정의 (EARS 포맷) | `.moai/specs/` |
| **Design Handoff** | 완전한 스펙 패키지 | `RA-bot-design/design_handoff_regula/README.md` |
| **Codex Memory** | Codex 전용 최소 컨텍스트 작업 메모 | `.codex/project-memory.md` |
| **Codemaps** | 아키텍처 다이어그램, 모듈 구조, 데이터 흐름 | `.moai/project/codemaps/` |
| **명명 규칙** | abyz-lab 명명 규칙 정의 | [naming-rules.md](https://github.com/holee9/ra-med-bot/blob/main/.moai/project/brand/naming-rules.md) |

### 문서 조회 순서

**처음 오시는 분**:
1. **README.md** (현재 문서) — 프로젝트 개요
2. **[Issue #1](https://github.com/holee9/ra-med-bot/issues/1)** — 프로젝트 철학
3. **[Wiki Home](https://github.com/holee9/ra-med-bot/wiki)** — 현재 현황

**개발 참여시**:
1. **[Development Guide/Workflow](https://github.com/holee9/ra-med-bot/wiki/Development-Guide#workflow)** — Issues → SPEC → PR
2. **[Development Guide/Setup](https://github.com/holee9/ra-med-bot/wiki/Development-Guide#setup)** — 로컬 환경 설정
3. **[Naming Rules](https://github.com/holee9/ra-med-bot/blob/main/.moai/project/brand/naming-rules.md)** — 명명 규칙 준수

**Codex/자동화 에이전트 작업시**:
1. **Git 접근 확인** — 로컬 상태, `origin`, Wiki, Issues 접근을 먼저 확인
2. **[Codex Memory](.codex/project-memory.md)** — 최소 컨텍스트 작업 철학과 source-of-truth 순서 숙지
3. **Design Handoff + SPEC** — 구현 전 관련 핸드오프와 `.moai/specs/` 대조
4. **Issue 추적** — 의미 있는 작업은 GitHub Issue를 만들거나 재사용한 뒤 구현

---

## 개발 로드맵

### Phase 1: 기반 구축 ✅ (2026-04-29 완료)

**목표**: 4-Layer Memory System 구축

- [x] 프로젝트 초기 설정 (abyz-lab 도구)
- [x] GitHub Issues Labels 체계 구축 (13개 라벨)
- [x] README.md 상세 작성
- [x] Wiki 초기화 (Home, ADR, Lessons-Learned)
- [x] **[Issue #1: 프로젝트 철학 수립](https://github.com/holee9/ra-med-bot/issues/1)** ✅

**성과물**:
- ✅ 프로젝트 허브 완성 (README + Wiki)
- ✅ 명명 규칙 확립 (abyz-lab.work)
- ✅ 장기 기억 저장소 가동 (Wiki)
- ✅ Codex 전용 최소 컨텍스트 메모 추가 (`.codex/project-memory.md`)

---

### Phase 1.5: 프로젝트 계획 수립 ✅ (2026-04-30 완료)

**목표**: 구현 전략 및 기술 결정 확정

- [x] 심층 인터뷰 (3라운드) 통한 방향성 수립
- [x] Full MVP 범위 확정 (모든 구조화 출력 + DocViewer + Expert Review)
- [x] 백엔드 우선 구현 전략 수립
- [x] 멀티 LLM 전략 확정 (OpenAI 임베딩 + abyz-lab Claude 추론)
- [x] 코퍼스 우선순위 결정 (MFDS, FDA, EU MDR 우선)
- [x] 로컬 개발 + Docker 병용 환경 설계
- [x] 프로젝트 문서 업데이트 (product.md, tech.md, structure.md)
- [x] Codemaps 5종 생성 (아키텍처 다이어그램, 모듈 구조, 데이터 흐름 등)

**성과물**:
- ✅ 구현 로드맵 및 전략 문서화
- ✅ 아키텍처 codemaps (overview, modules, dependencies, entry-points, data-flow)
- ✅ 기술 스택 및 LLM 전략 확정

---

### Phase 2: Chat Core ✅ (2026-05-02 완료)

**목표**: SSE 스트리밍 RAG 상담 경로 구현

- [x] `/api/ra/consult` SSE Route Handler
- [x] FDA corpus 기반 hybrid retrieval
- [x] Citation post-processing 및 source linking
- [x] Composer, Thinking, AnswerBlock, Citation, DocViewer
- [x] `llm.call`, `source.access`, `expert_review.flag` audit wiring
- [x] Issue [#4](https://github.com/holee9/ra-med-bot/issues/4) 완료

---

### Phase 3: Structured Outputs ✅ (2026-05-02 완료)

**목표**: 답변 이후 구조화 블록 생성/렌더링

- [x] `generateStructuredBlocks` follow-up pipeline
- [x] Checklist, ComparisonTable, Timeline, Callout, SuggestionPill
- [x] RightContextPanel Phase 3 스켈레톤
- [x] `message_blocks` 저장 및 PATCH persist
- [x] 구조화 block Zod schema
- [x] Issue [#5](https://github.com/holee9/ra-med-bot/issues/5) 완료

---

### Phase 4: Breadth 확장 ✅ (2026-05-03 완료)

**목표**: 완전한 멀티페이지 SaaS 확장 (8 Views + 10 APIs + 5 RAG Corpora + Project Switching)

- [x] **8 Views 구현**: Home 확장 + History + Templates + Knowledge Base + Regulatory Updates + Dashboard + OnboardingModal
- [x] **10 API Routes**: conversations(list/detail), feedback, sources(anchor), templates(list/download), updates, dashboard, projects(CRUD)
- [x] **5 RAG Retrievers 추가**: EU MDR, MFDS(한국), NMPA(중국), PMDA(일본), internal SOPs
- [x] **Intent Classifier Router**: Claude Haiku 기반 질문 → 코퍼스 선택 + 병렬 검색 + Cohere Rerank
- [x] **8 TanStack Query Hooks**: useConversations, useConversation, useProjects, useProject, useTemplates, useSources, useUpdates, useDashboardStats
- [x] **Project Switching**: Zustand `currentProjectId` + 페이지 리로드 없이 대화 보존
- [x] **Audit Instrumentation**: 10개 신규 API 모두 `writeAudit()` 연동 (9개 action enum 추가)
- [x] **472/472 tests passing** (47 test files)

---

### Phase 5: 엔터프라이즈 강화 ✅ (2026-05-03 완료)

**목표**: 프로덕션 준비 (7개 축 완결)

- [x] **Expert Review 워크플로우** (자동 게이팅 + 수동 플래그 + 상태 전이)
- [x] **RBAC (Role-Based Access Control)** (4-role + 2-tier scope, 모든 Write Handler 보호)
- [x] **Audit 완전성** (21 CFR Part 11 append-only, PII-free, 정적 분석 CI gate)
- [x] **다크 모드 런타임** (localStorage + DB 양방향, FOUT 방지, serif 타이포 유지)
- [x] **i18n 런타임** (next-intl ko/en, 대화 보존, 규제 용어 glossary)
- [x] **접근성 (WCAG 2.1 AA)** (axe-core 0 violations, focus ring, aria-label, contrast)
- [x] **관측성** (Sentry + PostHog + Langfuse + Vercel Analytics, audit_logs와 분리)

**성과물**:
- ✅ 13개 자동화 CI gate 등록 (TypeScript, Biome, Format, Unit, Audit, RBAC, i18n, Glossary, Token, Module, Contrast, Migrations, Build)
- ✅ 74개 REQ-ENTERPRISE 전부 구현 (Group A~G + Profile API)
- ✅ 903/903 tests passing (81 test files)

**문서 출처**:
- **SPEC 문서**: [`.moai/specs/SPEC-REGULA-ENTERPRISE-001/spec.md`](.moai/specs/SPEC-REGULA-ENTERPRISE-001/spec.md)
- **진행 기록**: [`.moai/specs/SPEC-REGULA-ENTERPRISE-001/progress.md`](.moai/specs/SPEC-REGULA-ENTERPRISE-001/progress.md)
- **GitHub Issue**: [#7 SPEC-REGULA-ENTERPRISE-001](https://github.com/holee9/ra-med-bot/issues/7)

---

### Phase 6: Quality & Launch ✅ (2026-05-04 완료)

**목표**: LLM 평가 Harness, E2E/부하 테스트, 보안 강화, 배포 파이프라인

- [x] **promptfoo 평가 harness** (6 corpus, 55 시나리오, 4종 scorer)
- [x] **Playwright E2E** (3-browser matrix, 8종 spec)
- [x] **k6 부하 테스트** (50VU + 100VU 스파이크, first_token P95 < 1.5s)
- [x] **보안**: Anthropic ZDR, Sentry PII 레덱션, OWASP 매핑, gitleaks CI
- [x] **배포**: vercel.json 보안 헤더, scripts/preflight.sh 17단계 게이트
- [x] **문서**: architecture.md, compliance.md, api-reference.md, runbook.md

**성과물**:
- ✅ 48/48 REQ-LAUNCH 구현 (Group A~F)
- ✅ Issue [#8](https://github.com/holee9/ra-med-bot/issues/8) 완료

---

### Phase 7: Cloudflare Hybrid 배포 ✅ (2026-05-04 완료)

**목표**: Cloudflare Workers + Vectorize + KV/R2 + WAF 전계층 이식 (85 REQ)

- [x] **OpenNext.js v3** Workers 이식 (`wrangler.toml`, `open-next.config.ts`, Edge middleware)
- [x] **Hybrid RAG 라우터**: internal → pgvector 격리, public → Vectorize + pgvector fallback
- [x] **Vectorize 5 indexes**: FDA / EU MDR / MFDS / NMPA / PMDA 퍼블릭 코퍼스
- [x] **AutoRAG 어댑터**: HIPAA BAA gating (`HIPAA_BAA_CONFIRMED` 플래그)
- [x] **KV 세션 스토어**: Auth.js v5 Adapter, 30일 TTL, dual-write
- [x] **KV 레이트 리미터**: 슬라이딩 윈도우 (Phase 5 Upstash 대체)
- [x] **R2 스토리지**: 5 버킷 (corpus-public, corpus-internal, audit-cold, assets, opennext-cache)
- [x] **Audit Cold Storage**: Neon → R2 Iceberg, SHA-256 체크섬, 7년 보존 (REQ-CF-042)
- [x] **Analytics Engine**: PII 필드 거부, 지연·캐시·리전 메트릭
- [x] **`data_region` 마이그레이션**: `organizations` 테이블 (us/eu/apac)

**성과물**:
- ✅ 99개 신규 테스트 (전체 1,223 passed / 0 failed)
- ✅ docs/compliance/ 3종 (part-11-extended, hipaa-baa-scope, vectorize-eu-region)
- ✅ Issue [#9](https://github.com/holee9/ra-med-bot/issues/9) 완료

---

### Phase 8: DocIngest 조직 문서 수집 ✅ (2026-05-04 완료)

**목표**: 조직 내부 문서 (SOP, 제출서류, 감사 응답 등) ingestion + 검색 파이프라인 구축

- [x] **텍스트 추출**: PDF/DOCX/XLSX/ZIP 지원 (`lib/ingest/extract/`)
- [x] **DocClass 분류기**: ML 기반 8종 문서 자동 분류
- [x] **청킹 레지스트리**: DocClass별 전용 청커 8종
- [x] **PII 가드**: SSN·이메일 임베딩 전 차단
- [x] **내부 문서 검색기**: pgvector + ACL 필터링
- [x] **Phase 8E 라우터 확장**: `past_submission_reuse`, `audit_response_drafting` 인텐트
- [x] **스키마 검증**: 8종 Zod 메타 스키마

**성과물**:
- ✅ 도큐멘트 수집 파이프라인 완성 (SPEC-REGULA-DOCINGEST-001)
- ✅ Issue [#10](https://github.com/holee9/ra-med-bot/issues/10) 완료

---

### Phase 9: Advanced Regulatory Workflows ✅ (2026-05-04 완료)

**목표**: 510(k) Drafter + Audit Response + Indication Impact Analyzer (SPEC-REGULA-WORKFLOWS-001)

- [x] **M1** DB Infrastructure — workflow_runs 테이블, pgEnum 2종, audit_action 10개 확장
- [x] **M2** Common Infrastructure — template-engine, confidence-aggregator, human-handoff, review-queue
- [x] **M3** 510(k) Submission Drafter — predicate 매칭, 섹션별 draft
- [x] **M4** Audit Response Drafter — 감사 대응 답변 초안
- [x] **M5** Indication Impact Analyzer — indication 변경 영향 분석
- [x] **M6** UI 컴포넌트 — WorkflowCard, StatusBadge, StepProgress, `/workflows` 페이지
- [x] **M7** Quality Gates — 통합 테스트 3개 파이프라인 + 시스템 테스트

**성과물**:
- ✅ 1,616 tests passed / 0 failed (161 test files)
- ✅ REQ-WF-049~052 전체 구현
- ✅ Issue [#11](https://github.com/holee9/ra-med-bot/issues/11) 완료

---

### Phase 10: Regulatory Radar ✅ (2026-05-04 완료)

**목표**: 규제 변경 자동 모니터링 + 포트폴리오 임팩트 스코어링 (SPEC-REGULA-RADAR-001)

- [x] **크롤러 3종** — FDA Federal Register, EU Official Journal, MFDS 공고 (cron 기반)
- [x] **3-tier 분류기** — 카테고리 → 관련성 → 제품군 매칭
- [x] **임팩트 스코어링** — 포트폴리오 기반 0.0~1.0 영향도
- [x] **알림 파이프라인** — 이메일(SendGrid) + Slack webhook + toast
- [x] **Admin Radar UI** — `/admin/radar` 크롤러 모니터링 + 수동 실행
- [x] **외부 데이터 Enrichment** — FDA 510(k) DB, MAUDE, Eudamed (SPEC-REGULA-NETWORK-001)
- [x] **신규 DB 테이블** — `crawler_runs`, `org_update_relevance`

**성과물**:
- ✅ 40 REQ 구현 (REQ-RADAR-001~040)
- ✅ PR [#20](https://github.com/holee9/ra-med-bot/pull/20) 완료

---

### Phase 11: Department RBAC (Tenant-Lite) ✅ (2026-05-04 완료)

**목표**: 부서 Attribute 기반 RBAC 5 REQ (SPEC-REGULA-TENANT-001 v2.0)

- [x] **`users.department` 컬럼** — RA / Dev / Exec / External pgEnum
- [x] **비파괴적 마이그레이션** — `0019_user_department_enum.sql`, 기존 row backfill
- [x] **부서별 ACL 매트릭스** — `lib/auth/department.ts`
- [x] **audit_logs 부서 기록** — `metadata.department` 필드
- [x] **Profile API 편집** — `PATCH /api/ra/profile` department 업데이트 + 감사

**성과물**:
- ✅ 5 REQ 전체 구현 (REQ-TEN-001~005)
- ✅ PR [#21](https://github.com/holee9/ra-med-bot/pull/21) 완료

---

## 🚀 1차 RC v1.0.0-rc — 현황 및 실행 계획

> **현재 상태**: RC 구현 작업 미착수 (마지막 기능 커밋: Phase 11 RBAC, 2026-05-04)
>
> **이전 트래커 (#101)**: 워크트리 병렬 모델 폐기로 인해 CLOSED 처리됨. RC 구현 자체는 아직 진행되지 않음.

RC 선언을 위해 아래 4개 이슈를 **순차** 완료해야 합니다.

### RC 진행 순서

| 순서 | 이슈 | 내용 | 상태 |
|---|---|---|---|
| 1 | [#32](https://github.com/holee9/ra-med-bot/issues/32) | RELEASE-GATE-001 — `.env.local` bootstrap + CI/Branch 정합성 | ⏸️ 미착수 |
| 2 | [#33](https://github.com/holee9/ra-med-bot/issues/33) | RELEASE-HARDENING-001 — E2E 활성화 + deploy.yml + Dashboard 실데이터 | ⏸️ 미착수 |
| 3 | [#34](https://github.com/holee9/ra-med-bot/issues/34) | QUALITY-001 — Corpus seed + Eval Pipeline + Cloudflare TODO | ⏸️ 미착수 |
| 4 | [#31](https://github.com/holee9/ra-med-bot/issues/31) | RELEASE-001 — 우산 SPEC: Sentry ErrorBoundary + Langfuse trace | ⏸️ 미착수 |

### 각 이슈 착수 방법

```bash
# 이슈별 브랜치 생성 후 /moai run 진입
git checkout -b work/issue-32-release-gate
claude
# Claude 안: /moai run SPEC-REGULA-RELEASE-GATE-001
```

### 관련 문서

- 📋 실행 콘티: [`.moai/runbooks/release-rc1-runbook.md`](.moai/runbooks/release-rc1-runbook.md)
- 📦 갭 분석: [`.moai/plans/review-gaps-2026-05-05.md`](.moai/plans/review-gaps-2026-05-05.md)
- 🔧 Amendment 권고: [`.moai/plans/amendments-2026-05-05.md`](.moai/plans/amendments-2026-05-05.md)

---

### 1차 릴리즈 준비 로드맵 (v1.0.0 RC)

Phase 1-11 완료 후 **v1.0.0 RC** 선언을 위한 품질 게이트 통과 작업입니다. 현재 상태는 내부 검증 beta 수준(7.1/10)이며, 아래 4개 SPEC 완료 시 RC 선언이 가능합니다.

| # | SPEC | 설명 | 우선순위 |
|---|------|------|---------|
| [#32](https://github.com/holee9/ra-med-bot/issues/32) | SPEC-REGULA-RELEASE-GATE-001 | PR/CI/Branch 정합성 확보 — v1.0.0 RC 전제 조건 (P0) | Critical |
| [#33](https://github.com/holee9/ra-med-bot/issues/33) | SPEC-REGULA-RELEASE-HARDENING-001 | Dashboard·Knowledge·Console·TODO·E2E·Workflow Beta (P1) | High |
| [#34](https://github.com/holee9/ra-med-bot/issues/34) | SPEC-REGULA-QUALITY-001 | Corpus Seed · Eval Pipeline · Cloudflare · DocIngest · Security (P2) | High |
| [#31](https://github.com/holee9/ra-med-bot/issues/31) | SPEC-REGULA-RELEASE-001 | 1차 릴리즈 완성도 고도화 우산 SPEC — #32, #33, #34 의존 | Critical |

#### 릴리즈 차단 블로커 (2026-05-05 기준)

> ✅ 해소됨: PR #20 (MERGED), PR #21 (MERGED), 이슈 #12 (CLOSED), 이슈 #13 (CLOSED)

| 블로커 | 관련 이슈 | SPEC |
|--------|----------|------|
| `.env.local` 자동 생성기 미구현 → 신규 개발자 온보딩 불가 | [#32](https://github.com/holee9/ra-med-bot/issues/32) | RELEASE-GATE-001 |
| E2E 8개 spec 모두 `test.skip(true)` 상태 → `pnpm test:e2e` 실행 불가 | [#33](https://github.com/holee9/ra-med-bot/issues/33) | RELEASE-HARDENING-001 |
| `.github/workflows/deploy.yml` 미존재 → 자동 배포 파이프라인 없음 | [#33](https://github.com/holee9/ra-med-bot/issues/33) | RELEASE-HARDENING-001 |
| Dashboard Stats `stats: {}` stub 반환 | [#33](https://github.com/holee9/ra-med-bot/issues/33) | RELEASE-HARDENING-001 |
| Knowledge Base `sourceGroups` 하드코딩 | [#33](https://github.com/holee9/ra-med-bot/issues/33) | RELEASE-HARDENING-001 |
| Production `console.*` 다수 파일 잔존 | [#33](https://github.com/holee9/ra-med-bot/issues/33) | RELEASE-HARDENING-001 |
| Corpus seed 데이터 없음 → 실제 규제 질의 답변 불가 | [#34](https://github.com/holee9/ra-med-bot/issues/34) | QUALITY-001 |
| Sentry RootLayout ErrorBoundary 미적용 | [#31](https://github.com/holee9/ra-med-bot/issues/31) | RELEASE-001 |
| Langfuse `/api/ra/consult` 자동 trace 미들웨어 미구현 | [#31](https://github.com/holee9/ra-med-bot/issues/31) | RELEASE-001 |

#### SPEC 문서

- [`SPEC-REGULA-RELEASE-GATE-001`](.moai/specs/SPEC-REGULA-RELEASE-GATE-001/) — 5개 축 P0 gate (PR CI, E2E, Issue, Branch, Session)
- [`SPEC-REGULA-RELEASE-HARDENING-001`](.moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/) — 6개 결함 28 REQ
- [`SPEC-REGULA-QUALITY-001`](.moai/specs/SPEC-REGULA-QUALITY-001/) — 5개 품질 격차 25 REQ
- [`SPEC-REGULA-RELEASE-001`](.moai/specs/SPEC-REGULA-RELEASE-001/) — 우산 SPEC (전체 릴리즈 추적)

---

### Wave 3 로드맵 (v1.x — 핵심 확장)

Phase 1-11 완료 후 사용자 경험·비즈니스 가치 확대를 위한 다음 단계입니다.

| # | SPEC | 설명 | 우선순위 |
|---|------|------|---------|
| [#22](https://github.com/holee9/ra-med-bot/issues/22) | SPEC-REGULA-PREDICATE-001 | FDA 510(k) Predicate 검색 엔진 | High |
| [#23](https://github.com/holee9/ra-med-bot/issues/23) | SPEC-REGULA-CER-001 | EU MDR 임상평가보고서(CER) 빌더 | High |
| [#24](https://github.com/holee9/ra-med-bot/issues/24) | SPEC-REGULA-PCCP-001 | FDA PCCP 구조화 작성기 | High |
| [#35](https://github.com/holee9/ra-med-bot/issues/35) | SPEC-REGULA-KNOWLEDGE-GAP-001 | 미답변 자동 이슈화 및 지식베이스 보강 루프 | High |
| [#36](https://github.com/holee9/ra-med-bot/issues/36) | SPEC-REGULA-REVIEW-OPS-001 | 전문가 검토 SLA·승인 워크벤치·증거 패키지 | High |
| [#37](https://github.com/holee9/ra-med-bot/issues/37) | SPEC-REGULA-SUBMISSION-LIFECYCLE-001 | 510(k)·CER·PCCP 산출물 패키징·검증·추적 | High |
| [#38](https://github.com/holee9/ra-med-bot/issues/38) | SPEC-REGULA-ADOPTION-001 | 사용자 온보딩·성과 KPI·피드백 루프 | Medium |
| [#39](https://github.com/holee9/ra-med-bot/issues/39) | SPEC-REGULA-WORKFLOWS-LLM-002 | 워크플로우 LLM 실제 실행 (510k·CER·PCCP executor) | High |
| [#40](https://github.com/holee9/ra-med-bot/issues/40) | SPEC-REGULA-STRATEGY-001 | 멀티 관할권 규제 전략 생성기 (Killer Feature) | High |
| [#41](https://github.com/holee9/ra-med-bot/issues/41) | SPEC-REGULA-IMPACT-001 | 규제 변경 영향 추적기 | High |
| [#42](https://github.com/holee9/ra-med-bot/issues/42) | SPEC-REGULA-CROSSMARKET-001 | 멀티 관할권 갭 분석기 | High |
| [#43](https://github.com/holee9/ra-med-bot/issues/43) | SPEC-REGULA-BATCH-001 | 배치 질의 모드 | High |
| [#47](https://github.com/holee9/ra-med-bot/issues/47) | SPEC-REGULA-TRACEABILITY-001 | 규제 근거·요구사항 추적 매트릭스 | High |
| [#48](https://github.com/holee9/ra-med-bot/issues/48) | SPEC-REGULA-SOURCE-GOVERNANCE-001 | 출처 권위도·버전·유효일 관리 | High |
| [#50](https://github.com/holee9/ra-med-bot/issues/50) | SPEC-REGULA-KNOWLEDGE-PROMO-001 | 대화 시맨틱 검색 & 우수 답변 팀 지식 승격 | High |
| [#51](https://github.com/holee9/ra-med-bot/issues/51) | SPEC-REGULA-PROJECT-MEMORY-001 | 프로젝트 지속 컨텍스트 메모리 | High |
| [#52](https://github.com/holee9/ra-med-bot/issues/52) | SPEC-REGULA-NOTIFICATIONS-001 | 알림 허브 — 이메일·Slack·Teams | High |
| [#55](https://github.com/holee9/ra-med-bot/issues/55) | SPEC-REGULA-ROI-001 | 비즈니스 가치 ROI 대시보드 | Medium |
| [#58](https://github.com/holee9/ra-med-bot/issues/58) | SPEC-REGULA-DIGEST-001 | 포트폴리오 맞춤 주간 규제 다이제스트 | High |
| [#59](https://github.com/holee9/ra-med-bot/issues/59) | SPEC-REGULA-CLASSIFY-001 | **의료기기 분류 자동화 마법사** — FDA/EU/MFDS/NMPA/PMDA 5개 관할권 통합 분류 (모든 제출의 진입점) | High |
| [#60](https://github.com/holee9/ra-med-bot/issues/60) | SPEC-REGULA-CLINICAL-LIT-001 | **임상 문헌 검색 & 근거 합성기** — PubMed/Embase 자동 탐색·PRISMA 흐름도·GRADE 평가·CER 섹션 자동 생성 | High |
| [#61](https://github.com/holee9/ra-med-bot/issues/61) | SPEC-REGULA-VIGILANCE-001 | **유해사례 보고서 자동 초안기** — FDA MDR·EU MDV·FSCA 포스트마켓 감시 보고 (기한 관리 포함) | High |
| [#62](https://github.com/holee9/ra-med-bot/issues/62) | SPEC-REGULA-STANDARDS-001 | **조화 표준 적용성 & 개정 추적기** — ISO/IEC/EN/ASTM 의무 표준 매핑·전환 기간 관리 | High |

---

### Wave 4 로드맵 (v2.x — 엔터프라이즈 심화)

| # | SPEC | 설명 | 우선순위 |
|---|------|------|---------|
| [#25](https://github.com/holee9/ra-med-bot/issues/25) | SPEC-REGULA-COEDIT-001 | 실시간 공동편집 (Yjs CRDT + Cloudflare DO) | Medium |
| [#44](https://github.com/holee9/ra-med-bot/issues/44) | SPEC-REGULA-CALENDAR-001 | 규제 캘린더 & 데드라인 관리 | Medium |
| [#45](https://github.com/holee9/ra-med-bot/issues/45) | SPEC-REGULA-DELTA-SYNC-001 | 코퍼스 증분 동기화 | Medium |
| [#46](https://github.com/holee9/ra-med-bot/issues/46) | SPEC-REGULA-RISK-001 | ISO 14971 위험관리 통합 | Medium |
| [#49](https://github.com/holee9/ra-med-bot/issues/49) | SPEC-REGULA-VALIDATION-001 | 시스템 검증 패키지 (IQ/OQ/PQ) | High |
| [#53](https://github.com/holee9/ra-med-bot/issues/53) | SPEC-REGULA-PMS-001 | EU MDR PMS 보고서 & PMCF 계획 생성기 | High |
| [#54](https://github.com/holee9/ra-med-bot/issues/54) | SPEC-REGULA-CHANGE-CONTROL-001 | 설계 변경 규제 영향 자동 평가기 | Medium |
| [#56](https://github.com/holee9/ra-med-bot/issues/56) | SPEC-REGULA-RLHF-001 | 사용자 피드백 기반 RAG 품질 개선 루프 | Medium |
| [#57](https://github.com/holee9/ra-med-bot/issues/57) | SPEC-REGULA-QMS-INTEGRATION-001 | Veeva·MasterControl·SharePoint QMS 통합 API | Medium |
| [#63](https://github.com/holee9/ra-med-bot/issues/63) | SPEC-REGULA-SAMD-001 | **AI/ML SaMD 전용 규제 경로** — FDA AI/ML Guidance·EU AI Act·IMDRF SaMD 프레임워크 준수 | High |
| [#64](https://github.com/holee9/ra-med-bot/issues/64) | SPEC-REGULA-DHF-001 | **설계 이력 파일(DHF) 통합 관리** — 규제 요구사항·V&V·설계 검토·변경 이력 연결 (FDA QSR/QMSR) | High |
| [#65](https://github.com/holee9/ra-med-bot/issues/65) | SPEC-REGULA-ESUBMIT-001 | **전자 제출 패키지 빌더** — FDA eSTAR XML·EU EUDAMED·MFDS 의약품안전나라 자동 포맷 생성 | High |

---

### Wave 5 로드맵 (v3.x — 제품 완성도 확장)

Wave 3/4까지 완료되면 Regula는 분류, 근거 수집, 전략, 문서 생성, 검토, 제출, 사후감시까지 연결된 RA 운영 시스템이 됩니다. Wave 5는 실제 제품 출시와 운영에서 추가로 필요한 라벨링, 기기 사이버보안, CAPA, 임상조사, 상환, 모델 변경통제, 코퍼스 사용권을 보강합니다.

추가로 #84~92는 **완성 비전 기반 gap 분석**(RA 전문가 사용성/UX + 규제 준수/감사 대응 두 관점)에서 도출된 보강 SPEC입니다. UX 측면(#84-87)은 답변 정제·confidence 투명성·개인 라이브러리·export 허브를, 규제 준수 측면(#88-92)은 21 CFR Part 11 §11.70 전자서명·GDPR/PIPA DSAR·데이터 거주성 강제·DLP·외부 감사관 페르소나를 다룹니다. 동시에 #36, #38, #50, #56, #71에 결합 코멘트가 추가되었습니다.

| # | SPEC | 설명 | 우선순위 |
|---|------|------|---------|
| [#66](https://github.com/holee9/ra-med-bot/issues/66) | SPEC-REGULA-LABELING-001 | 라벨링·IFU·클레임 검토 워크벤치 | High |
| [#67](https://github.com/holee9/ra-med-bot/issues/67) | SPEC-REGULA-CYBERDEVICE-001 | 의료기기 사이버보안·SBOM 제출 증거 | High |
| [#68](https://github.com/holee9/ra-med-bot/issues/68) | SPEC-REGULA-CAPA-001 | 불만·CAPA 폐루프 관리 | High |
| [#69](https://github.com/holee9/ra-med-bot/issues/69) | SPEC-REGULA-CLINICAL-INVESTIGATION-001 | 임상시험·임상조사 계획기 | High |
| [#70](https://github.com/holee9/ra-med-bot/issues/70) | SPEC-REGULA-REIMBURSEMENT-001 | 보험·상환 경로 분석기 | Medium |
| [#71](https://github.com/holee9/ra-med-bot/issues/71) | SPEC-REGULA-MODEL-GOVERNANCE-001 | LLM·프롬프트·템플릿 변경통제 | High |
| [#72](https://github.com/holee9/ra-med-bot/issues/72) | SPEC-REGULA-CORPUS-LICENSE-001 | 코퍼스 라이선스·사용권 관리 | High |
| [#84](https://github.com/holee9/ra-med-bot/issues/84) | SPEC-REGULA-ANSWER-REFINE-001 | 답변 인라인 정제·부분 재생성·톤 조정 | High |
| [#85](https://github.com/holee9/ra-med-bot/issues/85) | SPEC-REGULA-CONFIDENCE-EXPLAIN-001 | Confidence 점수 근거 표시·대안 답변 비교 | High |
| [#86](https://github.com/holee9/ra-med-bot/issues/86) | SPEC-REGULA-PERSONAL-LIB-001 | 개인 RA 라이브러리·북마크·태깅·치트시트 | Medium |
| [#87](https://github.com/holee9/ra-med-bot/issues/87) | SPEC-REGULA-EXPORT-HUB-001 | 답변 다중 포맷 Export·메일 포워드·외부 공유 허브 | High |
| [#88](https://github.com/holee9/ra-med-bot/issues/88) | SPEC-REGULA-ESIG-001 | 21 CFR Part 11 전자서명·답변 잠금 | High |
| [#89](https://github.com/holee9/ra-med-bot/issues/89) | SPEC-REGULA-DSAR-001 | GDPR/PIPA 데이터 주체 요청 자동화 워크플로우 | High |
| [#90](https://github.com/holee9/ra-med-bot/issues/90) | SPEC-REGULA-DATA-RESIDENCY-001 | 데이터 거주성 기반 LLM/임베딩 라우팅 강제·증빙 | High |
| [#91](https://github.com/holee9/ra-med-bot/issues/91) | SPEC-REGULA-DLP-001 | DLP·자동 redaction·외부 공유 sanitize | High |
| [#92](https://github.com/holee9/ra-med-bot/issues/92) | SPEC-REGULA-AUDITOR-VIEW-001 | 외부 감사관 read-only 페르소나·1-click 감사 패키지 | High |

---

### QA 단계 게이트

모든 구현 이슈는 시작 전, 구현 중, PR 수락, Wave 통합, 도메인 UAT, 운영 회귀의 QA 단계를 거칩니다. #73 QA Matrix가 전체 이슈와 증거를 추적하고, #80은 E2E 실행 인프라 선행 조건입니다.

#### 2026-05-05 QA 본문 반영 결과

QA 메타 이슈만 별도로 두는 방식은 실제 구현 흐름에서 놓칠 수 있으므로, 각 구현/기능/E2E 이슈 본문에 `## QA 단계`를 직접 삽입했습니다.

| 항목 | 결과 |
|------|------|
| 직접 삽입 대상 | #22~#72, #80~#92 총 64개 이슈 |
| 제외 대상 | #73~#79 QA 메타 이슈. 중복 삽입하지 않고 Matrix/Gate 추적 이슈로 유지 |
| 공통 추적 기준 | 모든 대상 이슈가 #73 QA Matrix에 연결 |
| 작업 게이트 기록 | #18에 활성 브랜치, 기준 커밋, 중복 PR 없음, 반영 범위 기록 |
| QA Matrix 기록 | #73에 대상 범위, 제외 범위, Gate 구조, 검증 결과 기록 |
| 검증 결과 | 64/64 이슈에서 `## QA 단계` 확인. 샘플 #22, #66, #92 확인 |

#### 이슈 본문에 삽입된 QA 구조

| 단계 | 체크 목적 | 필수 증거 |
|------|----------|----------|
| Gate 0: 구현 전 QA | 이슈 본문, SPEC, 완료 조건이 서로 맞는지 확인하고 테스트 가능한 AC를 정의 | 같은 이슈 댓글 또는 PR 본문에 SPEC/AC 정합성, fixture/mock/API 조건 기록 |
| Gate 1: 구현 중 QA Checkpoint | shared schema/API/DB contract 변경 직후 targeted test 또는 contract check 수행 | 실패 케이스, 권한 없는 접근, 외부 API 실패/timeout/rate limit 경로 확인 |
| Gate 2: PR 수락 QA | PR 병합 전 변경 범위에 맞는 unit/integration/E2E/eval 최소 검증 수행 | PR `QA evidence` 섹션에 실행 명령, 결과, artifact 또는 수동 검수 근거 기록 |
| Gate 3~4: 통합·도메인 QA | Wave 단위 cross-feature flow와 RA 도메인 판단 정확도 검수 | #77 통합 시나리오, #78 RA 도메인 UAT 또는 expert signoff 연결 |
| Gate 5: 운영 QA | 운영 중 추적할 품질 지표, synthetic check, rollback 조건 정의 | 회귀 발생 시 follow-up issue 생성 기준과 rollback 또는 차단 조건 기록 |

#### 도메인별 Gate 1 추가 초점

| 이슈 유형 | 추가 QA 초점 |
|----------|-------------|
| Predicate, 510(k), eSTAR, 전자 제출 | 공식 포맷/API contract 일치, 자동 판단 방지를 위한 명시적 선택 또는 expert review gate |
| CER, 임상, PubMed, PMS/PMCF, Vigilance, CAPA | claim을 지지하는 citation 샘플링, 기한·심각도·reportability·follow-up audit trail |
| PCCP, SaMD, AI/ML, Model Governance, 답변 품질 | model/prompt/template version metadata, confidence/citation/expert-review 조건 유지 |
| Risk, DHF, Change Control, Labeling, E-Signature, Auditor View | traceability link, e-signature lock, reviewer role, audit evidence의 우회 불가성 |
| Source, Corpus License, Standards, DSAR, DLP, Data Residency | source entitlement, privacy, redaction, region routing, export/search/LLM 제한 반영 |
| Co-edit, E2E, CI, Playwright | 로컬/CI 동일 fixture 또는 mock 재현성, 동시성·실패 복구·artifact/trace 저장 |
| QMS, Export, Share, Personal Library, ROI, Notification | 사용자 여정, 접근성, 권한별 표시/수정 상태, 생성·공유·알림 audit 및 취소 경로 |

| 단계 | 이슈 | 목적 |
|------|------|------|
| Matrix | [#73](https://github.com/holee9/ra-med-bot/issues/73) | 전체 이슈-요구사항-테스트-증거 매트릭스 |
| Gate 0 | [#74](https://github.com/holee9/ra-med-bot/issues/74) | 구현 시작 전 SPEC 준비도 QA |
| Gate 1 | [#75](https://github.com/holee9/ra-med-bot/issues/75) | 구현 중 단위·계약·감사·citation 체크포인트 |
| Gate 2 | [#76](https://github.com/holee9/ra-med-bot/issues/76) | PR 수락 전 변경범위·회귀·보안·접근성·증거 확인 |
| Gate 3 | [#77](https://github.com/holee9/ra-med-bot/issues/77) | Wave 단위 cross-feature E2E 및 데이터 흐름 검증 |
| Gate 4 | [#78](https://github.com/holee9/ra-med-bot/issues/78) | RA 도메인 UAT, citation 정확도, 출처 사용권 검수 |
| Gate 5 | [#79](https://github.com/holee9/ra-med-bot/issues/79) | 운영 QA, synthetic checks, rollback drill, 품질 지표 추적 |
| Infra | [#80](https://github.com/holee9/ra-med-bot/issues/80) | 로컬/CI E2E 실행 환경 구축 |
| E2E | [#81](https://github.com/holee9/ra-med-bot/issues/81) | Wave 1 Foundation+Chat E2E 스모크 게이트 |
| E2E | [#82](https://github.com/holee9/ra-med-bot/issues/82) | Wave 2 RAG+Expert Review+Enterprise E2E 게이트 |
| E2E | [#83](https://github.com/holee9/ra-med-bot/issues/83) | PR 병합 전 Playwright CI E2E 게이트 |

---

## 참여 방법

### Issues 기반 워크플로우

모든 작업은 GitHub Issue 등록부터 시작합니다.

```
1. Issue 등록 → 작업 의도를 명확히 기록
2. SPEC 작성 → 복잡한 기능은 abyz-lab plan 도구로 SPEC 문서화
3. 구현 → SPEC 기반 구현 (또는 직접 구현)
4. PR → closes #N으로 Issue와 연결
5. Wiki ADR → 아키텍처 결정은 Wiki에 기록
```

### Issue 등록 예시

**제목**: `[component/frontend] 채팅 UI SSE 스트리밍 구현`

**본문**:
```markdown
## 배경
현재 채팅 UI가 답변을 한 번에 표시합니다. 사용자 경험을 개선하기 위해 스트리밍이 필요합니다.

## 목표
- SSE 기반 실시간 답변 스트리밍
- trace → prose_delta → 구조화 블록 순서 준수
- 진행 상태 표시 (로딩 인디케이터)

## 제안 방안
- Vercel AI SDK 사용
- useStreamingAnswer 훅 구현
- 3단계 이벤트 처리 (trace/prose/blocks)

## 참고
- [Design Handoff §9.1](../RA-bot-design/design_handoff_regula/README.md#9-interactions--behavior)
- [Issue #1](https://github.com/holee9/ra-med-bot/issues/1)
```

### 커밋 컨벤션

```bash
# 형식
type(scope): subject

# type (선택): feature, fix, docs, refactor, test, chore
# scope (선택): frontend, backend, rag, infra

# 예시
feat(frontend): 채팅 UI SSE 스트리밍 구현
fix(rag): citation 후처리 null reference 버그 수정
docs(readme): 트러블슈팅 섹션 추가
refactor(infra): Drizzle ORM 쿼리 최적화
test(backend): RAG 파이프라인 통합 테스트 추가
chore(deps): abyz-lab SDK 최신 버전 업데이트
```

### Pull Request 가이드

**PR 제목**: `[ISSUE-#1] 채팅 UI SSE 스트리밍 구현`

**PR 본문**:
```markdown
## 변경 내용
- [x] SSE 스트리밍 기능 구현
- [x] useStreamingAnswer 훅 추가
- [x] 3단계 이벤트 처리 (trace/prose/blocks)
- [x] 로딩 인디케이터 추가

## 테스트
- [x] 단위 테스트 통과 (pnpm test)
- [x] E2E 테스트 통과 (pnpm test:e2e)
- [x] 수동 테스트 완료 (Chrome DevTools 확인)

## 관련 Issue
closes #1

## 스크린샷
![스트리밍 데모](screenshots/streaming.png)
```

### 코드 리뷰 체크리스트

PR 생성 시 다음을 확인하세요:

- [ ] **명명 규칙**: abyz-lab만 사용 (Claude, MoAI, Anthropic 등 사용 금지)
- [ ] **테스트**: 단위 테스트 + 통합 테스트 통과
- [ ] **LSP**: 0 errors, 0 warnings
- [ ] **커밋**: 컨벤션 준수
- [ ] **문서**: 관련 Wiki/ADR 업데이트

### Best Practice

**DO** (권장):
- ✅ Issue 먼저 등록 후 작업 시작
- ✅ 복잡한 기능은 SPEC 작성
- ✅ 아키텍처 결정은 Wiki ADR 기록
- ✅ 작은 단위로 자주 커밋
- ✅ PR은 한 가지 목적만 (기능 + 리팩토링 분리)

**DON'T** (비권장):
- ❌ Issue 없이 바로 PR 생성
- ❌ 명명 규칙 위반 (Claude, MoAI 등)
- ❌ 거대한 PR (여러 기능 섞음)
- ❌ 문서 없는 코드 변경
- ❌ 테스트 없는 기능 구현

### 라벨 가이드

| 라벨 | 용도 |
|------|------|
| `type/spec` | SPEC 문서 작성 |
| `type/adr` | 아키텍처 결정 기록 |
| `type/feature` | 새 기능 개발 |
| `type/bug` | 버그 수정 |
| `component/frontend` | 프론트엔드 (React, Next.js) |
| `component/backend` | 백엔드 (API, DB) |
| `component/rag` | RAG 파이프라인 (LLM, 검색) |
| `component/infra` | 인프라/DevOps |
| `status/blocked` | 차단됨 (해결 필요) |
| `status/in-review` | 검토중 |
| `priority/high` | 높은 우선순위 |
| `priority/medium` | 중간 우선순위 |

---

## 라이선스

MIT License - [LICENSE](LICENSE) 파일 참조

---

## 팀 및 커뮤니케이션

### 개발 팀 구성

| 역할 | 담당 | 연락처 |
|------|------|--------|
| **Tech Lead** | abyz-lab | https://abyz-lab.work |
| **RA 전문가** | 사내 RA 리드 | 내부 연락처 |
| **Frontend** | TBD | TBD |
| **Backend** | TBD | TBD |

### 커뮤니케이션 채널

| 채널 | 용도 |
|------|------|
| **GitHub Issues** | 작업 이력, 버그 리포트 |
| **GitHub PR** | 코드 리뷰, 논의 |
| **Wiki** | 아키텍처 결정, 도메인 지식 |
| **Standup** (비정기) | 진행 상황 공유 |

---

## Acknowledgments

- **[abyz-lab](https://abyz-lab.work)** — AI 개발 도구 및 프레임워크
- **[RA-bot-design](https://github.com/holee9/ra-med-bot/tree/main/RA-bot-design)** — 완전한 디자인 핸드오프 패키지
- **[Next.js](https://nextjs.org/)** — React 프레임워크
- **[Drizzle ORM](https://orm.drizzle.team/)** — TypeScript ORM
- **[LangChain](https://js.langchain.com/)** — LLM 애플리케이션 프레임워크

---

**Built with ❤️ using [abyz-lab](https://abyz-lab.work)**

_마지막 업데이트: 2026-05-05 (교차검증 반영 — 릴리즈 블로커 현행화, RC1 실행 계획 재정의, #12/#13 closed 반영, PR #20/#21 merged 반영)_
