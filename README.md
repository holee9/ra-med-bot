# Regula — 의료기기 RA 전문가 AI 챗봇

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![abyz-lab](https://img.shields.io/badge/abyz--lab-Sonnet%204.5-orange)](https://abyz-lab.work)

> 사내 직원이 규제 질의를 제출하면, **MD-process(회사 정책·SOP)와 ra-project(RA 전문 지식베이스)를 Agent가 탐색**하여 팩트 기반·출처 명시 답변을 제공하는 전문 가이드 시스템. 단순 챗봇이 아닌 **두 지식 레포를 knowledge source로 통합 운영하는 인허가 전문 가이드**.
>
> 브레인스토밍 확정 문서: [`.moai/plans/brainstorming-2026-05-02.md`](.moai/plans/brainstorming-2026-05-02.md)

---

## 📋 목차

- [개요](#개요)
- [프로젝트 운영 철학](#프로젝트-운영-철학)
- [아키텍처](#아키텍처)
- [기술 스택](#기술-스택)
- [시작 방법](#시작-방법)
- [프로젝트 문서](#프로젝트-문서)
- [개발 로드맵](#개발-로드맵)
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
pnpm drizzle-kit push
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
- ✅ 14개 수동 QA 체크리스트 (Expert review flow, RBAC matrix, Dark mode, Locale, a11y, Observability)
- ✅ 74개 REQ-ENTERPRISE 전부 구현 (Group A~G + Profile API)
- ✅ 903/903 tests passing (81 test files)
- ✅ SPEC status: draft → completed
- 주의(2026-05-03 Issue #7 검증 이력): 로컬 `next build`는 장시간 hang으로 PASS 산정에서 제외했습니다. CI build gate는 workflow에 등록되어 있으나, 로컬 검증 결과와 분리해서 추적합니다.

**문서 출처**:
- **SPEC 문서**: [`.moai/specs/SPEC-REGULA-ENTERPRISE-001/spec.md`](.moai/specs/SPEC-REGULA-ENTERPRISE-001/spec.md)
- **진행 기록**: [`.moai/specs/SPEC-REGULA-ENTERPRISE-001/progress.md`](.moai/specs/SPEC-REGULA-ENTERPRISE-001/progress.md)
- **GitHub Issue**: [#7 SPEC-REGULA-ENTERPRISE-001](https://github.com/holee9/ra-med-bot/issues/7)

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

_마지막 업데이트: 2026-05-03_
