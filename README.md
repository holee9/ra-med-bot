# Regula — 의료기기 RA 전문가 AI 챗봇

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Claude](https://img.shields.io/badge/Claude-Sonnet%204.5-orange)](https://www.anthropic.com/claude)

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
| **Evidence-first** | 모든 LLM 주장에 근거 문서 inline `<sup>N</sup>` citation 필수 |
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
    subgraph "Frontend (Next.js 15)"
        UI[User Interface]
        Chat[Chat Composer]
        Answer[AnswerBlock SSE Streaming]
        Sidebar[Project/History Sidebar]
    end

    subgraph "API Layer (Next.js Route Handlers)"
        Consult[/api/ra/consult POST]
        Conversations[/api/ra/conversations]
        Auth[Auth.js v5 SSO]
    end

    subgraph "RAG Pipeline (LangChain / LlamaIndex)"
        Router[Query Router<br/>Haiku 4.5]
        Retriever[Hybrid Retriever<br/>pgvector + FTS]
        Rerank[Cohere Rerank]
        Generator[Claude Sonnet 4.5<br/>Citation Forcing]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL 16 + pgvector)]
        S3[(S3/R2<br/>Doc Origins)]
        Vector[(Vector Store)]
        FTS[(Full-Text Search)]
    end

    subgraph "Regulatory Corpora"
        FDA[FDA]
        EU[EU MDR]
        MFDS[MFDS]
        NMPA[NMPA]
        PMDA[PMDA]
        ISO[ISO/IEC]
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
- **LLM**: Claude Sonnet 4.5 (추론), Claude Haiku 4.5 (분류/라우팅)
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

- Node.js 20+
- pnpm 10+
- PostgreSQL 16 + pgvector
- Anthropic API Key

### 설치

```bash
# 레포 클론
git clone https://github.com/holee9/ra-med-bot.git
cd ra-med-bot

# 의존성 설치
pnpm install

# 환경 변수 설정
cp .env.example .env.local
# .env.local에 ANTHROPIC_API_KEY, DATABASE_URL 등 설정

# DB 마이그레이션
pnpm drizzle-kit push

# 개발 서버 시작
pnpm dev
```

### 실행

```bash
# 개발 서버 (http://localhost:3000)
pnpm dev

# 빌드
pnpm build

# 프로덕션 시작
pnpm start
```

---

## 프로젝트 문서

| 문서 | 설명 | 링크 |
|------|------|------|
| **Wiki** | 장기 아키텍처 기억, ADR, 도메인 지식 | [GitHub Wiki](https://github.com/holee9/ra-med-bot/wiki) |
| **Issues** | 작업 이력, 의도 보존 | [Issues](https://github.com/holee9/ra-med-bot/issues) |
| **SPEC 문서** | 요구사항 정의 (EARS 포맷) | `.moai/specs/` |
| **Design Handoff** | 완전한 스펙 패키지 | `RA-bot-design/design_handoff_regula/README.md` |

---

## 개발 로드맵

### Phase 1: 기반 구축 ✅
- [x] 프로젝트 초기 설정 (MoAI-ADK, Claude Code)
- [x] GitHub Issues Labels 체계 구축
- [x] README.md 상세 작성
- [x] Wiki 초기화

### Phase 2: SPEC 작성 (진행 예정)
- [ ] 제품 요구사항 정의 (EARS)
- [ ] 아키텍처 결정 (ADR)
- [ ] 데이터 모델 설계

### Phase 3: MVP 구현 (계획)
- [ ] FDA corpus ingestion
- [ ] RAG 파이프라인 기본 구현
- [ ] Chat UI (Composer + AnswerBlock)
- [ ] Expert review 게이팅

### Phase 4: 확장 (계획)
- [ ] EU MDR/MFDS/NMPA/PMDA corpus 추가
- [ ] 사내 SOP ingestion
- [ ] 규제 업데이트 피드

---

## 참여 방법

### Issues 기반 워크플로우

모든 작업은 GitHub Issue 등록부터 시작합니다.

1. **Issue 등록**: 작업 의도를 명확히 기록
2. **SPEC 작성**: 복잡한 기능은 `/moai plan`으로 SPEC 문서화
3. **구현**: SPEC 기반 구현 (또는 직접 구현)
4. **PR**: `closes #N`으로 Issue와 연결
5. **Wiki ADR**: 아키텍처 결정은 Wiki에 기록

### 커밋 컨벤션

```
type(scope): subject

[type]: feature, fix, docs, refactor, test, chore
[scope]: frontend, backend, rag, infra

예시:
feat(frontend): 채팅 UI SSE 스트리밍 구현
fix(rag): citation 후처리에서 null reference 버그 수정
docs(readme): 시작 방법 섹션 추가
```

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

**Built with ❤️ using [MoAI-ADK](https://github.com/moai-kg/moai-adk-go)**
