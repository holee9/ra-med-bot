---
id: SPEC-REGULA-BREADTH-001
title: Regula Phase 4 Breadth — 8 Views + 10 APIs + 5 RAG Corpora + Project Switching
status: completed
created: 2026-04-22
updated: 2026-05-03
author: manager-spec
phase: 4
skill: regula
version: 0.2.0
priority: Medium
revision_history:
  - version: 0.1.0
    date: 2026-04-22
    author: manager-spec
    notes: |
      Initial Phase 4 draft. 57 REQ-BREADTH across 7 groups (A/B/C/D/E/F/G).
      Covers handoff §7.3/§7.5-7.9/§7.11 (7 views + Home expansion),
      §9.4 (project switching), §10.1-10.2 (state management expansion),
      §11.2-11.9 (7 API endpoints), and 2 Phase-4-only endpoints
      (/api/ra/projects + [id]). Adds 5 new RAG corpora retrievers
      (eu-mdr, mfds, nmpa, pmda, internal-sops) + intent classifier router.
      Depends on SPEC-REGULA-FOUNDATION-001 v0.3.0 (13-table schema),
      SPEC-REGULA-CHAT-001 (streaming contract + message_sources),
      SPEC-REGULA-STRUCTURED-001 (6 block_type enum values).
  - version: 0.2.0
    date: 2026-04-23
    author: manager-spec (iteration via cross-spec-audit Critical patch)
    notes: |
      Applied cross-spec-audit Critical findings C2, C5, C6 + High H8:
      * C2 — permission guard 사전 준비: REQ-BREADTH-058 신규 추가. 모든
        Phase 4 /api/ra/* Route Handler는 `getServerSession()` 호출 및
        `user.orgId` 기반 WHERE 절 org-scope 필터링을 최소 필수로 강제 (Phase 4
        minimum). Full RBAC `withPermission` 래핑은 Phase 5 retrofit(ENTERPRISE
        REQ-ENTERPRISE-021). 이로써 Phase 4 production deploy 창에서 "no
        permission guard"가 아니라 "minimum filter"가 기본값이 되며 Phase 5
        regression 위험이 upgrade로 downgrade됨.
      * C5 — RightContextPanel wire-up 오너십 명확화: REQ-BREADTH-050
        "실데이터 연결" 위치 유지하고, Deliverable #9에 "수정 (Phase 3 스켈레톤
        → Phase 4 실데이터 wire-up)" 표기. STRUCTURED v0.2.0과 정합.
      * C6 — audit_logs.action pgEnum 정합: REQ-BREADTH-057 "FOUNDATION REQ-
        FND-044 stores action as text NOT NULL, not pgEnum" → "FOUNDATION
        v0.4.0 REQ-FND-044는 audit_action pgEnum. BREADTH 10 action 추가는
        단일 migration `ALTER TYPE audit_action ADD VALUE ...` x10" 수정.
      * H8 — 1.5s SLO 재검증 플래그: REQ-BREADTH-048에 주석 추가, "5 corpora
        병렬은 single-corpus 대비 여유있음 가정, 누적 first-token P95 실측은
        LAUNCH Phase 6에서 검증 후 필요 시 SLO 상향".
      신규 REQ: REQ-BREADTH-058 (permission guard placeholder). 기존 REQ
      재배치 없음.
  - version: 1.0.0
    date: 2026-05-03
    author: sync (manager-docs)
    notes: |
      Phase 4 구현 완료. TDD RED-GREEN-REFACTOR 8 commits으로 58개 REQ 전부 구현.
      47 test files / 472 tests all passing. Lint 6 warnings (no errors). TypeScript clean.
      구현 범위: 8 views + 10 API routes + 5 RAG retrievers + router + merge +
      8 TanStack Query hooks + Zustand stores + Shell integration + OnboardingModal +
      Audit instrumentation + Seed data.
      Decision Points DP-1~DP-5 all resolved as planned.
      Status: draft → completed.
related_handoff_sections:
  - "§7.3"
  - "§7.5"
  - "§7.6"
  - "§7.7"
  - "§7.8"
  - "§7.9"
  - "§7.11"
  - "§9.4"
  - "§10.1"
  - "§10.2"
  - "§11.2"
  - "§11.3"
  - "§11.4"
  - "§11.5"
  - "§11.6"
  - "§11.7"
  - "§11.9"
  - "§15"
  - "§16"
  - "§20"
depends_on:
  - SPEC-REGULA-FOUNDATION-001 (v0.4.0+)
  - SPEC-REGULA-CHAT-001 (v0.2.0+)
  - SPEC-REGULA-STRUCTURED-001 (v0.2.0+)
---

# SPEC-REGULA-BREADTH-001 — Regula Phase 4 Breadth

## 목적 (Purpose)

Regula Phase 4는 handoff §20 Roadmap의 **"Breadth"** 블록 (약 3주 예상)으로, Phase 1~3을 거쳐 완성된 **단일 대화 코어**를 **완전한 멀티페이지 SaaS**로 확장한다.

구체적으로 본 Phase는 세 축을 동시에 전진시킨다:

1. **8 Views 구축**: Home(§7.3 실데이터 확장) + History(§7.5) + Templates(§7.6) + Knowledge Base(§7.7) + Regulatory Updates(§7.8) + Dashboard(§7.9) + Onboarding Modal(§7.11) — Phase 1~3은 Home 스켈레톤과 Chat view만 존재했으며, 나머지 6개 view는 본 Phase에서 최초 구현.

2. **RAG 코퍼스 5종 확충**: Phase 2는 FDA 단일 코퍼스만 와이어되어 있음. 본 Phase에서 EU MDR, MFDS(한국), NMPA(중국), PMDA(일본), 내부 SOP 5개 retriever를 추가하고 **intent classifier + router** (lib/ai/router.ts — Claude Haiku)가 질문 → 적절 코퍼스 선택 + 병렬 검색 + merge/rerank 흐름을 orchestrate.

3. **Project Context Switching**: handoff §9.4 — Sidebar project click → Zustand `currentProjectId` 갱신 → 모든 후속 질의에 `projectId` 자동 포함 → RAG retriever가 내부 문서 가중치 조정 + RightContextPanel 헤더 실데이터 반영. **페이지 리로드 없이** 대화 및 Composer 입력이 보존되어야 한다(Non-Obvious Constraint #6).

후속 보강이 어려운 제약은 본 Phase에서는 상대적으로 적다(Phase 1에서 13-table schema 및 audit_logs append-only 기반을 확보했기 때문). 다만 **21 CFR Part 11 audit 기록**(Non-Obvious Constraint #4)은 본 Phase 신규 10개 API 전반에 **Day-1으로** 적용되어야 하며, 지금 놓치면 Phase 5 Enterprise(전체 감사 + RBAC)에서 대규모 수정 비용이 발생한다. **한/영 이중언어 first-class**(Non-Obvious Constraint #6)도 본 Phase 전 페이지의 한국어 UI 기본값으로 적용한다.

본 Phase는 Phase 5 Enterprise Hardening(expert review UI/API, RBAC 세분화, dark mode polish, i18n 런타임 스위처, Sentry/Langfuse)과 Phase 6 Quality & Launch(Playwright e2e, 부하, LLM eval)로 이어지는 **breadth 기반**이다.

---

## 범위 (Scope)

### In Scope

| 구분 | 산출물 |
|---|---|
| Pages (8 views) | `app/(app)/page.tsx` **확장** (Home §7.3 — quick grid + 최근 질의 + 빠른 템플릿), `app/(app)/history/page.tsx` (§7.5 — TanStack Virtual + 검색 + 필터), `app/(app)/templates/page.tsx` (§7.6 — 3-col grid + 다운로드), `app/(app)/knowledge/page.tsx` (§7.7 — 그룹화 목록), `app/(app)/updates/page.tsx` (§7.8 — personalized feed), `app/(app)/dashboard/page.tsx` (§7.9 — stat cards + 분포 + coverage + 활동), `components/onboarding/OnboardingModal.tsx` (§7.11 — 4-step modal) |
| API routes (10 endpoints) | `app/api/ra/conversations/route.ts` (GET list, §11.2), `app/api/ra/conversations/[id]/route.ts` (GET detail, §11.3), `app/api/ra/conversations/[id]/feedback/route.ts` (POST, §11.4), `app/api/ra/sources/[id]/route.ts` (GET with anchor, §11.5 **신규** — Phase 2에서 기본만 있었다면 deep-link 지원 추가), `app/api/ra/templates/route.ts` (GET list, §11.6), `app/api/ra/templates/[id]/download/route.ts` (GET binary, §11.6), `app/api/ra/updates/route.ts` (GET feed, §11.7), `app/api/ra/dashboard/route.ts` (GET stats, §11.9), `app/api/ra/projects/route.ts` (GET list + POST create, **Phase 4 확정** — §11 미명시분), `app/api/ra/projects/[id]/route.ts` (GET + PATCH, **Phase 4 확정**) |
| RAG retrievers (5 신규) | `lib/ai/retrievers/eu-mdr.ts`, `lib/ai/retrievers/mfds.ts` (한국 규제), `lib/ai/retrievers/nmpa.ts` (중국), `lib/ai/retrievers/pmda.ts` (일본), `lib/ai/retrievers/internal-sops.ts` (조직 내부 SOP — org 격리) |
| RAG orchestration | `lib/ai/router.ts` (intent classifier = Claude Haiku + intentToCorpora 매핑 + project target_markets 필터), `lib/ai/merge.ts` (병렬 결과 flat + Cohere Rerank top-8) |
| State management | `stores/ui.ts` 확장 (`currentProjectId`, `recentProjects[]`, `pendingQuestion`, `rightPanelCollapsed`, `onboardingDone` — Zustand persist middleware로 localStorage 동기화, `partialize`로 `pendingQuestion` 제외), `stores/project.ts` **신규** (현재 프로젝트 상세 캐시, 최근 5개 프로젝트 히스토리) |
| Shell integration | `components/shell/Sidebar.tsx` **확장** (Phase 1 정적 링크 → 실제 active route 하이라이트 + Projects 섹션 실데이터 + 프로젝트 switcher 실동작), `components/chat/ProjectChip.tsx` **신규** (Topbar breadcrumb 영역 현재 프로젝트 표시 + 클릭 시 프로젝트 목록 dropdown), `components/chat/RightContextPanel.tsx` **실데이터 연결** (현재 프로젝트 + 활용 출처 top 5 + 관련 규제 업데이트 3개 TanStack Query 연동) |
| TanStack Query hooks | `lib/queries/useConversations.ts`, `lib/queries/useConversation.ts`, `lib/queries/useProjects.ts`, `lib/queries/useProject.ts`, `lib/queries/useTemplates.ts`, `lib/queries/useSources.ts` (목록), `lib/queries/useUpdates.ts` (`useInfiniteQuery`), `lib/queries/useDashboardStats.ts` |
| Onboarding | 첫 방문 시 `ui.onboardingDone === false` 감지 → OnboardingModal 렌더링 → 완료 시 localStorage persist |
| Audit instrumentation | 10개 신규 API 모두 `writeAudit()` 호출 (FOUNDATION `lib/audit.ts` 헬퍼 확장 — 9개 신규 action enum 값 추가) |
| Seed data | `scripts/seed-templates.ts` (S3/R2 샘플 템플릿 업로드 + `templates` row INSERT), `scripts/seed-regulatory-updates.ts` (sample updates with pre-generated `impact_analysis_text`), `lib/seeds/homeQuickCards.ts` (Home quick grid 4개 샘플 질문) |

### Out of Scope

다음 항목은 **의도적으로 본 Phase에서 구현하지 않는다**:

| 항목 | 해당 Phase | 사유 |
|---|---|---|
| **Expert review workflow API/UI** (`/api/ra/expert-review` POST 핸들러, Topbar 버튼 실동작, expert queue view) | Phase 5 | handoff §20 Phase 5 Enterprise Hardening. Phase 1에서 `expert_reviews` 테이블은 확보, Phase 2에서 `expert_review_required` 플래그 자동 설정은 확보 — Phase 4는 History 목록에 플래그만 표시, 실제 제출/처리 워크플로우는 Phase 5 |
| **RBAC 세분화** (organization/project ACL, manager vs member 권한 구분) | Phase 5 | 본 Phase의 API는 `organization_id = currentUser.organization_id` 필터만 하드 적용. project-level ACL은 Phase 5 |
| **Dark mode polish** (handoff screenshot 08 대비) | Phase 5 | Phase 1 토큰 오버라이드만 확보, 런타임 토글 기능 Phase 5 |
| **i18n 런타임 스위처** (ko ↔ en 전환) | Phase 5 | Phase 4는 hardcoded Korean UI. next-intl 도입은 Phase 5 |
| **Sentry / Langfuse / PostHog wiring** | Phase 5 | handoff §20 Phase 5 관측성 |
| **템플릿 업로드/편집 UI** (관리자용) | Phase 5 또는 post-launch | Phase 4는 read-only 다운로드 + seed 스크립트로 샘플 업로드만 |
| **Regulatory updates push notification** (이메일/Slack/in-app toast) | Phase 5 | Phase 4는 피드 조회만 |
| **Regulatory updates 수집 자동화** (Inngest crawler job) | Phase 5 | Phase 4는 seed 데이터만. Inngest 선택은 FOUNDATION 결정 #2에서 완료 |
| **Impact analysis LLM 실시간 생성** | Phase 5 | Phase 4는 seed에서 pre-generated text 사용. 실시간 호출 시 비용 폭발 |
| **Project deletion (soft or hard)** | Phase 5 | 감사 이슈 회피 위해 Phase 4는 create/update만. delete는 Phase 5에서 soft delete 컬럼 도입과 함께 |
| **Users CRUD** (조직 구성원 추가/편집) | Phase 5 | 본 Phase는 Auth.js SSO 기반 자동 프로비저닝만 |
| **Onboarding DB persist** (`users.onboarded_at` 컬럼) | Phase 5 | Phase 4는 localStorage only. Cross-device 동기화는 Phase 5 |
| **Playwright e2e 테스트 작성** (8 views 전체) | Phase 6 | Phase 4는 Vitest 단위·통합만 |
| **LLM eval harness — intent classifier 정확도** | Phase 6 | handoff §17.2 |
| **audit_logs materialized view** (dashboard 집계 성능 최적화) | Phase 5 | Phase 4는 직접 쿼리 + 인덱스 + Query 캐시만 |
| **`users.intent` 컬럼 승격** (Phase 4는 audit_logs meta_json에 저장) | Phase 5 이후 | Phase 4는 DB migration 없이 meta_json 활용 |
| **sources.last_synced_at 실시간 갱신** (Phase 5 Inngest 수집 연동 후) | Phase 5 | Phase 4는 `sources.created_at` 기준 표시 |
| **Post-launch: 템플릿 전자서명, 대화 export** | Post-launch | 규제 준수 확장 |

### 영향받지 않는 Phase 1~3 산출물 (수정 금지)

본 Phase는 기존 Phase 산출물을 **수정하지 않는다**:
- `lib/db/schema.ts` — 13 tables 그대로 유지 (schema migration 없음)
- `migrations/0000_init.sql`, `migrations/0001_audit_append_only.sql` — 건드리지 않음
- `lib/auth.ts`, `middleware.ts` — Phase 1 그대로
- `styles/tokens.css`, `app/globals.css`, `tailwind.config.ts` — Phase 1 그대로
- `app/api/ra/consult/route.ts` (Phase 2) — `projectId` 파라미터 활용만 (이미 Phase 2에서 파라미터 접수, Phase 4는 라우터와 연결)
- `components/chat/Composer.tsx` (Phase 2), `useStreamingAnswer` 훅 — Phase 4에서 **projectId snapshot 주입** 1라인만 추가 (해석 결정 4의 concurrency-safe 패턴)
- `components/chat/AnswerBlock.tsx`, Checklist/ComparisonTable/Timeline 컴포넌트 (Phase 3) — 재사용만
- `lib/ai/retrievers/fda.ts` (Phase 2) — 재사용, 인터페이스 맞춰 확장

---

## 기술 결정 (Technical Decisions)

본 SPEC은 handoff §7.3~§7.9, §7.11, §9.4, §10.1~§10.2, §11.2~§11.9의 미결 및 모호 항목을 다음과 같이 **결정**한다.

### Phase 4 확정 결정

| # | 결정 항목 | 선택 | 탈락안 | 근거 | 재평가 조건 |
|---|---|---|---|---|---|
| 1 | 페이지 데이터 fetching 라이브러리 | **TanStack Query v5** | SWR | handoff §10.2 명시. `useInfiniteQuery` + `useQuery` 조합으로 모든 Phase 4 서버 상태 커버 | Next.js Server Components로 대체 — Phase 6 성능 프로파일링 후 재검토 |
| 2 | 대용량 목록 가상화 라이브러리 (History + Knowledge Base) | **TanStack Virtual v3.11+** | react-window / react-virtuoso | TanStack 생태계 통일(Query + Virtual 같은 팀) + `useInfiniteQuery` + `useVirtualizer` 결합 자연스러움 + React 19 호환 확인됨 | TanStack Virtual이 그룹 레이아웃에서 `rangeExtractor` 복잡도 폭증 시 react-virtuoso fallback |
| 3 | Intent classifier 모델 | **Claude Haiku** (lib/ai/router.ts) | Regex 휴리스틱 / 로컬 classifier | handoff §11.1 명시("Classify intent with Haiku") + 한/중/일 다국어 자연 처리 + 비용 허용 수준(입력 ~100 tokens × 10K 호출/일 ≈ $30/일) | Phase 6 eval에서 오분류율 > 5% 시 fine-tuned local classifier 도입 |
| 4 | 5개 코퍼스 검색 메커니즘 | **intentToCorpora 정적 매핑 → 병렬 호출 → merge + Cohere Rerank** (lib/ai/merge.ts) | 단일 hybrid search (모든 코퍼스 동시 동일 가중) | 각 코퍼스 언어/품질/정책 특성 다름(FDA 영어 풍부 vs MFDS 한글 부족 vs NMPA 중국어 정부 접속 제한). 병렬 + rerank가 로컬 최적화 허용 | 코퍼스 품질 개선(Phase 5) 후 hybrid search 재검토 |
| 5 | 프로젝트 전환 시 대화 보존 전략 | **Zustand `currentProjectId` 갱신 only, 페이지 리로드 금지, in-flight 스트림 유지, Composer 입력 보존** | 전환 시 페이지 리로드 또는 AbortController 중단 | handoff §9.4 원문 "All subsequent questions include projectId" — 현재 in-flight/UI에 영향 주지 말 것. Non-Obvious Constraint #6 "로케일 전환 시 리로드 없이 대화 유지"와 동일 원칙 (research.md 해석 4/9) | Phase 5 WebSocket 기반 실시간 협업 도입 시 재검토 |
| 6 | 템플릿 다운로드 포맷 | **PDF + DOCX 둘 다 지원, 기본 PDF** (`?format=pdf\|docx`) | 단일 포맷 | RA 실무: PDF = 제출본(서명 잠금), DOCX = draft 편집. 둘 다 필요. 스토리지 부담 2배이나 템플릿 수 제한적(~수백) | 스토리지 비용 월 $200 초과 시 on-demand DOCX 생성(PDF → DOCX 변환)으로 전환 |

### Phase 4 Decision Points (재평가 필요)

| # | 항목 | 현재 결정 | 후속 재평가 조건 |
|---|---|---|---|
| DP-1 | Embedding 모델 차원 (1024 vs 1536) | Phase 1 schema는 `vector(1536)` 컬럼. Phase 2가 실제 선택한 모델(OpenAI `text-embedding-3-large` 1536 또는 Cohere `embed-multilingual-v3.0` 1024)과 일치시키며, 불일치 시 본 Phase 4 kickoff에서 regula-architect가 zero-pad 또는 migration 전략 결정 | Phase 4 kickoff 시 Phase 2 실제 선택 확인 |
| DP-2 | Dashboard 집계 쿼리 최적화 전략 | 본 Phase는 직접 쿼리 + `(created_at, action)` 인덱스 + TanStack Query `staleTime: 5min`. Materialized View는 Phase 5 | audit_logs > 10M rows 돌파 시 Phase 5 MV 도입 |
| DP-3 | Intent meta 저장 위치 | audit_logs.meta_json에 `{intent, model, tokens}` 저장 (schema migration 없음). Phase 5에서 `messages.intent` pgEnum 승격 | `SELECT meta_json->>'intent'` 쿼리가 P95 > 500ms 되면 컬럼 승격 |
| DP-4 | OnboardingDone persist 위치 | localStorage only (Phase 4). Phase 5에서 `users.onboarded_at` DB 컬럼 이관 | Cross-device 사용 시나리오가 제품 요구로 확정되면 Phase 5 이관 |
| DP-5 | projectId 전환 시 AnswerBlock 히스토리 재조회 | 전환 후에도 기존 AnswerBlock은 원래 projectId context로 렌더링 유지. 새 질의만 새 projectId 적용 | 사용자 피드백에서 "답변이 섞여 보인다" 리포트 시 UI 분할 |

---

## EARS 인수 기준 (Acceptance Criteria)

각 요구사항은 `REQ-BREADTH-NNN` ID로 식별하며, EARS 5개 패턴 중 적절한 형태로 기술한다. 모든 요구사항은 테스트 가능(testable)해야 한다.

**총 REQ 개수:** 57개 (REQ-BREADTH-001 ~ REQ-BREADTH-057).
**그룹 구성:** A(Home + Onboarding, 7개) + B(History + Templates + Knowledge + Updates + Dashboard, 20개) + C(API endpoints, 13개) + D(5 retrievers + router, 8개) + E(Project switching, 5개) + F(State management, 3개) + G(Audit + i18n constraints, 1개).

---

### Group A: Home (§7.3 확장) + Onboarding (§7.11) (REQ-BREADTH-001 ~ REQ-BREADTH-007)

#### REQ-BREADTH-001 (Ubiquitous)
**요구사항:** The system SHALL expand `app/(app)/page.tsx` (Phase 1 placeholder) to render the full Home view per handoff §7.3, containing **exactly 4 sections in this order**: (1) Hero block (eyebrow pill + H1 + subtitle), (2) Quick grid (4 cards, 2×2 on desktop), (3) 최근 질의 list (4 most recent), (4) 빠른 템플릿 preview (3-card grid).
**근거:** handoff §7.3 composition "Hero + Quick grid + 최근 질의 + 빠른 템플릿".
**검증 방법:** Vitest + @testing-library/react로 `app/(app)/page.tsx` 렌더링 후 4개 섹션의 `data-testid` 속성 존재 확인. section ordering DOM 순서 검증.

#### REQ-BREADTH-002 (Ubiquitous)
**요구사항:** The Hero H1 SHALL render the exact text `무엇을 <em>검토</em>해 드릴까요?` using `font-serif` at 48px (Tailwind `text-5xl`) with the `<em>` element styled in `text-brand-700 italic`.
**근거:** handoff §7.3 Hero "H1: 무엇을 <em>검토</em>해 드릴까요? (serif, 48px, italic accent in brand-700)" + Non-Obvious Constraint #5 (serif 브랜드 요건).
**검증 방법:** DOM snapshot에서 H1 inner HTML이 정확히 `무엇을 <em>검토</em>해 드릴까요?` 문자열 + serif class + brand-700 색상 적용 확인.

#### REQ-BREADTH-003 (Event-driven)
**요구사항:** WHEN the user clicks any of the 4 Quick grid cards, THEN the system SHALL set `ui.pendingQuestion` (Zustand) to the card's sample question text AND navigate to `/chat` using Next.js `router.push('/chat')`. The target `/chat` page SHALL read `pendingQuestion` on mount and prefill the Composer textarea, then clear the store value to prevent duplicate prefill on revisit.
**근거:** handoff §7.3 "Clicking pre-fills composer with matching question" + research.md 해석 1 (samples via seed constant).
**검증 방법:** Vitest 단위 테스트에서 card click → `ui.pendingQuestion` 값 확인 + `/chat` 이동 spy. 통합 테스트로 `/chat` 렌더링 후 textarea `value` 일치 확인, 리렌더링 후 pendingQuestion이 null로 리셋됨을 확인.

#### REQ-BREADTH-004 (Ubiquitous)
**요구사항:** The Quick grid SHALL render exactly 4 cards sourced from `lib/seeds/homeQuickCards.ts` (static TypeScript constant, no DB fetch). Each card SHALL expose `{ icon: LucideIcon, title: string, description: string, sampleQuestion: string }` fields. The seed file SHALL contain 4 Korean-language questions covering the 4 primary intents (regulation-lookup / strategy / comparison / timeline). 이 seed는 Phase 5에서 관리자 편집 가능한 DB 테이블로 승격 예정.
**근거:** research.md 해석 1 — Phase 4 schema drift 방지. handoff §7.3 "4 cards" 원문.
**검증 방법:** `lib/seeds/homeQuickCards.ts` import 후 배열 길이 === 4 assertion. 각 객체 필드 타입 TypeScript 컴파일 검증.

#### REQ-BREADTH-005 (Ubiquitous)
**요구사항:** The 최근 질의 section SHALL call `useConversations({ limit: 4, sortBy: 'created_at', sortDir: 'desc' })` and render 4 flat rows with: (1) 24px message icon tile, (2) serif 16px question text (truncated to 1 line with ellipsis), (3) meta line `{projectName} · {relativeTime} · {citationCount} citations` in `text-secondary text-xs`. WHILE the query is loading, the system SHALL render 4 skeleton placeholder rows.
**근거:** handoff §7.3 "4 most recent — flat rows with message icon, question, `프로젝트 · 시간 · N citations` meta".
**검증 방법:** Vitest + MSW로 API mock → 4 row 렌더링, skeleton 토글, meta 포맷 검증.

#### REQ-BREADTH-006 (Ubiquitous)
**요구사항:** The 빠른 템플릿 preview SHALL call `useTemplates({ limit: 3, sortBy: 'usage_count', sortDir: 'desc' })` and render 3 template cards in a 3-column grid. A "전체 템플릿 보기" link SHALL point to `/templates`.
**근거:** handoff §7.3 "빠른 템플릿 — 3-card grid preview (full list at /templates)".
**검증 방법:** DOM 검증: 3개 card + `<a href="/templates">전체 템플릿 보기</a>` 존재.

#### REQ-BREADTH-007 (State-driven)
**요구사항:** WHILE `ui.onboardingDone === false` (Zustand persist from localStorage) AND the current route is within `(app)` layout (not `/login`), the system SHALL mount `<OnboardingModal />` rendering 4 steps in this exact order: (1) 환영합니다 (shield icon), (2) 출처 중심 (book icon), (3) 프로젝트 컨텍스트 (folder icon), (4) 안전 장치 (alert icon, "전문가 검토"). The modal SHALL be 520px wide, centered, with a full-screen backdrop. Bottom bar SHALL contain step dots (active dot expanded to 18px width per handoff) + `건너뛰기` + `다음 →` buttons. Upon completion or skip, the system SHALL set `ui.onboardingDone = true`, persisting to `localStorage.regula_onboarded = '1'`.
**근거:** handoff §7.11 "4-step modal, 520px wide, centered" + "localStorage `regula_onboarded=1` on completion" + research.md 해석 persist 전략.
**검증 방법:** Vitest: `ui.onboardingDone = false`로 store 초기화 → 모달 렌더링 확인 → 다음 버튼 4회 클릭 → `onboardingDone = true` + localStorage value 검증. 이미 완료된 상태에서 재마운트 시 모달 부재 확인.

---

### Group B: History + Templates + Knowledge + Updates + Dashboard Views (REQ-BREADTH-008 ~ REQ-BREADTH-027)

#### Sub-group B1: History (§7.5)

#### REQ-BREADTH-008 (Ubiquitous)
**요구사항:** The system SHALL provide `app/(app)/history/page.tsx` rendering a header `상담 이력` (serif 32px) + count subtitle `총 {totalCount}건` (mono font, tabular numerals) + filter chips in exactly this order: `전체 / 진행중 / 보관`. Clicking a chip SHALL set the query parameter `?status=active|archived|all` and refetch the list.
**근거:** handoff §7.5 + research.md 해석 (status chip 매핑: `active` / `archived` / 전체).
**검증 방법:** 페이지 렌더링 후 H1 텍스트 `상담 이력` 확인, count subtitle regex `총 \d+건`, 3개 chip 한국어 라벨 확인. Chip 클릭 시 `useSearchParams` 업데이트 검증.

#### REQ-BREADTH-009 (Ubiquitous)
**요구사항:** The History list SHALL be rendered using TanStack Virtual (`@tanstack/react-virtual` v3.11+) combined with TanStack Query's `useInfiniteQuery`, where:
- `estimateSize` SHALL return 72 (card row height with border)
- `overscan` SHALL be 5
- When `virtualizer.getVirtualItems().at(-1).index >= rows.length - 5 && hasNextPage`, the system SHALL trigger `fetchNextPage()`
- Cursor-based pagination SHALL use the API's `nextCursor` field

**근거:** handoff §10.2 (TanStack Query) + research.md TanStack Virtual 결정 + 예상 데이터 볼륨 10K+ rows.
**검증 방법:** Vitest integration test — 1,000 mock rows 주입 후 스크롤 시뮬레이션으로 virtualizer.getVirtualItems() 길이가 viewport에 맞게 유지되는지 + `fetchNextPage` 호출 트리거 확인. 성능 smoke: 10,000 rows 주입 시 초기 렌더링 < 500ms.

#### REQ-BREADTH-010 (Ubiquitous)
**요구사항:** Each History row SHALL render in this exact layout:
1. 32x32 message icon tile (brand-50 bg, brand-600 icon color, radius 8px) — left
2. serif 16px question text (single line, `text-ellipsis overflow-hidden`) — main column
3. meta line `{projectName} · {relativeTime} · {citationCount} citations` (text-secondary, 13px, mono for time/count) — below question
4. chevron-right icon (opacity 0 by default, opacity 100 on `:hover`, 120ms transition) — right

Rows SHALL be contained in a single card container (shadow-sm, radius 12px) with `border-b border-subtle` between rows.

**근거:** handoff §7.5 "32×32 message icon tile + serif 16px question + meta line + chevron right on hover" + screenshot 06.
**검증 방법:** DOM structure + CSS class assertion (shadow-sm, border-b, hover:opacity-100). Visual regression via Storybook snapshot (Phase 6).

#### REQ-BREADTH-011 (Event-driven)
**요구사항:** WHEN the user clicks a History row, THEN the system SHALL navigate to `/chat?conversationId={id}`. The `/chat` page SHALL detect the query parameter on mount and load the conversation via `useConversation(id)`, rendering all historical messages (prose + sources + blocks).
**근거:** handoff §7.5 (implicit navigation) + §11.3 conversation detail.
**검증 방법:** Row click simulation → router.push spy. `/chat?conversationId=X` 방문 시 message 렌더링 통합 테스트.

#### REQ-BREADTH-012 (Optional)
**요구사항:** Where the user provides text in a search input (positioned top-right of the header row), the system SHALL debounce input (300ms) and pass `q` query parameter to `/api/ra/conversations`. The search SHALL match against `conversations.title` using Postgres ILIKE or full-text search. Empty `q` SHALL return unfiltered results.
**근거:** handoff §11.2 "Filters: ..., q (search)". Phase 4는 title 기반 단순 검색, Phase 5/6에서 내용 FTS 확장.
**검증 방법:** 입력 후 300ms 후 `/api/ra/conversations?q=...` 호출 확인. 빈 입력 시 `q` 파라미터 omit 확인.

#### Sub-group B2: Templates (§7.6)

#### REQ-BREADTH-013 (Ubiquitous)
**요구사항:** The system SHALL provide `app/(app)/templates/page.tsx` rendering a header `템플릿` (serif 32px) + description text + a 3-column CSS grid using `grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))` gap 16px. Each grid cell SHALL render a `<TemplateCard />` containing:
- tinted icon tile (48x48, radius 8px, bg varies by category: `Submission` → brand-50, `Clinical` → amber-50, `Quality` → green-50)
- title (serif 18px, 2-line clamp)
- description (text-secondary, 14px, 3-line clamp)
- footer (mono region tag `{region}` | uses count `{usage_count} uses`)

**근거:** handoff §7.6 + screenshot 04.
**검증 방법:** Render 6 mock templates → grid 렌더링 + auto-fill 반응형 확인. 각 카테고리별 icon tile bg 색상 검증.

#### REQ-BREADTH-014 (Event-driven)
**요구사항:** WHEN the user clicks a TemplateCard (or an explicit `<DownloadButton>` within the card), THEN the system SHALL call `GET /api/ra/templates/{id}/download?format=pdf` (default) triggering a browser download via `window.location` or `<a download>` attribute. The user may switch to `?format=docx` via a format toggle in the card (radio or dropdown).
**근거:** handoff §7.6 (implicit download UX) + §11.6 download endpoint + Technical Decision #6 (PDF default + DOCX optional).
**검증 방법:** Card click simulation → `/api/ra/templates/.../download?format=pdf` 요청 spy. 포맷 토글 후 `?format=docx` 파라미터 전환 검증.

#### Sub-group B3: Knowledge Base (§7.7)

#### REQ-BREADTH-015 (Ubiquitous)
**요구사항:** The system SHALL provide `app/(app)/knowledge/page.tsx` rendering a header `지식 베이스` (serif 32px) + description + 3 groups in this exact order: **공식 규제 기관** / **국제 표준** / **사내 지식**. Each group SHALL have an uppercase section label (tracked 0.08em, text-secondary) + card grid below.

Group membership mapping (based on `sources.type` enum from FOUNDATION REQ-FND-039):
- `공식 규제 기관`: type ∈ {`Regulation`, `Guidance`}
- `국제 표준`: type ∈ {`Standard`, `Industry`}
- `사내 지식`: type === `Internal` (WHERE organization_id = currentUser.organization_id)

**근거:** handoff §7.7 "Grouped by: 공식 규제 기관 / 국제 표준 / 사내 지식" + FOUNDATION schema sources.type enum.
**검증 방법:** 렌더링 후 3개 섹션 label 존재, 각 그룹의 source card가 올바른 type 필터링으로 분류됨을 확인.

#### REQ-BREADTH-016 (Ubiquitous)
**요구사항:** Each source card in Knowledge Base SHALL contain:
1. 40x40 icon tile (lucide icon mapped by type: Regulation→Scale, Guidance→BookOpen, Standard→Award, Industry→Building, Internal→Lock)
2. Source name (`sources.title`) — serif 16px
3. count badge — `{N} docs` where N = count of `source_sections` with this source_id (computed server-side; returned as `sectionCount` field)
4. description — `sources.org_label` + year + region chips
5. "Synced · N일 전" status pill — computed from `sources.created_at` (research.md 해석 2: Phase 4는 created_at 기준, Phase 5에서 last_synced_at 연결)

**근거:** handoff §7.7 "icon + name + count badge + description + 'Synced · 2분 전' status pill" + research.md 해석 2.
**검증 방법:** Mock sources → 카드 필드 확인. Group card test: Internal 타입이 current user org 외부 데이터와 섞이지 않는지 검증.

#### REQ-BREADTH-017 (Optional)
**요구사항:** Where filter controls are available, the user MAY filter sources by `region` (US/EU/KR/CN/JP/GLOBAL) via chip toggles at the top of the page. Active filter SHALL pass `?region=...` to `/api/ra/sources` query.
**근거:** research.md (필터링 설계) + product UX 관행.
**검증 방법:** 6개 region chip 렌더링 확인. 클릭 시 fetch URL에 파라미터 포함 검증.

#### Sub-group B4: Regulatory Updates (§7.8)

#### REQ-BREADTH-018 (Ubiquitous)
**요구사항:** The system SHALL provide `app/(app)/updates/page.tsx` rendering a header `규제 업데이트` (serif 32px) + a vertical list of `<UpdateCard />` components. Each card SHALL have:
- Left accent border 3px: `bg-amber-500` IF `severity === 'critical'`, ELSE `bg-brand-400`
- Meta row (top of card): region chip (mono, `bg-brand-50 text-brand-700`) + mono date (formatted `YYYY-MM-DD`) + conditional `HIGH IMPACT` tag (shown only when `severity === 'critical'`, styled `bg-amber-100 text-amber-700 mono 10px uppercase`)
- Title — serif 18px, 2-line clamp
- `영향 제품군: <bold product list>` — `regulatory_updates.affected_product_types[]` joined by `, ` and bolded
- Actions row (bottom): `영향도 분석` button (sparkle icon) + `원문 보기` button (file icon)

**근거:** handoff §7.8 "Left accent border (3px): amber for HIGH IMPACT, brand-400 otherwise" + "Serif 18px title" + "영향 제품군: <bold product list>" + "Actions: 영향도 분석 + 원문 보기".
**검증 방법:** Critical severity mock → amber accent + `HIGH IMPACT` tag 렌더링 확인. Non-critical → brand-400 accent, tag 부재 확인. 영향 제품군 bold 포맷 검증.

#### REQ-BREADTH-019 (Event-driven)
**요구사항:** WHEN the user clicks `영향도 분석` button on an UpdateCard, THEN the system SHALL open a modal displaying the **pre-generated** `regulatory_updates.impact_analysis_text` field. IF the field is null, THEN the button SHALL be disabled with tooltip `영향 분석 준비 중`. No real-time LLM invocation SHALL occur from this button in Phase 4 (research.md 해석 결정: pre-generated only).
**근거:** handoff §7.8 (implicit modal UX) + research.md "Phase 4 scope: pre-generated impact analysis" + Phase 5 scope boundary.
**검증 방법:** Mock data: `impact_analysis_text = null` → disabled + tooltip 확인. `impact_analysis_text = '...'` → 클릭 시 modal 열림 + 텍스트 렌더링 확인.

#### REQ-BREADTH-020 (Event-driven)
**요구사항:** WHEN the user clicks `원문 보기` button, THEN the system SHALL open `regulatory_updates.source_url` in a new tab via `window.open(url, '_blank', 'noopener,noreferrer')`. IF `source_url` is null, THEN the button SHALL be disabled.
**근거:** handoff §7.8 "원문 보기 (file) 버튼" + 보안 관행 (noopener).
**검증 방법:** window.open spy로 두 번째 argument가 정확히 `'_blank'`, 세 번째 argument에 `noopener,noreferrer` 포함 확인.

#### REQ-BREADTH-021 (Ubiquitous)
**요구사항:** The Updates list SHALL use `useInfiniteQuery` + TanStack Virtual (same pattern as History REQ-BREADTH-009) with cursor-based pagination. Initial load SHALL fetch 20 items; subsequent `fetchNextPage` calls load 20 more. Sort: `published_at DESC`.
**근거:** handoff §11.7 "{ items: [...], nextCursor }" + 예상 데이터 볼륨.
**검증 방법:** Infinite scroll trigger 후 다음 페이지 fetch 확인. Sort order 검증.

#### Sub-group B5: Dashboard (§7.9)

#### REQ-BREADTH-022 (Ubiquitous)
**요구사항:** The system SHALL provide `app/(app)/dashboard/page.tsx` rendering the following **exact layout** top-to-bottom:
1. Header row: H1 `대시보드` (serif 32px) + period subtitle + period toggle (30d / 90d / 180d chips, default 30d)
2. Stat grid: 4 cards in a single row (grid-cols-4 on desktop, grid-cols-2 on tablet)
3. Dual-column row: 질의 유형별 분포 (2fr column, left) + 규제 소스 커버리지 (1fr column, right)
4. 팀 최근 활동: full-width card below

**근거:** handoff §7.9 + screenshot 03.
**검증 방법:** 4개 섹션 구조 확인. Period toggle 기본값 `30d` 검증.

#### REQ-BREADTH-023 (Ubiquitous)
**요구사항:** Each stat card in the Stat grid SHALL render:
1. Label (uppercase, tracked 0.08em, text-secondary, 11px)
2. Value (serif 32px, tabular-nums)
3. Delta pill: upward arrow (green, success) OR downward arrow (red, danger) + `{sign}{percentage}% vs {previousPeriodLabel}` (mono 11px)

4 cards (exact labels in Korean):
- `이번 달 질의` — value: `stats.queries`, delta: `queriesDelta`
- `Citation 포함률` — value: `{citationRate * 100}%`, delta: `citationRateDelta`
- `평균 Confidence` — value: `{avgConfidence.toFixed(2)}`, delta: `confidenceDelta`
- `전문가 검토 플래그` — value: `stats.expertFlags`, delta: `expertFlagsDelta`

**근거:** handoff §7.9 "Stat grid (4 cards): label (uppercase) + serif 32px value + delta" + research.md dashboard 설계.
**검증 방법:** Mock `/api/ra/dashboard` 응답 → 4개 label 정확히 매칭, value 포맷 확인. Delta positive → 녹색 up arrow, negative → 빨강 down arrow 검증.

#### REQ-BREADTH-024 (Ubiquitous)
**요구사항:** The 질의 유형별 분포 block SHALL render as a horizontal bar chart using the response `intentDistribution` array (intents: regulation-lookup / strategy / comparison / timeline / template / update). Each row SHALL contain:
- Intent label (left, text-primary, 14px)
- Horizontal bar (bg-brand-200 track, bg-brand-600 fill with width `{percentage}%`)
- Count (right, mono 12px, tabular-nums)

Bars SHALL be sorted by count descending.

**근거:** handoff §7.9 "질의 유형별 분포 (2fr) — horizontal bars with labels, colored bars, tabular count".
**검증 방법:** 6개 intent row 렌더링 + bar width 계산 검증 + 내림차순 정렬 검증.

#### REQ-BREADTH-025 (Ubiquitous)
**요구사항:** The 규제 소스 커버리지 block SHALL render a list of `sourceCoverage` rows with:
- Colored dot (derived from source org — FDA=blue-500, EU=indigo-500, KR=amber-500, CN=red-500, JP=pink-500, Internal=green-500)
- Source org label + source title (truncated, 14px)
- Count (mono, tabular-nums, right-aligned)

**근거:** handoff §7.9 "규제 소스 커버리지 (1fr) — dot + label + mono count rows".
**검증 방법:** Mock 데이터 렌더링 + dot 색상 매핑 검증.

#### REQ-BREADTH-026 (Ubiquitous)
**요구사항:** The 팀 최근 활동 card SHALL render the 10 most recent audit log entries (action ∈ `llm.call`, `conversation.view`, `message.feedback`, `template.download` — other actions excluded for privacy). Each row:
- Avatar (24x24, gradient derived from actor email hash)
- Actor name + action description in Korean (e.g., `이영희가 대화를 시작했습니다`)
- Relative time (mono, text-secondary, 12px)

**근거:** handoff §7.9 "팀 최근 활동 — full-width card, avatar rows" + Non-Obvious Constraint #4 audit_logs 활용.
**검증 방법:** Mock audit_logs 10개 행 렌더링. Privacy filter (audit actions) 검증.

#### REQ-BREADTH-027 (State-driven)
**요구사항:** WHILE the Dashboard is mounted AND the user is authenticated, the system SHALL call `useDashboardStats({ period })` with `staleTime: 5 * 60 * 1000` (5 minutes) to minimize repeated audit_logs scans. Query refetch on period toggle SHALL be automatic via query key invalidation.
**근거:** research.md decision point DP-2 (Dashboard 집계 쿼리 성능 완화).
**검증 방법:** TanStack Query devtools로 staleTime 5min 확인. Period 전환 시 새 query key로 refetch 발생 확인.

---

### Group C: API Routes (REQ-BREADTH-028 ~ REQ-BREADTH-040)

#### REQ-BREADTH-028 (Ubiquitous)
**요구사항:** The system SHALL provide `GET /api/ra/conversations` (route.ts) implementing handoff §11.2 with Zod-validated query parameters:
```ts
const QuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  status: z.enum(['active', 'archived', 'all']).default('all'),
  q: z.string().max(200).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```
Response SHALL include `{ items: ConversationSummary[], nextCursor: string | null }`. Authorization: session cookie required; results filtered to `organization_id = session.user.organization_id`.

**근거:** handoff §11.2 + research.md Zod 스키마 방향.
**검증 방법:** Vitest contract test: valid params → 200 + 스키마 일치. Invalid params → 400 with Zod error. No session → 401.

#### REQ-BREADTH-029 (Ubiquitous)
**요구사항:** The `GET /api/ra/conversations/[id]` endpoint (§11.3) SHALL return full conversation detail including all messages with their `message_sources`, `message_blocks` (6 block_types from Phase 3). Response Zod schema:
```ts
const ConversationDetail = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  status: z.enum(['active', 'archived']),
  createdAt: z.string().datetime(),
  project: z.object({ id, name, color }).nullable(),
  messages: z.array(MessageSchema),
});
```
Authorization: 403 IF `conversation.user_id !== session.user.id` AND user is not organization admin (Phase 5 확장).

**근거:** handoff §11.3 "Full detail incl. all messages, structured blocks, sources" + FOUNDATION schema.
**검증 방법:** Mock conversation with 5 messages, 3 blocks per message → 응답 구조 검증. Cross-user 요청 → 403 확인.

#### REQ-BREADTH-030 (Event-driven)
**요구사항:** WHEN a POST request arrives at `/api/ra/conversations/[id]/feedback` (§11.4) with body `{ messageId: uuid, rating: 'up'|'down', comment?: string (max 2000) }`, THEN the system SHALL:
1. Validate body via Zod
2. Verify the message belongs to a conversation owned by the current user
3. INSERT into a `message_feedback` table (Phase 4에서 schema migration 없이 message_blocks에 `feedback` block_type으로 저장 — 해석 결정: schema 드리프트 방지)
4. Call `writeAudit({ action: 'message.feedback', actor_id, resource_type: 'message', resource_id: messageId, meta_json: { rating, hasComment: !!comment } })`
5. Return `{ success: true, feedbackId: string }`

**근거:** handoff §11.4 + Non-Obvious Constraint #4.
**검증 방법:** 유효 요청 → 201 + audit_logs INSERT 확인. Invalid rating → 400. 다른 사용자 메시지 요청 → 403.

#### REQ-BREADTH-031 (Ubiquitous)
**요구사항:** The `GET /api/ra/sources/[id]` endpoint (§11.5) SHALL accept optional `?offset=N` query parameter for deep-link support. When `offset` is provided, the response SHALL include the matching `source_sections` row (resolved via `anchor` or section order). Response schema:
```ts
const SourceDetail = z.object({
  id: z.string().uuid(),
  orgLabel: z.string(),
  title: z.string(),
  year: z.number().nullable(),
  type: z.enum(['Regulation','Guidance','Standard','Industry','Internal']),
  region: z.string().nullable(),
  url: z.string().url().nullable(),
  sections: z.array(z.object({ id, anchor, heading, text })),
  highlightedSectionId: z.string().uuid().nullable(), // resolved from offset
});
```

**근거:** handoff §11.5 "Supports `?offset=N` for deep linking" + FOUNDATION REQ-FND-044a/b/c (`source_sections` UNIQUE(source_id, anchor)).
**검증 방법:** `?offset=3` → `highlightedSectionId = sections[3].id` 또는 `anchor=§11.10-c` → 매칭 row 반환.

#### REQ-BREADTH-032 (Ubiquitous)
**요구사항:** The `GET /api/ra/templates` endpoint (§11.6 list) SHALL accept query parameters `?region=...&category=...&sortBy=usage_count|created_at&sortDir=asc|desc&limit=...`. Response: `{ items: Template[] }` (not paginated; expected volume ~수백).
**근거:** handoff §11.6 + Phase 4 scope (~hundreds of templates).
**검증 방법:** 필터 조합 3가지 요청 → 각각 정확한 row 반환 확인.

#### REQ-BREADTH-033 (Event-driven)
**요구사항:** WHEN a GET request arrives at `/api/ra/templates/[id]/download?format=pdf|docx` (default `pdf`), THEN the system SHALL:
1. Validate `format` ∈ {`pdf`, `docx`} via Zod (reject others with 400)
2. Generate a signed URL (S3/R2) for `{file_key}.{format}` (e.g., `template-510k-abc.pdf`)
3. Either (a) return `302 Location: signedUrl` OR (b) stream the binary with `Content-Type: application/pdf` / `application/vnd.openxmlformats-officedocument.wordprocessingml.document` and `Content-Disposition: attachment; filename="{title}.{format}"`
4. Atomically increment `templates.usage_count++` via `UPDATE templates SET usage_count = usage_count + 1 WHERE id = $1`
5. Call `writeAudit({ action: 'template.download', actor_id, resource_type: 'template', resource_id: templateId, meta_json: { format } })`

**근거:** handoff §11.6 "Returns .docx or .pdf binary" + Technical Decision #6 (둘 다 지원) + Non-Obvious Constraint #4.
**검증 방법:** Format 파라미터 검증 3가지 (pdf/docx/invalid). Usage_count 증가 DB assertion. Audit 기록 확인.

#### REQ-BREADTH-034 (Ubiquitous)
**요구사항:** The `GET /api/ra/updates` endpoint (§11.7) SHALL return a personalized feed. Personalization logic:
```sql
SELECT ru.* FROM regulatory_updates ru
WHERE EXISTS (
  SELECT 1 FROM projects p
  WHERE p.organization_id = $currentOrgId
    AND p.target_markets && ru.affected_product_types  -- array overlap
)
ORDER BY ru.published_at DESC
LIMIT $limit OFFSET $cursor;
```
IF the current user has no projects with `target_markets`, THEN the system SHALL fall back to returning ALL updates (onboarding-friendly default). Response: `{ items: RegulatoryUpdate[], nextCursor: string | null }`.

**근거:** handoff §11.7 "Feed personalized by user's products" + research.md (onboarding fallback 결정).
**검증 방법:** 3 시나리오 — (1) 프로젝트 없는 user → 전체, (2) target_markets = ['US','KR'] → US/KR 관련만, (3) 매칭 없음 → 빈 배열 + nextCursor=null.

#### REQ-BREADTH-035 (Ubiquitous)
**요구사항:** The `GET /api/ra/dashboard` endpoint (§11.9) SHALL accept `?period=30d|90d|180d` (default 30d). The endpoint SHALL execute queries scoped to `organization_id = currentUser.organization_id`:
1. `stats.queries` — COUNT from audit_logs WHERE action='llm.call' AND created_at > now() - interval
2. `stats.citationRate` — AVG(has_citations) from messages WHERE role='assistant'
3. `stats.avgConfidence` — AVG(confidence_score) from messages WHERE role='assistant'
4. `stats.expertFlags` — COUNT from messages WHERE expert_review_required = true
5. `intentDistribution` — GROUP BY meta_json->>'intent' FROM audit_logs WHERE action='llm.call'
6. `sourceCoverage` — GROUP BY message_sources.source_id ORDER BY COUNT DESC LIMIT 10
7. `recentActivity` — last 10 rows from audit_logs in the allowed action whitelist (REQ-BREADTH-026)
8. All `delta*` fields computed against the **previous equivalent period** (previous 30d, 90d, 180d)

Response shape conforms to `DashboardResponseSchema` Zod schema.

**근거:** handoff §11.9 + research.md Dashboard 집계 설계.
**검증 방법:** Mock audit_logs 및 messages → 각 stat 계산 assertion. Delta 계산 정확도 검증 (이전 30d 대비 %).

#### REQ-BREADTH-036 (Ubiquitous)
**요구사항:** The system SHALL provide `GET /api/ra/projects` returning `{ items: Project[] }` filtered to `organization_id = currentUser.organization_id` AND `status = 'active'` (status filter can be overridden via `?status=active|archived|all`). 응답에는 `currentUser`가 project_members에 포함된 프로젝트만 포함하되, Phase 5에서 RBAC 세분화 전까지는 org membership 기반 전체 반환 (research.md 단순화).
**근거:** handoff §11 range — projects API는 §11에 명시 안 되어 있으나 §7.1 "Projects section" + §9.4 "currentProjectId" UX 전제상 필수. FOUNDATION Technical Decision #4 "Phase 4에서 Zod 스키마 결정".
**검증 방법:** 3개 org × 5 project seed → currentUser org의 5개만 반환 확인. Archived 필터 검증.

#### REQ-BREADTH-037 (Event-driven)
**요구사항:** WHEN a POST request arrives at `/api/ra/projects` with body:
```ts
const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  deviceClass: z.string().nullable().optional(),
  targetMarkets: z.array(z.string()).min(1), // e.g., ['US', 'KR']
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  submissionDate: z.string().date().optional(),
});
```
THEN the system SHALL insert a new row into `projects` with `organization_id = currentUser.organization_id`, `status = 'active'`, and call `writeAudit({ action: 'project.create', actor_id, resource_type: 'project', resource_id: newId, meta_json: { name, targetMarkets } })`. Response: `201 { id, ...createdProject }`.
**근거:** handoff §9.4 (project context) + research.md CRUD 범위 결정 (Phase 4: create/update, delete는 Phase 5).
**검증 방법:** Valid body → 201 + DB row 존재 + audit 기록. Invalid `color` hex → 400.

#### REQ-BREADTH-038 (Event-driven)
**요구사항:** WHEN a GET request arrives at `/api/ra/projects/[id]`, THEN the system SHALL return the project detail IF `organization_id === currentUser.organization_id`, else 404 (not 403 to prevent org existence leak).
**근거:** OWASP 모범 사례 + research.md ACL 설계.
**검증 방법:** Current user's project → 200. Other org's project → 404. Non-existent → 404.

#### REQ-BREADTH-039 (Event-driven)
**요구사항:** WHEN a PATCH request arrives at `/api/ra/projects/[id]` with body:
```ts
const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  deviceClass: z.string().nullable().optional(),
  targetMarkets: z.array(z.string()).min(1).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  submissionDate: z.string().date().optional(),
  status: z.enum(['active', 'archived']).optional(),
});
```
THEN the system SHALL update only provided fields, reject empty body with 400, and call `writeAudit({ action: 'project.update', ..., meta_json: { changedFields: [...] } })`. Response: `200 { ...updatedProject }`.
**근거:** handoff §9.4 (project update) + 부분 업데이트 RESTful 관행.
**검증 방법:** Partial body (name only) → name만 갱신, 다른 필드 유지. Empty body → 400.

#### REQ-BREADTH-040 (Unwanted)
**요구사항:** The Phase 4 API layer SHALL NOT expose a DELETE method on `/api/ra/projects/[id]` or any other Phase 4 resource. Delete semantics require soft-delete schema support (Phase 5). Attempting DELETE SHALL return `405 Method Not Allowed`.
**근거:** research.md scope 결정 + FOUNDATION schema "Phase 1은 soft-delete 컬럼 도입하지 않음".
**검증 방법:** `DELETE /api/ra/projects/{id}` → 405 with `Allow: GET, PATCH` header.

---

### Group D: RAG Retrievers + Router (REQ-BREADTH-041 ~ REQ-BREADTH-048)

#### REQ-BREADTH-041 (Ubiquitous)
**요구사항:** The system SHALL export a shared `CorpusRetriever` interface at `lib/ai/retrievers/types.ts`:
```ts
export type CorpusId = 'fda' | 'eu-mdr' | 'mfds' | 'nmpa' | 'pmda' | 'internal-sops';
export interface RetrievedChunk {
  sourceId: string;
  sectionId: string | null;
  text: string;
  score: number;
  corpusId: CorpusId;
  metadata: { anchor?: string; heading?: string; year?: number; region?: string };
}
export interface CorpusRetriever {
  id: CorpusId;
  label: string;
  search(query: string, options: SearchOptions): Promise<RetrievedChunk[]>;
}
```
IF this interface already exists from Phase 2 (for `fda`), THEN Phase 4 SHALL import and reuse it without modification.

**근거:** Phase 2 `fda.ts` retriever와 동일 인터페이스 준수 (공통 router가 polymorphic하게 호출).
**검증 방법:** TypeScript 컴파일 성공. Interface signature 일치 확인.

#### REQ-BREADTH-042 (Ubiquitous)
**요구사항:** The system SHALL implement 5 new corpus retrievers with identical `CorpusRetriever` interface:
- `lib/ai/retrievers/eu-mdr.ts` — EU MDR (region='EU', type='Regulation', English)
- `lib/ai/retrievers/mfds.ts` — 식약처 (region='KR', type='Regulation', Korean)
- `lib/ai/retrievers/nmpa.ts` — NMPA (region='CN', type='Regulation', Chinese simplified)
- `lib/ai/retrievers/pmda.ts` — PMDA (region='JP', type='Regulation', Japanese)
- `lib/ai/retrievers/internal-sops.ts` — 내부 SOP (type='Internal', organization-scoped via `WHERE organization_id = $currentOrgId`)

Each retriever SHALL implement hybrid search (pgvector cosine similarity + Postgres FTS `full_text_tsv`) against `sources` + `source_sections` rows filtered by `sources.region` and `sources.type` matching the corpus identity. Top-K default 10.

**근거:** handoff §11.1 "Hybrid search: vector (pgvector) + FTS, with per-corpus retrievers" + research.md 5 corpora 특성 + FOUNDATION schema.
**검증 방법:** 각 retriever 단위 테스트: mock query → 각 region/type 필터 적용된 SQL 쿼리 생성 확인 + top-K 제한 확인.

#### REQ-BREADTH-043 (Unwanted)
**요구사항:** The `internal-sops` retriever SHALL NOT return chunks from sources with `organization_id != currentOrgId` OR `organization_id IS NULL`. Cross-organization data leakage is a critical security violation. This isolation SHALL be enforced at the SQL WHERE clause level (not JavaScript-level filtering).
**근거:** FOUNDATION schema sources.organization_id 정책 (global corpora = NULL, internal = org-specific) + OWASP access control.
**검증 방법:** Seed 2개 org × 각 2 internal SOPs → orgA session으로 internal-sops search → orgA SOPs만 반환 확인. orgB SOPs 부재 확인.

#### REQ-BREADTH-044 (Ubiquitous)
**요구사항:** The system SHALL implement `lib/ai/router.ts` exposing:
```ts
export type Intent = 'regulation-lookup' | 'strategy' | 'comparison' | 'timeline' | 'template' | 'update';
export async function classifyIntent(query: string, locale: 'ko'|'en'): Promise<Intent>;
export function selectCorpora(intent: Intent, currentProject: Project | null): CorpusId[];
```
`classifyIntent` SHALL invoke Claude Haiku (model: `claude-haiku-*`) with a system prompt that returns exactly ONE of the 6 intent IDs (no prose). Prompt template is defined in research.md. IF Haiku returns an unrecognized value, THEN the system SHALL default to `regulation-lookup` and log the unexpected response for eval (Phase 6).

**근거:** handoff §11.1 "Classify intent with Haiku" + research.md prompt design + Technical Decision #3.
**검증 방법:** Mock Haiku API → 6 intent strings 및 garbage string 각각에 대한 반환 확인. Unrecognized value → default + log.

#### REQ-BREADTH-045 (Ubiquitous)
**요구사항:** `selectCorpora(intent, project)` SHALL apply the following static mapping:
```ts
const baseMapping: Record<Intent, CorpusId[]> = {
  'regulation-lookup': ['fda', 'eu-mdr', 'mfds', 'nmpa', 'pmda'],
  'strategy': ['fda', 'eu-mdr', 'mfds', 'internal-sops'],
  'comparison': ['fda', 'eu-mdr', 'mfds', 'nmpa', 'pmda'],
  'timeline': ['fda', 'eu-mdr', 'mfds'],
  'template': [],  // templates queried separately, not via RAG corpora
  'update': [],    // regulatory_updates queried separately
};
```
Additionally, IF `project !== null` AND `project.targetMarkets` is non-empty, THEN the output SHALL be filtered to corpora whose region matches any market in `targetMarkets` (mapping: US→fda, EU→eu-mdr, KR→mfds, CN→nmpa, JP→pmda, + `internal-sops` always included when base mapping includes it).

**근거:** research.md intentToCorpora + project target_markets 필터 설계.
**검증 방법:** Unit table test — 7 scenarios (6 intents + project with ['US','KR']) → 각 mapping 검증.

#### REQ-BREADTH-046 (Ubiquitous)
**요구사항:** The system SHALL implement `lib/ai/merge.ts` exposing `mergeAndRerank(chunks: RetrievedChunk[], options: { topK: number, query: string }): Promise<RetrievedChunk[]>` that:
1. Flattens input chunks (expected: 5 corpora × 10 = 50 chunks)
2. Deduplicates by `(sourceId, sectionId)` keeping the highest score
3. Invokes Cohere Rerank v3 API (already used in Phase 2) with the query + top-50 chunks → returns top-K reranked
4. Returns `topK` chunks sorted by rerank score descending

**근거:** handoff §11.1 Step 4 "Re-rank with Cohere Rerank or cross-encoder" + research.md merge 전략.
**검증 방법:** Mock Cohere response → top-8 정렬 검증. 중복 (sourceId, sectionId) → 1개로 merge 확인.

#### REQ-BREADTH-047 (Event-driven)
**요구사항:** WHEN the `/api/ra/consult` endpoint (Phase 2 owned, Phase 4 integration point) receives a request with `projectId`, THEN the updated pipeline SHALL:
1. Call `classifyIntent(question, locale)` → intent
2. Call `selectCorpora(intent, currentProject)` → corpusIds
3. `Promise.all(corpusIds.map(c => retrievers[c].search(question, { limit: 10, organizationId: currentOrgId })))` — parallel retrieval
4. `mergeAndRerank(flatChunks, { topK: 8, query: question })` → final chunks
5. Proceed with Phase 2 prompt + Sonnet streaming as previously implemented

**Phase 4 changes are additive to Phase 2's existing pipeline. Phase 2 code (`/api/ra/consult/route.ts`) is modified only in the retrieval substep (1-4 above), NOT in streaming or audit handling. The Phase 2 `writeAudit({ action: 'llm.call', ... })` invocation SHALL have its `meta_json` extended to include `{ intent, corporaUsed, rerankedCount }` (schema-compatible addition).**

**근거:** handoff §11.1 "Backend pipeline: Classify → Rewrite → Hybrid search → Re-rank → Format → Stream → Post-process → Persist" + Phase 2 scope boundary (streaming), Phase 4 scope (retriever fan-out).
**검증 방법:** Integration test — Phase 2 endpoint 호출 with `projectId` → intent 분류 호출 확인 → 5 corpora 병렬 호출 spy → rerank 결과 sonnet prompt에 포함 확인. audit_logs에 extended meta_json 기록 확인.

#### REQ-BREADTH-048 (Ubiquitous) [v0.2.0 H8 주석 추가]
**요구사항:** The 5-corpus parallel retrieval (REQ-BREADTH-047 step 3) SHALL complete with P95 latency ≤ 800ms measured from `Promise.all` start to resolved. This is a subset of handoff §18 end-to-end P95 ≤ 4s budget; the retrieval slice is budgeted at 800ms allowing rerank (300ms) + Haiku classify (200ms) + Sonnet streaming TTFB (remaining ~2700ms).

**v0.2.0 H8 주석 (cross-spec-audit):** 5 corpora 병렬 retrieval P95 800ms 가정은 single-corpus baseline (CHAT Phase 2 seed 650 chunks) 대비 여유있음을 전제로 한다 — Promise.all의 slowest path는 single corpus latency(~150-200ms)와 동등 수준이고 병렬화 오버헤드만 추가된다. 다만 CHAT REQ-CHAT-057 "first-token P95 ≤ 1.5s" SLO는 single-corpus 기준이었으므로, Phase 4 multi-corpus + rerank + Haiku classify 누적 시 cumulative first-token P95가 1.5s를 초과할 가능성이 있다. **실측 기반 검증은 LAUNCH Phase 6 REQ-LAUNCH-024에서 수행**하며, 실측 결과에 따라 LAUNCH SLO(`consult_first_token: p(95)<1500`)를 상향 또는 본 REQ의 800ms 타겟을 하향 재조정한다.

**근거:** handoff §18 performance budget + research.md 성능 목표 + cross-spec-audit H8 (multi-phase latency 누적 재검증).
**검증 방법:** Vitest integration test with mocked corpora (each 150ms simulated latency) → Promise.all round-trip < 800ms for 5 calls. Production load test (Phase 6 LAUNCH REQ-LAUNCH-024, 026) verifies real network with actual corpus sizes.

---

### Group E: Project Switching (REQ-BREADTH-049 ~ REQ-BREADTH-053)

#### REQ-BREADTH-049 (Event-driven)
**요구사항:** WHEN the user clicks a project row in the Sidebar's Projects section, THEN the system SHALL:
1. Set `ui.currentProjectId = projectId` via Zustand action
2. Prepend `projectId` to `ui.recentProjects` (dedupe, max length 5)
3. Update URL via `router.replace(currentPath, { scroll: false })` ONLY IF current route is not History (to preserve History `?projectId=` filter independence per research.md 해석 결정 8)
4. Trigger no other navigation or reload

**근거:** handoff §9.4 "Sidebar project click sets current project (zustand)" + research.md 해석 8 (URL filter 독립성).
**검증 방법:** Vitest: Sidebar click simulation → Zustand state assertion + router spy. History 페이지에서 projectId 쿼리 독립 확인.

#### REQ-BREADTH-050 (State-driven)
**요구사항:** WHILE `ui.currentProjectId` is non-null, the `<RightContextPanel />` component's "현재 프로젝트" section SHALL render the project data fetched via `useProject(currentProjectId)` with:
- colored card using `project.color` as left accent
- project name (serif 18px)
- `Class {deviceClass} · NB {notifiedBody || '—'} · 제출일 {submissionDate || '미정'}`

WHILE `currentProjectId` is null, the section SHALL render `<EmptyState label="프로젝트를 선택하세요" />`.

**근거:** handoff §7.4 Right Context Panel + §9.4 "Right panel header reflects selected project".
**검증 방법:** Mock project data → 필드 렌더링 확인. currentProjectId = null → empty state 렌더링.

#### REQ-BREADTH-051 (Unwanted)
**요구사항:** The system SHALL NOT reload the page, reset the Composer textarea, or abort in-flight `/api/ra/consult` SSE streams when the user switches projects. The user's Composer input text (stored in Composer's local `useState`, NOT in Zustand) SHALL persist across project switches. In-flight streams SHALL continue with their original `projectId` snapshot (captured at submit time, not at render time).
**근거:** Non-Obvious Constraint #6 ("로케일 전환 시 전체 페이지 리로드 없이 대화 유지") + research.md 해석 4 (concurrency-safe pattern) + 해석 9 (Composer 입력 독립).
**검증 방법:** Playwright e2e (Phase 6 deferred) 또는 Vitest integration: Composer에 "테스트" 입력 → 프로젝트 전환 → Composer 값 "테스트" 유지 확인. Streaming 시뮬레이션 중 전환 → abort controller 호출 안 됨 확인.

#### REQ-BREADTH-052 (Ubiquitous)
**요구사항:** The `useStreamingAnswer` hook (Phase 2 owned) SHALL be extended in Phase 4 to **snapshot `currentProjectId` at submit time**, not continuously. Submit function signature becomes:
```ts
submit(question: string) {
  const projectIdSnapshot = useUIStore.getState().currentProjectId; // snapshot at submit
  const body = { question, conversationId, projectId: projectIdSnapshot, sourceFilter, ... };
  // open SSE with body...
}
```
The hook SHALL NOT subscribe to `currentProjectId` changes during an active stream. Phase 4 change is additive: Phase 2 hook signature unchanged, only the snapshot-at-submit behavior is enforced.
**근거:** research.md 해석 4 (in-flight stream 유지 전략).
**검증 방법:** Vitest mock: submit → projectId snapshot 캡처 → 스트리밍 중 Zustand currentProjectId 변경 → snapshot 유지 확인 (새 값으로 바뀌지 않음).

#### REQ-BREADTH-053 (Ubiquitous)
**요구사항:** The `<ProjectChip />` component (new, `components/chat/ProjectChip.tsx`) SHALL render in the Topbar breadcrumb area displaying the current project name + color dot. WHEN clicked, it SHALL open a dropdown (Radix UI Popover) listing (a) `ui.recentProjects` (top 5) + (b) "프로젝트 전체 보기" link → `/projects` OR (Phase 4는 `/projects` 미구현이므로 Sidebar 스크롤 fallback — deferred `/projects` dashboard view). IF `currentProjectId` is null, chip SHALL display placeholder `프로젝트 선택`.
**근거:** handoff §7.2 Topbar (breadcrumb 영역) + §9.4 (switcher UX).
**검증 방법:** Topbar 내 ProjectChip 렌더링 + click → dropdown 열림 + recentProjects 5개 표시 확인.

---

### Group F: State Management Extensions (REQ-BREADTH-054 ~ REQ-BREADTH-056)

#### REQ-BREADTH-054 (Ubiquitous)
**요구사항:** The Zustand store at `stores/ui.ts` SHALL be extended to match handoff §10.1 exact shape PLUS Phase 4 additions:
```ts
interface UIStore {
  // Phase 1 (existing)
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  currentProjectId: string | null;
  tweaksOpen: boolean;
  onboardingDone: boolean;
  // Phase 4 additions
  recentProjects: string[];       // max 5, most recent first
  pendingQuestion: string | null; // volatile, for Home → Chat prefill
  rightPanelCollapsed: boolean;   // desktop ≥1100px only
  // Actions
  setCurrentProject: (id: string | null) => void;
  setPendingQuestion: (q: string | null) => void;
  setOnboardingDone: (done: boolean) => void;
  toggleRightPanel: () => void;
}
```
The store SHALL use Zustand `persist` middleware with `partialize` excluding `pendingQuestion` and `tweaksOpen` (session-volatile fields). Persist key: `regula_ui`.

**근거:** handoff §10.1 (Phase 1 shape 정확 준수) + research.md persist 전략.
**검증 방법:** Store 초기화 후 6개 persist 필드 localStorage 확인. `pendingQuestion` 값 설정 후 새 탭 → undefined 확인.

#### REQ-BREADTH-055 (Event-driven)
**요구사항:** WHEN `setCurrentProject(id)` is called, THEN the store SHALL:
1. Update `currentProjectId = id`
2. IF `id !== null`, prepend `id` to `recentProjects` (dedupe) and slice to length 5
3. IF `id === null`, leave `recentProjects` unchanged

**근거:** research.md UI store 설계.
**검증 방법:** Unit test — 5가지 시나리오: null → idA → idB → idA (dedupe) → idC ... → recentProjects 길이 및 순서 검증.

#### REQ-BREADTH-056 (Ubiquitous)
**요구사항:** The system SHALL provide 8 TanStack Query hooks under `lib/queries/`:
| Hook | Query key | Endpoint | Notes |
|---|---|---|---|
| useConversations(filters) | `['conversations', filters]` | GET /api/ra/conversations | `useInfiniteQuery` for History |
| useConversation(id) | `['conversation', id]` | GET /api/ra/conversations/[id] | `enabled: !!id` |
| useProjects() | `['projects']` | GET /api/ra/projects | `staleTime: 10min` |
| useProject(id) | `['project', id]` | GET /api/ra/projects/[id] | `enabled: !!id` |
| useTemplates(filters) | `['templates', filters]` | GET /api/ra/templates | `staleTime: 30min` |
| useSources(filters) | `['sources', filters]` | GET /api/ra/sources (list) | Phase 4 added for Knowledge Base |
| useUpdates() | `['updates']` | GET /api/ra/updates | `useInfiniteQuery` |
| useDashboardStats(period) | `['dashboard', period]` | GET /api/ra/dashboard | `staleTime: 5min` (REQ-BREADTH-027) |

Query key invalidation rules:
- After `POST /api/ra/projects`: invalidate `['projects']`
- After `PATCH /api/ra/projects/[id]`: invalidate `['project', id]` AND `['projects']`
- After a new conversation completes streaming: invalidate `['conversations']`
- After feedback POST: invalidate `['conversation', convId]`

**근거:** handoff §10.2 exact hook list + React Query best practices.
**검증 방법:** 각 hook mount 후 query key + endpoint call assertion. Invalidation rule: create project → list refetch 확인.

---

### Group G: Audit + i18n Constraint Enforcement (REQ-BREADTH-057)

#### REQ-BREADTH-057 (Ubiquitous)
**요구사항:** Every Phase 4 API route (10 endpoints) SHALL invoke `writeAudit(...)` from FOUNDATION `lib/audit.ts` on every request outcome (success OR business-logic failure like 403/404; omit on 400 input-validation failures and 401 unauthenticated). The `action` enum values introduced by Phase 4 SHALL be:

| action | API endpoint | trigger |
|---|---|---|
| `conversations.list` | GET /api/ra/conversations | success |
| `conversation.view` | GET /api/ra/conversations/[id] | success |
| `message.feedback` | POST /api/ra/conversations/[id]/feedback | success |
| `template.list` | GET /api/ra/templates | success |
| `template.download` | GET /api/ra/templates/[id]/download | success |
| `updates.list` | GET /api/ra/updates | success |
| `dashboard.view` | GET /api/ra/dashboard | success |
| `projects.list` | GET /api/ra/projects | success |
| `project.create` | POST /api/ra/projects | 201 |
| `project.update` | PATCH /api/ra/projects/[id] | 200 |

**Enum 확장 mechanism (v0.2.0 C6 수정):** FOUNDATION v0.4.0 REQ-FND-044는 `action` 컬럼을 **`audit_action` pgEnum NOT NULL**으로 선언한다. 따라서 Phase 4 확장은 `lib/audit.ts` TypeScript union 추가 **AND** Postgres `ALTER TYPE audit_action ADD VALUE '<name>'` 마이그레이션(10개 값 × 1 SQL 파일, 단일 `migrations/0003_breadth_audit_actions.sql`에 묶음 적용)이 필요하다. FOUNDATION Phase 1 defined 3 values (`llm.call`, `source.access`, `expert_review.flag`); Phase 4 adds 10 values listed above. Phase 5 will add `auth.login` / `auth.logout` / `expert_review.resolve` / `checklist.toggle` / `consult.expert_review_auto_flag` etc. (ENTERPRISE REQ-ENTERPRISE-028 — FOUNDATION v0.4.0 REQ-FND-049 inventory table이 full enumeration 선제 제공).

**근거:** Non-Obvious Constraint #4 (21 CFR Part 11 audit every LLM call, source access, expert flag — Phase 4 extends to all user-facing API operations) + FOUNDATION v0.4.0 REQ-FND-049 (audit_action pgEnum inventory) + cross-spec-audit C6 (pgEnum 통일).
**검증 방법:** 10개 endpoint 각각 success path → audit_logs INSERT 확인 (action 값 매칭). 401 unauthenticated → audit 기록 없음. 400 Zod validation 실패 → 기록 없음 (노이즈 방지). TypeScript 컴파일: `lib/audit.ts` union에 10개 값 추가 후 call-site 3곳(llm.call, source.access, expert_review.flag 제외) 각각 type-check 통과. `SELECT enum_range(NULL::audit_action)` 결과가 Phase 1의 3값 + Phase 4의 10값 = 13값 포함 확인.

#### REQ-BREADTH-058 (Ubiquitous) [v0.2.0 C2 신규 — Permission Guard Placeholder]
**요구사항:** Every Phase 4 `/api/ra/*` Route Handler SHALL execute `getServerSession()` (Auth.js v5 helper) as the **first** action before any DB query, AND SHALL apply `organization_id = session.user.organizationId` as a hard WHERE-clause filter on every SELECT/UPDATE accessing org-scoped tables (`conversations`, `projects`, `sources` with non-NULL org_id, `templates`, `regulatory_updates`). IF `session` is null OR `session.user.organizationId` is undefined, THEN the handler SHALL return 401 Unauthorized without executing any DB query.

**Permission Guard 2-tier roadmap (v0.2.0 C2):**
- **Phase 4 minimum (이 REQ)**: role-agnostic `user.orgId` 필터만 적용. 동일 조직 내 모든 member는 서로의 data에 접근 가능 (Phase 4 테스트 시나리오 acceptance). 이 수준은 production-ready가 아니며 Phase 5 retrofit 필수.
- **Phase 5 retrofit (ENTERPRISE REQ-ENTERPRISE-021)**: `withPermission(<action>)` 래퍼 추가로 role-based (`admin`/`ra-lead`/`ra-member`/`viewer`) + project-scoped ACL 세분화. 기존 `user.orgId` 필터는 제거하지 않고 defense-in-depth로 유지.

**이 REQ의 의도:** cross-spec-audit C2 위험(BREADTH 10 APIs가 permission guard 없이 production에 도달하면 Phase 5 retrofit 대규모 regression)을 "no guard → minimum filter" 수준으로 상향 조정. Phase 4~5 전환 창에서 최소 org-isolation은 보장된다. Phase 4 배포가 staging 한정인 경우에도 이 수준은 보안 baseline.

**근거:** cross-spec-audit C2 (BREADTH production deploy 시 permission guard 부재 방지) + FOUNDATION REQ-FND-051~053 (Auth.js session 인프라) + ENTERPRISE REQ-ENTERPRISE-021 retrofit 준비.
**검증 방법:** (1) 모든 Phase 4 10개 Route Handler의 첫 statement가 `getServerSession()` 호출인지 정적 검사(ts-morph 또는 grep). (2) Integration test: session=null 요청 → 401 + DB query 미실행 spy 확인. (3) Cross-org 시나리오: orgA session으로 orgB 소속 conversation id 조회 → 404 (org existence leak 방지). (4) Phase 5 진입 시 `withPermission` 래핑 후 이 REQ의 org filter가 제거되지 않았는지 회귀 테스트.

---

## 의존성 (Dependencies)

### 상위 SPEC

| SPEC | 버전 | 본 Phase에서 활용하는 산출물 |
|---|---|---|
| SPEC-REGULA-FOUNDATION-001 | v0.3.0 | 13-table schema (projects, conversations, messages, message_sources, message_blocks, sources, source_sections, templates, regulatory_updates, audit_logs), append-only audit_logs triggers, `writeAudit()` helper signature, design tokens, Sidebar+Topbar shell, Auth.js v5 SSO, middleware auth-wall, Tailwind v4 @theme, Noto Serif KR+Pretendard 폰트 스택 |
| SPEC-REGULA-CHAT-001 (Phase 2) | TBD | `/api/ra/consult` SSE 스트리밍 핸들러, `useStreamingAnswer` 훅, `Composer` 컴포넌트, `fda` retriever(`lib/ai/retrievers/fda.ts`), Cohere Rerank 통합, citation 후처리 (post-process extract citations), `message_sources.cite_index` 기록 |
| SPEC-REGULA-STRUCTURED-001 (Phase 3) | TBD | `message_blocks` 6 block_type 렌더링 (`prose`/`checklist`/`comparison`/`timeline`/`sources`/`related`), `<AnswerBlock />` 합성 컴포넌트, `<Checklist />` / `<ComparisonTable />` / `<Timeline />` / `<SourcesGrid />` / `<SuggestionPills />`, `<RightContextPanel />` 스켈레톤 |

### 하위 SPEC (Phase 5+ 예정)

- `SPEC-REGULA-ENTERPRISE-001` (Phase 5) — Expert review 워크플로우, RBAC 세분화, dark mode polish, i18n 런타임 스위처, Sentry/Langfuse, Inngest reg-updates crawler, users.onboarded_at DB 이관, project soft-delete, audit_logs materialized view
- `SPEC-REGULA-QUALITY-001` (Phase 6) — Playwright e2e (8 views + project switching + API CRUD), intent classifier eval harness, 부하 테스트 (Dashboard 집계 10x), 보안 감사, 런치 문서

### 외부 의존성 (Phase 4 신규)

| 의존성 | 설명 | 담당 |
|---|---|---|
| `@tanstack/react-virtual` v3.11+ | 대용량 목록 가상화 (History, Updates) | regula-architect |
| `@radix-ui/react-popover` (이미 Phase 2 도입 가정) | ProjectChip dropdown + 기타 popover | regula-design-system |
| Cohere API Rerank v3 (Phase 2 도입 가정) | mergeAndRerank 구현 | regula-rag-pipeline |
| Claude Haiku API | intent classifier | regula-rag-pipeline |
| AWS S3 또는 Cloudflare R2 | 템플릿 파일 스토리지 (signed URL) — 환경변수 `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` 추가 | 사용자/DevOps |
| 규제 코퍼스 원천 데이터 (Phase 4 kickoff 전 수집) | EU MDR PDF, MFDS HTML, NMPA HTML, PMDA PDF, 샘플 SOP — 파싱·임베딩·DB적재는 Phase 5 Inngest crawler 전까지 manual seed script | regula-rag-pipeline + 사용자 |
| Sample impact_analysis_text seed 데이터 (10+ rows) | handoff §7.8 UI 검증용. Phase 5 LLM 자동 생성 전까지 수동 작성 | regula-rag-pipeline |
| 샘플 템플릿 파일 (PDF + DOCX, ~10개) | `scripts/seed-templates.ts` 업로드 | regula-backend + 사용자 |

---

## 위험 및 가정 (Risks & Assumptions)

| 구분 | 항목 | 영향 | 대응 |
|---|---|---|---|
| 위험 | 5개 코퍼스 품질 편차 (FDA 풍부 vs MFDS/NMPA/PMDA 부족) | 한국어 질문에 한국 규제 검색 결과 부족 → fallback으로 FDA 영어 결과 top 반환 → 오독 위험 | Phase 4 UI에서 "결과 부족 시 원본 언어 안내" 표시 (예: `해당 관할권 문서가 제한적입니다`). Phase 5 코퍼스 보강 우선순위 |
| 위험 | 프로젝트 전환 시 이전 SSE 스트림 취소 누수 (AbortController unmount leak) | 메모리 누수, 네트워크 대역 낭비 | `useStreamingAnswer` 훅 cleanup 강제 — Vitest로 unmount 시 AbortController.abort() 호출 검증 (REQ-BREADTH-051 연계) |
| 위험 | Dashboard 집계 쿼리 성능 (audit_logs > 15M rows scan) | P95 > 2s, 사용자 체감 악화 | 인덱스 `(created_at, action)` 생성 (Phase 4 migration에는 포함 안 함 — FOUNDATION 고정 원칙; 대신 `CREATE INDEX CONCURRENTLY`를 배포 스크립트로 수행) + TanStack Query `staleTime: 5min` (REQ-BREADTH-027). Phase 5 MV 도입 |
| 위험 | Intent classifier 오분류 (예: comparison → regulation-lookup 오분류) | 검색 결과 품질 저하 | Phase 6 eval set 구축 (100 sample questions × 6 intents 수동 레이블). 오분류율 > 5% 시 Phase 5에서 prompt 수정 또는 fine-tuned 대체 |
| 위험 | 템플릿 파일 스토리지 비용 증가 | 월 $50-200 추가 | S3 Intelligent-Tiering 활용 + 월 1회 stale file 감사 |
| 위험 | Cohere multilingual embedding 한국어 품질 부족 | MFDS 검색 품질 저하 | Phase 4 kickoff 시 샘플 10 질문으로 벤치마크. 실패 시 multilingual-e5-large 로컬 embedding fallback (Decision Point DP-1) |
| 위험 | TanStack Virtual v3 + React 19 + Next.js 15 호환성 | 빌드 실패 또는 SSR hydration 오류 | Phase 4 kickoff 시 smoke 테스트. 실패 시 react-virtuoso fallback (Technical Decision #2 재평가) |
| 위험 | projectId snapshot 누락 시 경쟁 조건 | 잘못된 project 컨텍스트로 답변 생성 | REQ-BREADTH-052 `useUIStore.getState()` 패턴으로 snapshot 강제, Vitest로 검증 |
| 위험 | 신규 audit action enum 값 누락 | 관리자가 용어 불일치 리포트 | REQ-BREADTH-057 명시 10개 값 + TypeScript union 컴파일 에러로 compile-time 강제 |
| 위험 | `/api/ra/projects` DELETE 부재에 따른 사용자 불만 | 프로젝트 정리 불가 | UI에서 "보관(archived)"으로 대체. Phase 5 soft-delete 도입 시 실제 제거 옵션 |
| 위험 | Impact analysis seed 품질 부족 | 규제 업데이트 page가 비어 보임 | Phase 4 kickoff 시 10+ sample regulatory_updates + impact_analysis_text 수동 작성. Phase 5 LLM 자동 생성으로 전환 |
| 위험 | Onboarding modal이 Composer 프리필과 동시에 열림 | UX 혼란 | REQ-BREADTH-007 상태 분리 — onboardingDone === false인 경우 모달 먼저 완료되어야 pendingQuestion 프리필 작동. 통합 테스트로 순서 검증 |
| 가정 | Phase 2 구현이 완료되어 있으며 `/api/ra/consult`가 안정적으로 동작 | Phase 4 변경 격리 가능 | Phase 4 kickoff 전 Phase 2 SPEC 상태 검증 |
| 가정 | Phase 3 구현이 완료되어 있으며 `<AnswerBlock />` 및 6 block types 렌더링 작동 | Phase 4 History detail 뷰에서 재사용 가능 | Phase 4 kickoff 전 Phase 3 SPEC 상태 검증 |
| 가정 | Phase 2가 embedding 모델로 OpenAI text-embedding-3-large (1536d) 또는 Cohere multilingual v3 (1024d with padding) 중 하나를 고정 | Phase 4 retriever가 동일 모델 사용 | Decision Point DP-1에서 확인 |
| 가정 | S3/R2 버킷이 Phase 4 kickoff 전 프로비저닝되어 있다 | 템플릿 업로드 가능 | 외부 의존성 항목 명시 |
| 가정 | 5개 코퍼스 raw 데이터 수집·파싱·임베딩은 사용자/데이터팀이 Phase 4 kickoff 전 완료 | retriever가 검색할 데이터 존재 | 외부 의존성 항목 명시 |
| 가정 | 조직별 격리(internal-sops)는 organizations 테이블 단일 레벨로 충분 | Phase 4 구현 단순성 | Phase 5 RBAC에서 project-level 격리로 확장 |
| 가정 | 사용자가 target_markets 설정을 최소 1개 프로젝트에 대해 완료한다 | Updates personalization 작동 | 미설정 시 전체 Updates fallback (REQ-BREADTH-034) |
| 가정 | Dashboard intent 집계는 `audit_logs.meta_json->>'intent'` 활용 가능 (Phase 2에서 llm.call 시 meta 기록) | 집계 쿼리 실행 가능 | Phase 2 산출물 검증. 부재 시 Phase 4에서 meta 기록 하위 호환 추가 |

---

## 테스트 전략 (Test Strategy)

### 단위 테스트 (Vitest)
- `lib/ai/router.ts` — 6 intent classifier mock 응답 처리, selectCorpora 매핑 7 scenarios, target_markets 필터
- `lib/ai/merge.ts` — dedupe + Cohere rerank mock, topK 제한, score 정렬
- `lib/ai/retrievers/*.ts` — 5 retriever 각각 SQL 쿼리 생성 assertion, region/type 필터 정확성, `internal-sops` org 격리 (REQ-BREADTH-043)
- `stores/ui.ts` — persist middleware, partialize 제외 필드, setCurrentProject dedupe logic (REQ-BREADTH-055)
- `lib/queries/*.ts` — 각 hook mount 시 올바른 endpoint + queryKey 호출, invalidation 규칙 smoke
- `components/onboarding/OnboardingModal.tsx` — 4 step navigation, localStorage persist
- `lib/seeds/homeQuickCards.ts` — 길이 4, 각 객체 TypeScript shape 컴파일

### 통합 테스트 (Vitest + Postgres 테스트 DB + MSW)
- `/api/ra/conversations` GET — filter + pagination + cursor-based, org isolation
- `/api/ra/conversations/[id]` — cross-user 403, 블록 6종 포함 응답
- `/api/ra/conversations/[id]/feedback` POST — audit 기록, Zod validation
- `/api/ra/sources/[id]?offset=N` — anchor-based highlight resolution (FOUNDATION REQ-FND-044c UNIQUE 제약 활용)
- `/api/ra/templates` GET + `/api/ra/templates/[id]/download` — format 파라미터, usage_count atomic 증가, audit
- `/api/ra/updates` — personalization (3 scenarios: no projects / matching / non-matching), infinite cursor
- `/api/ra/dashboard` — 7 집계 쿼리 정확성, delta 계산, period 3가지
- `/api/ra/projects` GET/POST/PATCH — org filter, Zod, audit 기록, DELETE 405 (REQ-BREADTH-040)
- `/api/ra/consult` + Phase 4 router 통합 — classifyIntent → selectCorpora → 5 parallel retrievers → mergeAndRerank → Phase 2 streaming (REQ-BREADTH-047)
- `internal-sops` retriever org 격리 회귀 (2 orgs × 2 SOPs seed) — REQ-BREADTH-043 critical 검증

### 컴포넌트 테스트 (Vitest + @testing-library/react)
- Home: 4 sections 순서 + Quick grid click → pendingQuestion → Composer 프리필 (REQ-BREADTH-001, -003)
- History: TanStack Virtual 1K rows smoke, infinite scroll 트리거 (REQ-BREADTH-009)
- Templates: 3-col grid auto-fill, download button click spy (REQ-BREADTH-013, -014)
- Knowledge Base: 3 group 분류 정확성, Internal SOPs org 필터 (REQ-BREADTH-015)
- Updates: severity=critical → amber accent + HIGH IMPACT tag, 영향도 분석 modal (REQ-BREADTH-018, -019)
- Dashboard: 4 stat card 렌더링, 질의 유형별 분포 정렬, staleTime 5min (REQ-BREADTH-022~-027)
- Onboarding: 4 step 순환, skip/complete → localStorage (REQ-BREADTH-007)
- Project switching: Sidebar click → Zustand state, Composer 값 유지 (REQ-BREADTH-049, -051)
- ProjectChip: dropdown + recentProjects 5개 (REQ-BREADTH-053)

### 성능 smoke
- History 10,000 rows 렌더 시 FPS ≥ 55 — Playwright 성능 프로파일링 (Phase 6에서 본격 실행, Phase 4는 수동 검증)
- 5-corpus 병렬 retrieval P95 ≤ 800ms — mocked retriever (150ms) × 5 with Promise.all → ≤ 500ms (네트워크 overhead 제외 baseline)
- Dashboard 집계 쿼리 P95 — 15M audit_logs 시드 시 ≤ 500ms (`(created_at, action)` 인덱스 전제)

### 정적 검증
- Biome lint 통과 (0 warnings, 0 errors)
- TypeScript strict 컴파일 통과 (`pnpm typecheck`) — 10개 새 audit action union 추가 후 기존 call-site 컴파일 확인
- Next.js 프로덕션 빌드 성공 (`pnpm build`)
- Tailwind 유틸리티 unused purge 정상 작동 (Phase 1 config 유지)

### Playwright 인프라 준비 (Phase 6 이관)
- `tests/e2e/history.spec.ts` — skeleton only (Phase 4)
- `tests/e2e/dashboard.spec.ts` — skeleton only
- `tests/e2e/project-switching.spec.ts` — skeleton only

---

## 산출물 (Deliverables)

| # | 파일 경로 | 유형 | 책임 에이전트 | handoff 섹션 / REQ |
|---|---|---|---|---|
| 1 | `app/(app)/page.tsx` | 수정 (확장) | regula-frontend | §7.3 / REQ-BREADTH-001~-006 |
| 2 | `app/(app)/history/page.tsx` | 신규 | regula-frontend | §7.5 / REQ-BREADTH-008~-012 |
| 3 | `app/(app)/templates/page.tsx` | 신규 | regula-frontend | §7.6 / REQ-BREADTH-013, -014 |
| 4 | `app/(app)/knowledge/page.tsx` | 신규 | regula-frontend | §7.7 / REQ-BREADTH-015~-017 |
| 5 | `app/(app)/updates/page.tsx` | 신규 | regula-frontend | §7.8 / REQ-BREADTH-018~-021 |
| 6 | `app/(app)/dashboard/page.tsx` | 신규 | regula-frontend | §7.9 / REQ-BREADTH-022~-027 |
| 7 | `components/onboarding/OnboardingModal.tsx` | 신규 | regula-frontend | §7.11 / REQ-BREADTH-007 |
| 8 | `components/chat/ProjectChip.tsx` | 신규 | regula-frontend | §7.2 / REQ-BREADTH-053 |
| 9 | `components/chat/RightContextPanel.tsx` | 수정 (Phase 3 스켈레톤 → Phase 4 실데이터 wire-up, v0.2.0 C5) | regula-frontend | §7.4 / REQ-BREADTH-050 |
| 10 | `components/shell/Sidebar.tsx` | 수정 (Projects 섹션 실데이터) | regula-frontend | §7.1 / REQ-BREADTH-049 |
| 11 | `app/api/ra/conversations/route.ts` | 신규 | regula-backend | §11.2 / REQ-BREADTH-028 |
| 12 | `app/api/ra/conversations/[id]/route.ts` | 신규 | regula-backend | §11.3 / REQ-BREADTH-029 |
| 13 | `app/api/ra/conversations/[id]/feedback/route.ts` | 신규 | regula-backend | §11.4 / REQ-BREADTH-030 |
| 14 | `app/api/ra/sources/[id]/route.ts` | 신규 (Phase 2 확장) | regula-backend | §11.5 / REQ-BREADTH-031 |
| 15 | `app/api/ra/templates/route.ts` | 신규 | regula-backend | §11.6 / REQ-BREADTH-032 |
| 16 | `app/api/ra/templates/[id]/download/route.ts` | 신규 | regula-backend | §11.6 / REQ-BREADTH-033 |
| 17 | `app/api/ra/updates/route.ts` | 신규 | regula-backend | §11.7 / REQ-BREADTH-034 |
| 18 | `app/api/ra/dashboard/route.ts` | 신규 | regula-backend | §11.9 / REQ-BREADTH-035 |
| 19 | `app/api/ra/projects/route.ts` | 신규 | regula-backend | §9.4 / REQ-BREADTH-036, -037 |
| 20 | `app/api/ra/projects/[id]/route.ts` | 신규 | regula-backend | §9.4 / REQ-BREADTH-038, -039, -040 |
| 21 | `lib/ai/retrievers/types.ts` | 재사용/확장 | regula-rag-pipeline | §11.1 / REQ-BREADTH-041 |
| 22 | `lib/ai/retrievers/eu-mdr.ts` | 신규 | regula-rag-pipeline | §11.1 / REQ-BREADTH-042 |
| 23 | `lib/ai/retrievers/mfds.ts` | 신규 | regula-rag-pipeline | §11.1 / REQ-BREADTH-042 |
| 24 | `lib/ai/retrievers/nmpa.ts` | 신규 | regula-rag-pipeline | §11.1 / REQ-BREADTH-042 |
| 25 | `lib/ai/retrievers/pmda.ts` | 신규 | regula-rag-pipeline | §11.1 / REQ-BREADTH-042 |
| 26 | `lib/ai/retrievers/internal-sops.ts` | 신규 (org 격리) | regula-rag-pipeline + regula-compliance-qa | §11.1 / REQ-BREADTH-042, -043 |
| 27 | `lib/ai/router.ts` | 신규 (Haiku + selectCorpora) | regula-rag-pipeline | §11.1 / REQ-BREADTH-044, -045 |
| 28 | `lib/ai/merge.ts` | 신규 (dedupe + Rerank) | regula-rag-pipeline | §11.1 / REQ-BREADTH-046 |
| 29 | `app/api/ra/consult/route.ts` | 수정 (Phase 2 확장 — retrieval substep만) | regula-rag-pipeline | §11.1 / REQ-BREADTH-047 |
| 30 | `lib/queries/useConversations.ts` | 신규 | regula-frontend | §10.2 / REQ-BREADTH-056 |
| 31 | `lib/queries/useConversation.ts` | 신규 | regula-frontend | §10.2 / REQ-BREADTH-056 |
| 32 | `lib/queries/useProjects.ts` | 신규 | regula-frontend | §10.2 / REQ-BREADTH-056 |
| 33 | `lib/queries/useProject.ts` | 신규 | regula-frontend | §10.2 / REQ-BREADTH-056 |
| 34 | `lib/queries/useTemplates.ts` | 신규 | regula-frontend | §10.2 / REQ-BREADTH-056 |
| 35 | `lib/queries/useSources.ts` | 신규 | regula-frontend | §10.2 / REQ-BREADTH-056 |
| 36 | `lib/queries/useUpdates.ts` | 신규 | regula-frontend | §10.2 / REQ-BREADTH-056 |
| 37 | `lib/queries/useDashboardStats.ts` | 신규 | regula-frontend | §10.2 / REQ-BREADTH-056 |
| 38 | `stores/ui.ts` | 수정 (확장) | regula-frontend | §10.1 / REQ-BREADTH-054, -055 |
| 39 | `stores/project.ts` | 신규 | regula-frontend | §9.4 / REQ-BREADTH-049, -050 |
| 40 | `lib/seeds/homeQuickCards.ts` | 신규 (static seed) | regula-frontend | §7.3 / REQ-BREADTH-004 |
| 41 | `scripts/seed-templates.ts` | 신규 (S3 업로드 + INSERT) | regula-backend | §7.6 / Phase 4 kickoff |
| 42 | `scripts/seed-regulatory-updates.ts` | 신규 (impact_analysis_text 포함) | regula-rag-pipeline | §7.8 / Phase 4 kickoff |
| 43 | `lib/audit.ts` | 수정 (union type 확장: 10개 신규 action) | regula-compliance-qa | §16 / REQ-BREADTH-057 |
| 44 | `components/chat/Composer.tsx` | 수정 (pendingQuestion 프리필) | regula-frontend | §7.4 / REQ-BREADTH-003 |
| 45 | `hooks/useStreamingAnswer.ts` | 수정 (projectId snapshot at submit) | regula-frontend | §10.3 / REQ-BREADTH-052 |

---

## 완료 조건 (Definition of Done)

본 Phase 완료로 간주하려면 다음 24개 조건을 **모두** 충족해야 한다:

### Build/Lint/Typecheck 계속 통과
- [ ] `pnpm install --frozen-lockfile` 성공 (FOUNDATION REQ-FND-008 회귀)
- [ ] `pnpm typecheck` 0 오류 (FOUNDATION REQ-FND-009 회귀 + Phase 4 10개 신규 audit action union 포함)
- [ ] `pnpm build` 성공 (FOUNDATION REQ-FND-010 회귀 + 새 API 라우트 컴파일)
- [ ] Biome lint 0 warnings / 0 errors

### API 계층
- [ ] 10개 API endpoint 모두 Zod 입력 검증 통과 + organization scope 필터 적용
- [ ] 10개 endpoint 모두 성공 시 `writeAudit()` 호출 (REQ-BREADTH-057)
- [ ] `/api/ra/projects` DELETE 요청 → `405 Method Not Allowed` 응답 (REQ-BREADTH-040)
- [ ] `/api/ra/templates/[id]/download` 호출 시 `templates.usage_count` atomic 증가 + `audit_logs` 기록 (REQ-BREADTH-033)

### RAG 파이프라인
- [ ] 5개 신규 retriever (`eu-mdr`, `mfds`, `nmpa`, `pmda`, `internal-sops`) 모두 `CorpusRetriever` 인터페이스 준수 + 단위 테스트 PASS (REQ-BREADTH-042)
- [ ] `internal-sops` retriever org 격리 회귀 테스트 PASS: orgA session → orgB SOPs 부재 (REQ-BREADTH-043)
- [ ] `lib/ai/router.ts` classifyIntent 6 intent 정확 반환 + unknown 값 → `regulation-lookup` fallback (REQ-BREADTH-044)
- [ ] `/api/ra/consult` 호출 시 intent → 5 corpora 병렬 호출 → merge → Sonnet streaming 통합 작동 (REQ-BREADTH-047)
- [ ] 5-corpus 병렬 retrieval P95 ≤ 800ms (mocked 150ms × 5 with Promise.all) (REQ-BREADTH-048)

### 8 Views 렌더링
- [ ] Home `/` 페이지에서 Hero + Quick grid (4 cards) + 최근 질의 (4) + 빠른 템플릿 (3) 렌더링 (REQ-BREADTH-001~-006)
- [ ] Home Hero H1 정확히 `무엇을 <em>검토</em>해 드릴까요?` + `<em>` brand-700 italic (REQ-BREADTH-002)
- [ ] History `/history` TanStack Virtual 10K rows 시뮬레이션 시 스크롤 smooth + infinite scroll 작동 (REQ-BREADTH-009)
- [ ] Templates `/templates` 3-col grid + PDF/DOCX 다운로드 동작 (REQ-BREADTH-013, -014)
- [ ] Knowledge Base `/knowledge` 3 그룹 분류 정확성 + Internal 그룹은 current org만 (REQ-BREADTH-015)
- [ ] Updates `/updates` severity=critical UpdateCard → amber accent + `HIGH IMPACT` tag (REQ-BREADTH-018) + 영향도 분석 modal (REQ-BREADTH-019)
- [ ] Dashboard `/dashboard` 4 stat cards + 질의 유형별 분포 + 규제 소스 커버리지 + 팀 최근 활동 모두 렌더링 (REQ-BREADTH-022~-026)
- [ ] Onboarding modal 첫 방문 시 렌더링, 4 step 순환, 완료 시 localStorage persist (REQ-BREADTH-007)

### State Management
- [ ] Zustand `stores/ui.ts` 6 persist 필드 + 2 volatile 필드 (pendingQuestion, tweaksOpen) partialize (REQ-BREADTH-054)
- [ ] `setCurrentProject(id)` 호출 시 `recentProjects` dedupe + max 5 유지 (REQ-BREADTH-055)

### Project Switching
- [ ] Sidebar 프로젝트 click → `currentProjectId` 갱신 → RightContextPanel 헤더 실데이터 + Composer 입력 보존 + in-flight 스트림 유지 (REQ-BREADTH-049, -050, -051, -052)

### 감사 / 한국어 UI
- [ ] Phase 4 10개 신규 audit action 값이 `lib/audit.ts` union에 추가되고 call-site 컴파일 통과 (REQ-BREADTH-057)
- [ ] 8 views 모두 한국어 UI 기본 (hardcoded Korean, Phase 5 i18n 런타임 스위처 전까지 허용)

---

## 관련 문서

### Handoff 섹션
- §4 Recommended Tech Stack — 의존성 확장 (TanStack Virtual 추가)
- §5 Project Structure — `app/api/ra/*` 확장, `lib/ai/retrievers/*` 5개 추가
- §6 Design Tokens — Phase 1 상속 (수정 없음)
- §7.1 Shell — Sidebar Projects 섹션 실데이터 연결
- §7.2 Shell — Topbar에 ProjectChip 추가
- §7.3 Home — 스켈레톤 → 실데이터 확장
- §7.4 Chat / RightContextPanel — 실데이터 연결
- §7.5 History
- §7.6 Templates
- §7.7 Knowledge Base
- §7.8 Regulatory Updates
- §7.9 Dashboard
- §7.11 Onboarding
- §9.1 Chat submission flow — projectId 파라미터 포함 추가
- §9.4 Project context
- §10.1 Global Zustand 확장
- §10.2 TanStack Query 8 hooks
- §11.2 ~ §11.9 Backend APIs (7 endpoints) + Phase 4 확정 `/api/ra/projects` (§11 범위 외지만 Phase 4에서 결정)
- §15 Performance — 10K rows FPS ≥ 55, 5-corpus parallel P95 ≤ 800ms
- §16 Security — audit_logs 확장 10개 action
- §20 Implementation Roadmap — Phase 4 Breadth 블록

### MoAI 프로젝트 문서
- `.moai/project/product.md` — 7개 Non-Obvious Constraints (본 Phase: #4 audit + #6 i18n 적용)
- `.moai/project/structure.md` — `app/(app)` 라우트 그룹 확장, `app/api/ra` 라우트 확장
- `.moai/project/tech.md` — RAG 파이프라인 (intent classifier + 6 corpora), TanStack Query 8 hooks

### 의존 SPEC
- `SPEC-REGULA-FOUNDATION-001` v0.3.0 — 13 tables schema, audit_logs append-only, writeAudit 헬퍼 시그니처, design tokens, Sidebar/Topbar 스켈레톤
- `SPEC-REGULA-CHAT-001` (Phase 2) — `/api/ra/consult` SSE 핸들러, `useStreamingAnswer`, `fda` retriever, Composer
- `SPEC-REGULA-STRUCTURED-001` (Phase 3) — 6 block_type 렌더링 (`<AnswerBlock />`, `<Checklist />` 등), `<RightContextPanel />` 스켈레톤

### Non-Obvious Constraints ↔ REQ-BREADTH 매트릭스

| # | Constraint (product.md) | Phase 4 관련 REQ | 상태 |
|---|---|---|---|
| 1 | 모든 LLM 주장에 inline `<sup>` citation 강제 | — | Phase 2 적용 완료, Phase 4는 conversation detail view에서 렌더링만 (REQ-BREADTH-029) |
| 2 | SSE 다단계 스트리밍 (trace → prose → structured) | — | Phase 2 완료, Phase 4는 projectId snapshot만 추가 (REQ-BREADTH-052) |
| 3 | Expert-review 자동 게이팅 | — | Phase 2 완료, Phase 4는 History에 `expert_review_required` 플래그 표시만 (REQ-BREADTH-010 meta) |
| 4 | **21 CFR Part 11 audit_logs** | **REQ-BREADTH-028~-040, -057 (10개 API 모두)** | **본 Phase 핵심 제약 — 10개 신규 action enum 값 + 모든 success path에서 writeAudit** |
| 5 | Serif/Sans 타이포그래피 대비 | REQ-BREADTH-002 (Hero serif 48px), REQ-BREADTH-008 (History serif 32px), REQ-BREADTH-010 (serif 16px 질문), REQ-BREADTH-023 (stat card serif 32px) | 자연 상속 (tokens.css + Tailwind `font-serif`) |
| 6 | **한/영 이중언어 first-class** | **REQ-BREADTH UI 전반 (한국어 hardcoded), REQ-BREADTH-051 (리로드 없이 대화 유지 원칙 적용)** | **본 Phase 적용 (Korean UI default). i18n 런타임 스위처는 Phase 5** |
| 7 | Auth 뒤 전역 noindex | — | FOUNDATION metadata 상속, Phase 4 override 없음 |

### 프로토타입 참조 (직접 복사 금지)
- `RA-bot-design/design_handoff_regula/design_files/src/views/HomeView.jsx` — §7.3 레이아웃 의도 참조
- `RA-bot-design/design_handoff_regula/design_files/src/views/OtherViews.jsx` — §7.5~§7.9 레이아웃 참조
- `RA-bot-design/design_handoff_regula/design_files/src/Modals.jsx` — §7.11 Onboarding modal 참조
- `RA-bot-design/design_handoff_regula/screenshots/{01-home, 03-dashboard, 04-templates, 05-updates, 06-history, 07-knowledge-base}.png` — 최종 시각 레퍼런스

---

## Pending Cross-Audit Findings (v0.2.0)

cross-spec-audit.md(2026-04-22)의 High/Medium findings 중 본 iteration에서 해소되지 않고 후속 Wave에서 추적할 항목.

| ID | 요약 | 해당 SPEC | 추적 상태 |
|---|---|---|---|
| H5 | Project delete 구현 오너십 미할당 (BREADTH 405, ENTERPRISE REQ 부재) | ENTERPRISE | Phase 5 kickoff에서 projects.deleted_at 컬럼 + DELETE endpoint 추가 여부 결정 |
| H6 | Users CRUD endpoint 구현 오너십 미할당 | ENTERPRISE | Phase 5 kickoff에서 `app/api/ra/users/*` 도입 여부 결정 |
| M2 | Regulatory updates impact_analysis LLM 실시간 생성 (현재 seed pre-generated) | ENTERPRISE 또는 Post-launch | Phase 5 Inngest crawler와 병렬 도입 여부 결정 |
| M3 | Onboarding DB persist (`users.onboarded_at` 컬럼) — 현재 localStorage only | ENTERPRISE 또는 Post-launch | Phase 5 migration 포함 여부 결정 |
| M4 | `audit_logs` materialized view (dashboard 집계 성능 최적화) | ENTERPRISE 또는 Post-launch | production 트래픽 데이터 수집 후 재평가 |
| L1 | `users.intent` 컬럼 승격 (현재 audit_logs.meta_json 사용) | Post-launch | tracking |
| L2 | Regulatory updates Inngest crawler | ENTERPRISE | Phase 5 |
| L3 | `sources.last_synced_at` 실시간 갱신 | ENTERPRISE | Phase 5 Inngest 연동 시 |

기타 Medium/Low findings는 각 Phase 진입 시 해당 SPEC 이터레이션에서 개별 결정.
