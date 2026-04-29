# Regula — 의료기기 RA 전문가 AI 챗봇

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![abyz-lab](https://img.shields.io/badge/abyz--lab-Sonnet%204.5-orange)](https://abyz-lab.work)

> 규제(RA) 전문가 및 개발/QA 실무자가 규제 질의를 제출하면, **공식 규제 코퍼스와 사내 SOP를 교차 검색**하여 inline citation이 포함된 구조화 답변·체크리스트·비교표·타임라인을 즉시 제공하는 RAG 챗봇.

---

## 📋 목차

- [개요](#개요)
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

### AI / RAG
- **LLM**: abyz-lab Sonnet 4.5 (추론), abyz-lab Haiku 4.5 (분류/라우팅) | abyz-lab.work
- **Embedding**: OpenAI text-embedding-3
- **Orchestration**: LangChain / LlamaIndex (TS)
- **Reranking**: Cohere Rerank

### Infra
- **Hosting**: Vercel (frontend), Railway/Fly.io (worker)
- **CI/CD**: GitHub Actions
- **Observability**: Sentry (error), PostHog (analytics), Langfuse (LLM trace)

---

## 시작 방법

### 선행 조건

| 도구 | 버전 | 설치 확인 |
|------|------|----------|
| **Node.js** | 20+ | `node --version` |
| **pnpm** | 10+ | `pnpm --version` |
| **PostgreSQL** | 16+ | `psql --version` |
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
# DB 생성
createdb regula

# pgvector 확장 설치
psql -d regula -c "CREATE EXTENSION vector;"

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
| `psql: command not found` | PostgreSQL 설치 확인 |
| `Error: vector extension` | `psql -d regula -c "CREATE EXTENSION vector;"` |
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

---

### Phase 2: SPEC 작성 (진행 예정)

**목표**: 제품 요구사항 정의 (EARS 포맷)

- [ ] [Issue #2]: FDA Corpus Ingestion SPEC 작성
- [ ] 제품 요구사항 정의 (EARS)
- [ ] 아키텍처 결정 (ADR-001: 기술 스택)
- [ ] 데이터 모델 설계 (Drizzle Schema)
- [ ] API 계약 정의 (Zod 스키마)

**예상 기간**: 1주

---

### Phase 3: MVP 구현 (계획)

**목표**: 첫 번째 관할권 (FDA) RAG 파이프라인

- [ ] FDA corpus ingestion (21 CFR Part 820, Part 11)
- [ ] RAG 파이프라인 기본 구현
  - [ ] PDF 파싱 → chunking → embedding
  - [ ] pgvector 임베딩 + FTS 인덱싱
  - [ ] Hybrid retriever (vector + keyword)
- [ ] Chat UI (Composer + AnswerBlock)
- [ ] Expert review 게이팅 (신뢰도 < 0.70)

**예상 기간**: 2-3주

---

### Phase 4: 확장 (계획)

**목표**: 다중 관할권 지원

- [ ] EU MDR corpus ingestion
- [ ] MFDS corpus ingestion
- [ ] NMPA corpus ingestion
- [ ] PMDA corpus ingestion
- [ ] 사내 SOP ingestion
- [ ] 규제 업데이트 피드 (update-monitor)

**예상 기간**: 4-6주

---

### Phase 5: 엔터프라이즈 (계획)

**목표**: 프로덕션 준비

- [ ] 21 CFR Part 11 감사 로깅 (audit_logs)
- [ ] Row-Level Security (RLS)
- [ ] SSO (SAML/OIDC)
- [ ] Observability (Sentry + PostHog + Langfuse)
- [ ] 성능 최적화 (캐싱, CDN, RAG 파이프라인)

**예상 기간**: 3-4주

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

_마지막 업데이트: 2026-04-29_
