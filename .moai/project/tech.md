# 기술 명세 — Regula

> 최종 업데이트: 2026-04-30
> 출처: `RA-bot-design/design_handoff_regula/README.md`

---

## 기술 스택 전체도 (§4)

| 카테고리 | 기술 선택 |
|---|---|
| **Frontend** | Next.js 15 App Router, TypeScript 5.4+, React 18, Tailwind CSS v4, Radix UI, lucide-react, Zustand, TanStack Query v5, Vercel AI SDK |
| **Backend** | Next.js Route Handlers + SSE, Drizzle ORM, PostgreSQL 16 + pgvector, Auth.js v5 (NextAuth) |
| **AI / RAG** | Claude Sonnet 4.5 (추론), Claude Haiku 4.5 (분류/라우팅), OpenAI text-embedding-3, LangChain / LlamaIndex (TS), Cohere Rerank |
| **Data** | PostgreSQL 16 (Supabase 또는 Neon), pgvector, S3/R2 (문서 원본), Postgres FTS / Meilisearch |
| **Infra** | Vercel (frontend), Railway / Fly.io (worker), GitHub Actions CI/CD |
| **관측성** | Sentry (에러), PostHog (제품 분석), Langfuse (LLM trace) — Phase 5에서 wiring |
| **패키지 매니저** | pnpm (필수) |

---

## Frontend 스택 (§4)

### Next.js 15 App Router (RSC 원칙)
- **Server Components(RSC)**: 목록/대시보드 페이지는 RSC로 스트리밍 HTML 렌더링
- **`<Suspense>`**: 스트리밍 답변 블록 래핑
- **Route Prefetching**: `<Link>` 기반 자동 프리페치
- **`next/dynamic`**: Recharts, react-markdown 등 무거운 의존성 코드 분리

### 상태 관리 이중 구조

| 레이어 | 라이브러리 | 용도 |
|---|---|---|
| 클라이언트 UI 상태 | **Zustand** | 테마, 사이드바 상태, currentProjectId, 온보딩 완료 여부 |
| 서버 상태 | **TanStack Query v5** | 대화 목록/상세, 프로젝트, 템플릿, 출처, 규제 업데이트, 대시보드 통계 — 캐싱 + optimistic update |
| 스트리밍 채팅 | **Vercel AI SDK** + 커스텀 훅 | SSE 연결, abort controller, 이벤트 타입별 파싱 |

### Zustand Store 스키마 (§10.1)
```ts
// stores/ui.ts
{
  theme: 'light' | 'dark',
  sidebarCollapsed: boolean,
  currentProjectId: string | null,
  tweaksOpen: boolean,
  onboardingDone: boolean,
}
```

### TanStack Query 주요 훅 (§10.2)
- `useConversations()` — 목록
- `useConversation(id)` — 메시지 포함 상세
- `useProjects()`, `useProject(id)`
- `useTemplates()`
- `useSources()` — knowledge base
- `useUpdates()` — 규제 업데이트 피드
- `useDashboardStats()`

### 렌더링 관련 라이브러리
- `react-markdown + rehype-raw` — LLM 출력 마크다운 + citation HTML 렌더링
- `Recharts` — 대시보드 통계 바, 타임라인
- `TanStack Virtual` — History/Knowledge Base 100행 이상 가상화
- `Framer Motion` — 마이크로 인터랙션
- `React Hook Form + Zod` — 질문 제출 폼 유효성 검사

---

## Backend 스택 (§4, §11)

### API 구조
- 모든 엔드포인트: **Next.js Route Handlers** (`/api/ra/*`)
- 인증: **Auth.js v5 세션 쿠키** (SAML/OIDC SSO, MFA 필수, 30분 idle timeout)
- 요청/응답 타입: **Zod 스키마** — 클라이언트/서버 공유

### 주요 엔드포인트 (§11)

| 엔드포인트 | 메서드 | 설명 |
|---|---|---|
| `/api/ra/consult` | POST | 메인 RAG 엔드포인트, SSE 스트리밍 응답 |
| `/api/ra/conversations` | GET | 페이지네이션 목록 (filter: projectId, status, q) |
| `/api/ra/conversations/[id]` | GET | 전체 상세 (메시지 + 구조화 블록 + 출처) |
| `/api/ra/conversations/[id]/feedback` | POST | 평가 (up/down + comment) |
| `/api/ra/sources/[id]` | GET | 전문 + 섹션 앵커, `?offset=N` 딥링크 지원 |
| `/api/ra/templates` | GET | 템플릿 목록 |
| `/api/ra/templates/[id]/download` | GET | `.docx`/`.pdf` 바이너리 |
| `/api/ra/updates` | GET | 사용자 제품군 맞춤 피드 (cursor 페이지네이션) |
| `/api/ra/expert-review` | POST | 상담 + 메시지 ID → RA 리드 검토 큐 등록 |
| `/api/ra/dashboard` | GET | 팀 지표 (ACL: manager vs member) |
| `/api/admin/ingest/*` | POST | 내부 전용 — 코퍼스 재수집, SOP 업로드 |

### 데이터베이스
- **PostgreSQL 16** (Supabase 또는 Neon 관리형)
- **pgvector**: `embedding vector(1536)` — `sources` 및 `source_sections` 테이블
- **RLS (Row-Level Security)**: Supabase 사용 시 조직/프로젝트 범위 접근 제어
- **Drizzle ORM**: 타입 안전, 경량, `drizzle.config.ts`로 마이그레이션 관리

---

## AI / RAG 파이프라인 (§4, §11.1)

### LLM 구성 — 멀티 LLM 접근 방식

| 역할 | 모델 | 용도 | 접근 방식 |
|---|---|---|---|
| 임베딩 | **OpenAI text-embedding-3** | 문서 임베딩, 벡터 검색 | OpenAI API 직접 호출 |
| 주 추론 | **Claude Sonnet 4.5** | 규제 분석, 답변 생성, citation 포함 산문 작성 | abyz-lab 통한 접근 |
| 분류/라우팅 | **Claude Haiku 4.5** | 의도 분류 (regulation-lookup / strategy / comparison 등), 쿼리 재작성 | abyz-lab 통한 접근 |
| 재랭킹 | Cohere Rerank 또는 cross-encoder | 검색 결과 정밀도 향상 | 목적별 최적 모델 선택 |
| 기타 작업 | **Best-fit 모델** | 기타 특수 작업 (요약, 분석 등) | 작업 유형에 따른 동적 선택 |

### RAG 코퍼스 — 초기 우선순위
- **1순위 (초기 구현)**: MFDS (한국), FDA (미국), EU MDR (유럽)
- **2순위 (후연동)**: NMPA (중국), PMDA (일본), ISO/IEC
- **내부 지식**: 사내 SOP + 과거 제출 서류

### RAG 파이프라인 8단계 (§11.1)
1. Haiku로 **의도 분류** (regulation-lookup / strategy / comparison / etc.)
2. **쿼리 재작성** — 약어 확장, 동의어 추가
3. **하이브리드 검색**: pgvector 벡터 검색 + Postgres FTS, 코퍼스별 리트리버
4. **재랭킹**: Cohere Rerank 또는 cross-encoder
5. 검색 청크를 **strict citation 규칙 포함 프롬프트로 포맷**
6. Sonnet 4.5로 **답변 스트리밍**
7. **후처리**: citation 추출, confidence 계산, expert-review 플래그 결정
8. **DB 저장** + Langfuse 로그

---

## 스트리밍 계약 — SSE 이벤트 타입 (§9.1, §11.1)

단일 SSE 스트림에서 순서대로 도달하는 이벤트:

| 단계 | 이벤트 `type` | 페이로드 | 비고 |
|---|---|---|---|
| 0. 메타 | `meta` | `{ conversationId, messageId }` | 스트림 첫 번째 |
| 1. 검색 trace | `trace` | `{ step: string, status: 'active'|'done' }` | 각 500ms 이상 간격 |
| 2. 산문 토큰 | `prose_delta` | `{ delta: string }` | 토큰 단위 스트리밍 |
| 3. 구조화 | `confidence` | `{ level: 'high'|'med'|'low', score: number }` | 산문 완료 후 |
| 3. 구조화 | `sources` | `{ items: Source[] }` | |
| 3. 구조화 | `checklist` | `{ items: ChecklistItem[] }` | |
| 3. 구조화 | `comparison` | `{ title, cols, rows }` | |
| 3. 구조화 | `timeline` | `{ items: TimelineItem[] }` | |
| 3. 구조화 | `related` | `{ items: string[] }` | 후속 질문 |
| 3. 구조화 | `expert_review_required` | `{ reason: string }` | 조건부 |
| 4. 종료 | `done` | `{ duration_ms: number }` | |
| 4. 오류 | `error` | `{ code, message }` | |

**`useStreamingAnswer` 훅 책임** (§10.3):
- SSE 연결 + AbortController 관리
- `{ status, traceSteps[], prose, structured, error }` 노출
- 완료 시 conversation list 쿼리 무효화

---

## 데이터 모델 (§12)

Drizzle + PostgreSQL 16 핵심 테이블 12개:

| 테이블 | 핵심 컬럼 | 비고 |
|---|---|---|
| `users` | id, email, name, role, locale, theme_pref | |
| `organizations` | id, name, tier | |
| `projects` | id, org_id, name, device_class, target_markets[], color, submission_date | |
| `conversations` | id, project_id, user_id, title, status, archived_at | |
| `messages` | id, conversation_id, role, content_prose, confidence_level, confidence_score, expert_review_required | |
| `message_sources` | message_id, source_id, relevance_score, quoted_offset, cited_index | citation 매핑 |
| `message_blocks` | message_id, block_type enum, block_json | checklist/comparison/timeline/related |
| `sources` | id, org_label, title, year, type, region, url, `embedding vector(1536)` | pgvector |
| `source_sections` | id, source_id, anchor, heading, text, `embedding vector(1536)` | 딥링크 앵커 |
| `templates` | id, title, description, region, category, file_key, usage_count | |
| `regulatory_updates` | id, title, region, severity, published_at, affected_product_types[] | |
| `expert_reviews` | id, conversation_id, requested_by, assigned_to, status, notes | |
| `audit_logs` | id, actor_id, action, resource_type, resource_id, meta_json, created_at | **append-only, 7년 보존** |

**audit_logs 특이 사항**:
- 모든 LLM 호출, 출처 접근, expert-review 플래그 → 이 테이블에 기록
- **수정/삭제 불가** (21 CFR Part 11 준수)
- **7년 보존** 정책 (FDA 기대치)
- Day 1부터 wiring 필수 — 옵저버빌리티가 아닌 **규제 요건**

---

## 디자인 토큰 매핑 전략 (§6)

### `tokens.css` → Tailwind v4 `@theme`

```css
/* styles/tokens.css */
@theme {
  --color-brand-900: #0a1628;
  --color-brand-800: #0f1e3a; /* Primary button bg */
  --color-brand-700: #16294f; /* text-brand, hover */
  /* ... 전체 토큰은 tokens.css 참조 */
  --font-sans: 'IBM Plex Sans', 'Pretendard', ui-sans-serif, system-ui, sans-serif;
  --font-serif: 'Source Serif 4', 'Noto Serif KR', Georgia, serif;
  --font-mono: 'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace;
}
```

### 폰트 스택 (§6, §13.2)

| 폰트 | 웨이트 | 용도 | 설치 방법 |
|---|---|---|---|
| IBM Plex Sans | 400/500/600/700 | 기본 sans 텍스트 | `next/font/google` |
| IBM Plex Mono | 400/500/600 | 날짜, 배지, 모노 텍스트 | `next/font/google` |
| Source Serif 4 | 400/500/600 + italic | H1, 사용자 질문, 인용 규제 텍스트 | `next/font/google` |
| Noto Serif KR | 400/500/600 | 한국어 serif | `next/font/google` |
| Pretendard | variable | 한국어 sans (UI 전반) | `@fontsource-variable/pretendard` npm |

**Pretendard 주의**: Google Fonts 미제공 → `@fontsource-variable/pretendard` npm 패키지로 셀프 호스팅.

### 다크 모드 (§6)
- `[data-theme="dark"]` 클래스 오버라이드 방식 (`tokens.css` 내 전체 다크 변수 정의됨)
- `document.documentElement.setAttribute('data-theme', 'dark')` 로 토글
- `localStorage` + 사용자 프로필에 저장
- 첫 방문 시 `prefers-color-scheme` 우선 존중

### 레이아웃 상수
- `--nav-w: 260px` (사이드바)
- `--topbar-h: 56px`
- `--right-w: 360px` (우측 컨텍스트 패널)
- `--content-max: 840px` (채팅 컬럼 최대 너비)

---

## 개발 도구 (§4)

| 도구 | 용도 |
|---|---|
| **Biome** | Lint + Format (ESLint + Prettier 대체) |
| **Vitest** | 단위 테스트 (utils, prompts, formatters) — 목표 80%+ |
| **Playwright** | E2E 테스트 — login, new consultation, citation click, expert review, project switch |
| **Storybook** | 컴포넌트 문서 + 시각적 테스트 (`storybook-test`로 Vitest 통합) |
| **promptfoo** | LLM eval harness — 50개 이상 큐레이션 RA 질문 회귀 세트 (Phase 6) |
| **Axe-core** | 접근성 자동 검사 (Playwright 통합, 0 violations 목표) |
| **Drizzle Kit** | DB 마이그레이션 관리 |

---

## 배포 환경

### 이중 배포 전략
**로컬 개발 + Docker 병용** 접근 방식으로 개발 속도와 환경 일관성 모두 확보합니다.

### Docker 환경
**PostgreSQL 16 + pgvector** 컨테이너화로 개발 및 배포 환경을 표준화합니다.

```yaml
# docker-compose.yml 예시
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: regula
      POSTGRES_USER: regula_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U regula_user -d regula"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### 로컬 개발 환경
**Next.js 개발 서버**로 빠른 개발 사이클을 제공합니다.

```bash
# 개발 서버 실행
pnpm dev
# http://localhost:3000
```

### 배포 절차
1. **개발**: 로컬 Next.js 서버 + Docker DB
2. **빌드**: `pnpm build` → 정적 생성
3. **배포**: Vercel 배포 (프론트엔드), Railway/Fly.io (백엔드 워커)

---

## 패키지 매니저 (§4)

**pnpm** 필수. 현재 미설치 상태일 수 있음.

Phase 1 착수 전 확인:
```bash
pnpm --version
# 미설치 시:
npm install -g pnpm
```

---

## Node.js 버전

**v20 LTS** 이상 권장 (§4 "Node.js 20 LTS").
현재 시스템에서 `v24.12.0` 확인됨 — 호환 가능.

---

## 성능 / 접근성 예산 (§14, §15)

| 지표 | 목표값 |
|---|---|
| LCP | ≤ 2.0s (broadband) |
| INP | ≤ 200ms |
| CLS | ≤ 0.05 |
| First answer token | ≤ 1.5s after submit |
| WCAG | 2.1 AA (최소 요건, 엔터프라이즈 + 규제 산업 구매자 필수) |
| Axe-core violations | 0 (핵심 페이지, 양 테마) |

**성능 기법** (§15):
- RSC 목록/대시보드 스트리밍
- Recharts/react-markdown `next/dynamic` 코드 분리
- History/Knowledge Base 100행 초과 시 TanStack Virtual 가상화
- 폰트 `display: swap` + 주요 웨이트 preload

---

## 보안 / 규제 제약 (§16)

| 항목 | 명세 |
|---|---|
| 인증 | SSO-first (SAML/OIDC), MFA 필수, idle 30분 세션 타임아웃 |
| 인가 | 조직/프로젝트 범위 ACL, DB 쿼리 레이어 강제 (RLS) |
| LLM 데이터 | Anthropic **zero-data-retention** 모드 (엔터프라이즈 API) — 사내 SOP를 컨슈머 엔드포인트에 전송 금지 |
| 입력 안전 | Zod 검증 + 사용자당 rate limit (60 queries/hour) + 최대 8k chars/question |
| 출력 안전 | 시스템 프롬프트: "절대 규제를 창작하지 말 것" + 후처리: 모든 citation이 실제 검색 출처에 대응하는지 검증 |
| 감사 로그 | 21 CFR Part 11 준수 — append-only `audit_logs`, 7년 보존, 수정 불가 |
| 데이터 레지던시 | EU 고객 → EU-only 호스팅 (Vercel EU, Supabase EU), 조직별 설정 가능 |
| 보안 헤더 | CSP strict (nonce 기반), HSTS, `X-Frame-Options: DENY` |
| 비밀 관리 | env only, 분기 교체, Vercel Secrets / AWS Secrets Manager |
| 개인정보 | PII/PHI 비처리이나 모든 데이터 접근 이벤트 로깅 필수 |

---

## 관측성 (§4, §18)

Phase 5에서 wiring:

| 도구 | 용도 |
|---|---|
| **Sentry** | 에러 트래킹 |
| **PostHog** | 제품 분석 |
| **Langfuse** | LLM 호출 trace, 비용 이상 알림, expert-queue 백로그 모니터링 |

---

## CI/CD 파이프라인 (§18)

GitHub Actions, 단계:
1. Install + cache
2. Biome check
3. TypeScript typecheck
4. Vitest
5. Playwright smoke
6. Build
7. Vercel preview 배포 (PR당)

배포 환경: `local → preview (PR) → staging → production`

---

## 핸드오프 섹션 추가 상세 필요 항목

아래 섹션은 핸드오프에서 상세 내용이 부족하여 Phase 1 착수 시 `regula-architect`가 결정해야 함:

| 섹션 | 부족한 내용 |
|---|---|
| §12 Data Models | `checklist_items` 완료 상태 지속성 (서버 vs 클라이언트), `message_blocks` vs `checklist_items` 중복 관계 명확화 필요 |
| §11 API Contracts | `/api/ra/projects` 및 `/api/ra/sources` 상세 스키마 미제공 |
| §4 Vector DB | pgvector vs Pinecone 최종 선택 — 핸드오프에서 둘 다 언급, 단일 선택 필요 |
| §4 Queue | Inngest vs Trigger.dev 최종 선택 미결정 |
| §16 | 21 CFR Part 11 전자 서명 요건 — GxP 워크플로우 해당 여부 확인 필요 |

---

## 관련 핸드오프 섹션

- §4 Recommended Tech Stack — 전체 스택 원문 테이블
- §6 Design Tokens — 토큰 전체 목록 (`tokens.css` 참조)
- §10 State Management — Zustand/TanStack Query 스키마
- §11 Backend Integration & API Contracts — SSE 이벤트 타입 + 엔드포인트
- §12 Data Models — Drizzle 스키마 스케치
- §14 Accessibility — WCAG 2.1 AA 요건
- §15 Performance & SEO — 성능 지표 및 기법
- §16 Security & Compliance — 21 CFR Part 11 감사 요건
- §17 Testing Strategy — 레이어별 도구 + 커버리지 목표
- §18 Deployment & DevOps — CI/CD 파이프라인
