# 기술 명세 — Regula (v3)

> 버전: 3.0.0
> 최종 업데이트: 2026-07-02
> 개정 사유: v3 타겟 아키텍처 기반 재정의
> 기준 문서: docs/proposals/v3-architecture-revamp-plan-2026-07-02.md

---

## 기술 스택 전체도

| 카테고리 | 기술 선택 | v3 변경사항 |
|----------|----------|-----------|
| **Frontend** | Next.js 15 App Router, TypeScript 5.4+, React 18, Tailwind CSS v4, Radix UI, Zustand, TanStack Query v5, Vercel AI SDK | v3: components/ 전면 재작성, 3-tier PersonaBar |
| **Backend** | Next.js Route Handlers + SSE, Drizzle ORM, PostgreSQL 16 + pgvector, Auth.js v5 | v3: lib/kernel/ 추상화, schema 분할 |
| **AI / RAG** | **gx10 온프레미스 Ollama (gpt-oss:120b)**, per-corpus retrievers 5종, Cohere Rererk (legacy) | v3: 외부 API 제거 (#318), 온프레미스 단일화 |
| **자동화** | Inngest (cron + retry + audit trail) | v3: ingest pipeline delta-sync 완결 (Phase D) |
| **패키지 매니저** | pnpm | |

---

## 인프라 아키텍처

### 운영 환경

| 구성 요소 | 내용 | v3 변경사항 |
|-----------|------|-----------|
| **Bot 서버** | 중고 워스트레이션 + Ubuntu 22.04 LTS | 동일 유지 |
| **런타임** | Docker + Docker Compose | 동일 유지 |
| **데이터베이스** | PostgreSQL 16 + pgvector (Docker 컨테이너) | v3: audit_log previous_hash BYTEA 추가 |
| **민감 문서 보관** | NAS DS224+ (내부망 직접 연결) | 동일 유지 |
| **GitHub 동기화** | GitHub API + Inngest 스케줄러 | v3: 3레포 (ra-llm-wiki/MD-process/ra-project) |

> **Vercel·Railway·AWS 등 외부 클라우드 배포 없음.** 완전 내부망 운영.

### Docker Compose 구조

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: regula
      POSTGRES_USER: regula_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  regula:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://regula_user:${POSTGRES_PASSWORD}@postgres:5432/regula
      GX10_OLLAMA_BASE_URL: http://localhost:11434
    depends_on:
      - postgres

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
```

---

## v3 신규 기술 요소

### 1. Audit Hash Chain (BK-105)

```sql
-- v3 강화: previous_hash BYTEA 추가
CREATE TABLE audit_log (
  seq          BIGSERIAL PRIMARY KEY,
  ts           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor        TEXT NOT NULL,
  actor_user   UUID REFERENCES users(id),
  action       TEXT NOT NULL,
  target       TEXT NOT NULL,
  ip_addr      INET,
  meta         JSONB,
  previous_hash BYTEA NOT NULL,  -- v3 신규
  hash         BYTEA NOT NULL
);

-- 자동 hash chain 트리거 (기존 유지)
CREATE TRIGGER audit_log_hash_bi BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_hash_trigger();
```

**월간 검증 크론**: `verify-audit-chain` Inngest function, 월 1일 00:00 KST 실행.

### 2. BFF 정식 레이어 (lib/bff/)

**통합 방향**: 기존 6개 클라이언트를 `lib/bff/`로 이동하고, 공통 에러 처리, 재시도, 타임아웃, 인증 일원화.

```
lib/bff/
├── hybrid-ra-client.ts      ← Azure api-prod 서버 사이드
├── evidence-client.ts       ← Evidence API (브라우저 BFF)
├── traceability-client.ts   ← Traceability API (브라우저 BFF)
├── authoring-client.ts      ← Authoring API (브라우저 BFF)
├── checklist-client.ts      ← Checklist API
├── with-auth.ts             ← 공통 인증 헬퍼
├── error-handling.ts        ← HybridRaClientError, 재시도 정책
└── index.ts                 ← 공개 API
```

### 3. hybrid-ra-saas 연동 흐름 (6 integration points)

| # | Regula 측 | SaaS 측 | 방향 | 이슈 |
|---|----------|--------|---|------|
| 1 | `lib/domains/impact/` | Evidence API | Regula → SaaS | 변경 영향 평가 결과를 SaaS Evidence로 전송 (#168) |
| 2 | (아카이브) traceability | Traceability API | SaaS → Regula | SaaS가 노드/엣지 스캔 요청 (#169). 아카이브 후 어댑터로 우회 |
| 3 | `lib/domains/consult/` | Authoring API | Regula → SaaS | Consult 세션에서 초안 작성 시 SaaS Authoring 세션 생성 (#171) |
| 4 | `lib/domains/inbox/` | Hybrid-Ra API | 양방향 | 승인 답변을 SaaS로 전송, SaaS에서 리비전 동기화 (#156, #170) |
| 5 | `lib/domains/registry/` | Hybrid-Ra API | Regula → SaaS | 제품 마스터 동기화 (BK-033 자동 추출 결과) |
| 6 | `lib/kernel/audit/` | (없음) | Regula 내부 | 감사 로그는 SaaS로 전송 안 함 (21 CFR Part 11 내부 통제) |

### 4. v3 신규 데이터 모델

| v3 테이블 | schema 파일 | 마이그레이션 |
|---|---|---|
| `users` (role CHECK 제약 강화) | `schema-kernel.ts` | 기존 (확장: role CHECK 제약) |
| `inbox_tickets` | `schema-inbox.ts` (신규) | migration 0107 |
| `approved_answers` | `schema-inbox.ts` (신규) | migration 0108 |
| `products` + `product_markets` | `schema-registry.ts` (신규) | migration 0109 |
| `audit_log` (hash chain) | `schema-kernel.ts` (수정) | migration 0110 (previous_hash BYTEA 추가) |
| `embeddings` | `schema-ai.ts` | 기존 유지 (pgvector) |
| `submissions` | `schema-registry.ts` | migration 0111 |

---

## 재사용 인프라 (초과달성 보존)

### Per-corpus RAG Retrievers (5종)

- **FDA Retriever**: `lib/domains/ai/retrievers/fda-retriever.ts`
- **EU MDR Retriever**: `lib/domains/ai/retrievers/eu-mdr-retriever.ts`
- **MFDS Retriever**: `lib/domains/ai/retrievers/mfds-retriever.ts`
- **NMPA Retriever**: `lib/domains/ai/retrievers/nmpa-retriever.ts`
- **PMDA Retriever**: `lib/domains/ai/retriever/pmda-retriever.ts`

### Delta-sync (Phase D 완결)

- `lib/domains/knowledge-sources/sync.ts`: delta-sync orchestrator (runDeltaSync)
- `lib/ingest/source-sections-upsert.ts`: shared helper (Issue 314)
- **Inngest cron**: weekly-sync (D-2a), orphan-cleanup (Issue 313)

### Audit Append-only (Migration 0001)

- `lib/kernel/audit/writeAudit.ts`: append-only INSERT 강제
- **21 CFR Part 11 §11.10(e)** 준수

### Auth.js v5

- `lib/kernel/auth/`: Google Workspace SSO
- **RBAC**: 5 역할 (viewer, employee, ra-member, ra-lead, admin)

### Consult Streaming

- `lib/ai/consult/`: Power Chat 세션 (관할권 비교, 저장)
- **v3 분리**: `lib/domains/consult/`로 독립 도메인 분리 예정

### Radar

- `lib/domains/radar/`: 규제 레이더 (외부 스크래퍼 8종)
- **knowledge-gap 의존 제거**: SHRINK 정책으로 detector만 `lib/domains/radar/` 내부로 가져오고 나머지 아카이브

---

## LLM 백엔드 (v3 전면 개편)

### #318 gx10 온프레미스 Ollama 단일화

**외부 API 전면 배제**: OpenAI/Anthropic/GitHub Models → **gx10 온프레미스 Ollama 단일 백엔드**.

- **임베딩**: qwen3-embedding:latest (MRL 1536 truncate, pgvector 무변경) via @ai-sdk/openai `/v1/embeddings`
- **chat**: gpt-oss:120b (116.8B MXFP4) via **ollama-ai-provider** (native `/api/chat`)
- **의존성 제거**: @ai-sdk/anthropic, @anthropic-ai/sdk 삭제 · llm-provider ollama-only · env 외부 키 3종 제거
- **커밋**: fcaf8ae(A) · 6930305(B) · c27f955(C) · 3ef2a83(fixup)

> **과금 0, ToS 안전, 환자 정보 미취급(내부 개발 제품 자료만).**

---

## RAG 파이프라인

### Knowledge Source 구성 (v3 유지)

| 소스 | 유형 | 동기화 방식 | v3 변경사항 |
|------|------|------------|-------------|
| **ra-llm-wiki** | 사내 NAS (VPN) | Git pull → 문서 파싱 → 임베딩 | **BK-033 제품 자동 추출 신규** |
| **MD-process** | GitHub | Git pull → SOP 파싱 → 임베딩 | 동일 유지 |
| **ra-project** | GitHub | Git pull → 규제 조항 파싱 → 임베딩 | 동일 유지 |

> **크론 시각 분산**: 이전 03:18 몰림 → 03:00/20/40 20분 간격 분산 (BK-104).

### 파이프라인 흐름

```
1. 사용자 질문 수신
2. Haiku — 의도 분류 (정책 질의 / 규제 질의 / 복합) → gx10 Ollama
3. Agent — 해당 레포 문서 탐색 (pgvector 벡터 검색 + FTS)
4. Cohere Rerank — 검색 결과 정밀도 향상 (legacy, 유지)
5. gpt-oss:120b — 찾은 문서만 근거로 답변 생성 (출처 명시 필수)
6. 후처리 — 출처 검증, 미답변 여부 판단
7. DB 저장 — 대화 이력·감사 로그
```

---

## 보안

| 항목 | 내용 | v3 변경사항 |
|------|------|-------------|
| **접근 제어** | 사내 내부망 전용, 외부 노출 없음 | 동일 유지 |
| **인증** | Auth.js v5 세션 기반, Google Workspace SSO | 동일 유지 |
| **민감 데이터** | NAS 내부 보관, 외부 전송 없음 | 동일 유지 |
| **LLM 데이터** | 온프레미스 Ollama (zero-data-retention) | v3 신규 |
| **감사 로그** | audit_log append-only + hash chain | v3 강화 (previous_hash BYTEA) |

---

## 데이터 모델 (핵심 테이블)

| 테이블 | 핵심 컬럼 | v3 변경사항 |
|--------|----------|-------------|
| `users` | id, email, name, role | **role CHECK 제약 강화** (5개 역할) |
| `products` | id, name, family, source_path, source_kind | **v3 신규**: BK-033 ra-llm-wiki 자동 추출 |
| `product_markets` | product_id, market_code, status, path | **v3 신규** |
| `inbox_tickets` | id, from_user, question, triage_state, auto_confidence | **v3 신규** |
| `approved_answers` | id, category, question, answer, citations, state | **v3 신규** |
| `submissions` | id, product_id, market_code, type, stage, due_at | **v3 신규** |
| `audit_log` | seq, ts, actor, action, target, previous_hash, hash | **v3 강화**: previous_hash BYTEA + hash chain 검증 |
| `embeddings` | id, source_repo, source_path, chunk_text, embedding (pgvector) | 기존 유지 (1536차원) |
| `conversations` | id, user_id, title, created_at | 기존 유지 (consult 도메인 분리 예정) |
| `messages` | id, conversation_id, role, content, answered | 기존 유지 |
| `message_sources` | message_id, source_repo, source_path, section | 기존 유지 (출처 명시) |

---

## 개발 환경

| 항목 | 내용 | v3 변경사항 |
|------|------|-------------|
| **개발 PC** | 별도 PC (확정 예정) | 동일 유지 |
| **개발 방식** | 로컬 Node.js + Docker DB | 동일 유지 |
| **배포 방식** | 워크스테이션에 Docker Compose 배포 | 동일 유지 |
| **CI/CD** | GitHub Actions → 워크스테이션 자동 배포 (SSH) | 동일 유지 |

---

## 관련 문서

- **v3 마스터 계획**: docs/proposals/v3-architecture-revamp-plan-2026-07-02.md
- **v3 원본 문서**: docs/v3/ (README + 5개 하위 문서)
- **제품 정의**: product.md
- **구조 명세**: structure.md
- **운영 SOP**: docs/운영_SOP.md (legacy, v2)
