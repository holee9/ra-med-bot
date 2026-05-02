---
name: regula
description: "Regula (의료기기 RA 전문가 AI 챗봇) 프로젝트의 마스터 오케스트레이터. Phase 1-6 Roadmap을 에이전트 팀 재구성 방식으로 실행한다. 'Regula', 'RA bot', '의료기기 규제', 'RA 챗봇', 'FDA RAG', 'EU MDR', 'regulatory affairs bot', 'handoff 구현', 'Next.js 15 스캐폴딩', '규제 챗봇 빌드' 등 키워드 시 반드시 사용. 후속 작업: 재실행, 업데이트, 수정, 보완, 다시 실행, 특정 Phase만, 이전 결과 기반 개선, 부분 재실행, QA 리포트, 특정 에이전트 재호출 요청 시에도 반드시 이 스킬을 사용."
---

# Regula Master Orchestrator

Regula 프로젝트의 마스터 오케스트레이터. handoff README §20의 Implementation Roadmap 6개 Phase를 에이전트 팀 재구성 방식으로 실행한다.

## 실행 모드: 에이전트 팀 + Phase별 재구성

각 Phase마다 해당 작업에 맞는 팀을 `TeamCreate`로 구성하고, Phase 종료 시 `TeamDelete`로 해체 후 다음 Phase의 팀을 새로 생성한다. 산출물은 `_workspace/phase-N/`에 보존되어 다음 팀이 Read로 접근한다.

## 에이전트 카탈로그

| 에이전트 | 역할 | 주 사용 스킬 |
|---------|------|-------------|
| regula-architect | 프로젝트 스캐폴딩, 아키텍처 결정, Drizzle schema | regula-handoff-reader, regula-design-tokens |
| regula-design-system | tokens.css → Tailwind v4 @theme 매핑, serif/sans | regula-design-tokens, regula-handoff-reader, regula-i18n |
| regula-frontend | React 컴포넌트, useStreamingAnswer, Zustand, Onboarding | regula-streaming-contract, regula-citation-contract, regula-design-tokens, regula-handoff-reader, regula-i18n |
| regula-rag-pipeline | LLM orch, retrievers, citation enforcement | regula-citation-contract, regula-streaming-contract, regula-expert-review-gating, regula-audit-compliance, regula-handoff-reader |
| regula-backend | Route Handlers, SSE, Drizzle queries, Auth.js | regula-audit-compliance, regula-streaming-contract, regula-handoff-reader, regula-expert-review-gating |
| regula-compliance-qa | citation 검증, audit 완전성, WCAG, LLM eval, 경계면 교차 검증 | regula-audit-compliance, regula-citation-contract, regula-expert-review-gating, regula-i18n, regula-design-tokens |
| regula-corpus-ingestion (신설) | 6 corpus chunking/embedding/pgvector upsert, crawlers, update-monitor | regula-handoff-reader, regula-audit-compliance, regula-citation-contract |
| regula-security-audit (신설) | CSP/HSTS/CSRF/SSRF/rate-limit 구현, OWASP, gitleaks, pen-test plan | regula-audit-compliance, regula-expert-review-gating |
| regula-observability (신설) | Sentry/PostHog/Langfuse/Vercel Analytics 4-way wiring, structured logger | regula-audit-compliance (경계만), regula-handoff-reader |

모두 `model: opus`, `general-purpose` agent_type 사용. 모든 agent는 YAML frontmatter `skills:` 배열로 domain skill을 context에 preload (C4 해소).

## Roadmap Phase × 팀 구성

| Phase | 팀명 | 팀원 | 산출물 |
|-------|------|------|-------|
| Phase 0 Remediation (신설) | (no team — builder/manager 서브 에이전트로 직접 수행) | builder-agent, builder-skill, manager-project, plan-auditor (재감사) | 3 신규 agent + 6 agent frontmatter skills: patch + orchestrator SKILL.md 갱신 |
| Phase 1 Foundation | regula-foundation-team | architect, design-system, backend, compliance-qa, **corpus-ingestion (schema DDL 조율)** | `_workspace/phase-1/` + 실제 프로젝트 파일 |
| Phase 2 Chat core | regula-chat-team | frontend, rag-pipeline, backend, compliance-qa, **corpus-ingestion (FDA corpus seed)** | `_workspace/phase-2/` + Chat 관련 파일 + FDA `source_sections` populated |
| Phase 3 Structured outputs | regula-structured-team | frontend, rag-pipeline, compliance-qa | `_workspace/phase-3/` + 구조화 블록 |
| Phase 4 Breadth | regula-breadth-team | frontend, backend, compliance-qa, **design-system (6 view token drift 방지)**, **corpus-ingestion (EU MDR/MFDS/NMPA/PMDA/internal 5 corpora populate)** | `_workspace/phase-4/` + 8 view 페이지 완성 + Onboarding modal + 5 corpora |
| Phase 5 Enterprise | regula-enterprise-team | backend, rag-pipeline, design-system, compliance-qa, **frontend (ExpertReviewCallout + LocaleToggle + ThemeToggle)**, **security-audit (신설, CSP/HSTS/CSRF/SSRF impl)**, **observability (신설, Sentry/PostHog/Langfuse/Vercel wiring)**, **corpus-ingestion (update-monitor cron)** | `_workspace/phase-5/` + expert review, audit, i18n, a11y, 4-way observability, OWASP compliance |
| Phase 6 Quality & launch | regula-quality-team | compliance-qa (lead) + architect, backend, **rag-pipeline (eval iteration prompt 수정)**, **security-audit (pen-test plan + OWASP 재검증)**, 선택적 **expert-devops** (GitHub Actions CI/CD) | `_workspace/phase-6/` + LLM eval, E2E, 로드 테스트, pen-test plan, 보안 감사 |

## 워크플로우

### Phase 0a: 컨텍스트 확인 (후속 작업 지원)

항상 먼저 실행한다. 실행 모드를 결정한다.

1. `_workspace/` 디렉토리 존재 여부 확인 (Bash `ls -la _workspace/`)
2. `_workspace/phase-*/qa_report.md`로 이전 진행 Phase 파악
3. 사용자 입력 분석:
   - **새 프로젝트 시작:** `_workspace/` 없음 → Phase 0b Remediation 확인 후 Phase 1부터 초기 실행
   - **다음 Phase 진행:** 예) "Phase 2 시작해줘" → 이전 Phase 산출물 Read 후 다음 Phase 팀 구성
   - **부분 재실행:** 예) "design-system 쪽 토큰 매핑 다시" → 해당 에이전트만 서브 에이전트로 호출, 기존 산출물 Edit
   - **전면 재실행:** 예) "Phase 1 처음부터 다시" → 기존 `_workspace/phase-1/`를 `_workspace/phase-1-{YYYYMMDD-HHMMSS}/`로 이동 후 재시작
   - **QA 리포트만 요청:** 최신 `_workspace/phase-N/qa_report.md`를 Read하여 요약
4. 모드가 애매하면 사용자에게 확인 (그러나 에이전트가 아닌 MoAI 오케스트레이터가 AskUserQuestion 사용)

### Phase 0b: Remediation (하네스 Critical 해소, 신설)

**목적:** `harness-gap-audit.md`의 Critical 4건(C1~C4)을 구조적으로 해소하여 Phase 2 진입 차단을 푼다. **Phase 0b는 SPEC이 아니라 하네스 메타-작업**이다 — `.moai/specs/` 아래 SPEC 문서 생성 없음. 본 Phase는 team을 만들지 않고 builder/manager 서브 에이전트를 순차 호출한다.

**작업 순서 (C 우선순위 기반):**

1. **C4 (Critical, 전 Phase 차단) — agent frontmatter `skills:` 연결**
   - 서브 에이전트: `builder-agent`
   - 대상: 6 기존 agent 파일 (`regula-architect`, `regula-design-system`, `regula-frontend`, `regula-rag-pipeline`, `regula-backend`, `regula-compliance-qa`)
   - 작업: 각 파일 YAML frontmatter에 `skills:` 배열 추가 (본문 수정 금지)
   - 검증: 각 agent 로드 시 해당 skill이 context에 실제 주입되는지 `/agents` 또는 dry-run 테스트

2. **C3 (Critical, Phase 2 차단) — `regula-corpus-ingestion` agent 신설**
   - 서브 에이전트: `builder-agent`
   - 산출물: `.Codex/agents/regula/regula-corpus-ingestion.md`
   - 역할: 6 corpus chunking/embedding/pgvector upsert + crawlers + update-monitor
   - Team 합류: Phase 1 (schema DDL 조율), Phase 2 (FDA seed), Phase 4 (5 corpora), Phase 5 (update-monitor cron), Phase 6 (eval fixture)

3. **C1 (Critical, Phase 5 차단) — `regula-security-audit` + `regula-observability` agent 신설 + Langfuse 소유권 이관**
   - 서브 에이전트: `builder-agent`
   - 산출물:
     - `.Codex/agents/regula/regula-security-audit.md` (OWASP, CSP/HSTS/CSRF/SSRF, rate-limit, gitleaks, pen-test plan)
     - `.Codex/agents/regula/regula-observability.md` (Sentry/PostHog/Langfuse/Vercel 4-way wiring)
   - Langfuse wrapper 소유권을 rag-pipeline → observability로 이관 (rag-pipeline은 invoke만)
   - compliance-qa는 audit 완전성 검증만 유지 (implementation 제거)

4. **C2 (Critical, Phase 4 차단) — §7.11 Onboarding 오너 지정**
   - 서브 에이전트: `builder-agent` (regula-frontend.md 본문 확장)
   - 작업: regula-frontend.md 핵심 역할에 "Onboarding (§7.11) — 4-step modal, step-dot progress, `regula_onboarded=1` localStorage" 추가
   - Phase 4 task 목록에 `(frontend) OnboardingModal.tsx` 명시 추가

5. **High findings 병행 해소 (선택적, Phase 0b에 포함 권장)**
   - H1: Phase 4 team에 design-system 추가 (본 SKILL.md Phase × Team 매트릭스에 이미 반영)
   - H2: Phase 5 team에 frontend 추가 (본 SKILL.md Phase × Team 매트릭스에 이미 반영)

6. **재감사 (plan-auditor)**
   - Phase 2 진입 허용 판정을 위해 `plan-auditor` 서브 에이전트로 `harness-gap-audit.md` 재실행
   - 3 조건 모두 만족 시 Phase 0b 종료 및 Phase 1 정상 진입:
     1. `harness-gap-audit-v2.md`의 Critical 0건 + `verdict: PROCEED_TO_PHASE_2`
     2. 본 SKILL.md Phase × Team 매트릭스가 master-roadmap.md §7과 일치
     3. 3 신규 agent 파일이 `.Codex/agents/regula/` 아래 존재 + 6 기존 agent 파일의 frontmatter에 `skills:` 배열 존재

**팀 구성:** 없음. builder/manager 서브 에이전트 직접 호출.

**에러 핸들링:**
- builder-agent가 skills 배열 포맷 오류 (CSV 사용 등) 생성 시 즉시 YAML 수정 후 재시도
- plan-auditor가 여전히 Critical 존재 판정 시 해당 finding의 Remediation 섹션을 다시 실행하고 재감사

### Phase 1: Foundation (스캐폴딩 + 기반)

**목표:** Next.js 15 프로젝트 스캐폴딩, Tailwind v4 토큰 매핑, Auth.js SSO skeleton, Drizzle schema, Sidebar + Topbar shell, Home 페이지 + 빈 Chat 페이지.

**핵심 산출물:** 실제 `package.json`, `next.config.mjs`, `tsconfig.json`, `biome.json`, `drizzle.config.ts`, `app/layout.tsx`, `app/(app)/layout.tsx`, `app/(app)/page.tsx` (Home), `app/(app)/chat/page.tsx` (empty state), `components/shell/Sidebar.tsx`, `components/shell/Topbar.tsx`, `styles/tokens.css`, `app/globals.css`, `lib/db/schema.ts`, `lib/db/client.ts`, `lib/auth.ts`, `.env.example`.

**팀 구성:**
```
TeamCreate(
  team_name: "regula-foundation-team",
  members: [
    {
      name: "architect",
      agent_type: "general-purpose",
      model: "opus",
      prompt: "당신은 .Codex/agents/regula/regula-architect.md의 역할을 수행합니다. Phase 1의 스캐폴딩 담당. handoff README §4, §5, §12, §18을 참조. 산출물 경로는 프로젝트 루트 기준 (package.json, app/layout.tsx 등) 및 _workspace/phase-1/architect_scaffold.md."
    },
    {
      name: "design-system",
      agent_type: "general-purpose",
      model: "opus",
      prompt: "당신은 .Codex/agents/regula/regula-design-system.md의 역할을 수행합니다. Phase 1에서 tokens.css → Tailwind v4 @theme 매핑. handoff README §6, §14 참조. 산출물: styles/tokens.css, app/globals.css, _workspace/phase-1/design_system_map.md."
    },
    {
      name: "backend",
      agent_type: "general-purpose",
      model: "opus",
      prompt: "당신은 .Codex/agents/regula/regula-backend.md의 역할을 수행합니다. Phase 1에서 Auth.js SSO skeleton + Drizzle schema 구현. handoff README §11, §12, §16 참조. 산출물: lib/auth.ts, lib/db/schema.ts (append-only audit_logs 포함), lib/db/client.ts, lib/audit.ts, migrations/, _workspace/phase-1/backend_api_matrix.md."
    },
    {
      name: "compliance-qa",
      agent_type: "general-purpose",
      model: "opus",
      prompt: "당신은 .Codex/agents/regula/regula-compliance-qa.md의 역할을 수행합니다. Phase 1의 구조 검증 + audit_logs append-only 트리거 SQL 검증 + 폴더 경계 준수 검증. 산출물: _workspace/phase-1/qa_report.md."
    }
  ]
)
```

**작업 등록 (TaskCreate):**

1. (architect) "package.json + 의존성 결정"
2. (architect) "Next.js 설정 파일들 (next.config, tsconfig, biome, drizzle.config)"
3. (architect) "app/layout.tsx + app/(app)/layout.tsx + app/(app)/page.tsx (Home) + app/(app)/chat/page.tsx (empty)"
4. (design-system, depends on 2) "styles/tokens.css (@theme) + app/globals.css + 폰트 로딩"
5. (design-system) "design_system_map.md — 토큰-클래스 매핑표"
6. (backend, depends on 2) "lib/db/schema.ts — 12개 테이블 + audit_logs append-only 트리거 SQL"
7. (backend, depends on 6) "lib/auth.ts — Auth.js Microsoft/Google SSO skeleton"
8. (backend) "lib/audit.ts — writeAudit 헬퍼"
9. (frontend 없음 — 최소 shell만 architect가 담당, 본격 UI는 Phase 2부터)
10. (compliance-qa, depends on 1-8) "qa_report.md — 구조 검증 + audit 트리거 SQL 실행 가능성 검증"

**팀 통신 규칙:**
- architect가 폴더 구조 확정 시 design-system, backend에 SendMessage
- design-system이 매핑표 완성 시 architect에 `app/globals.css` 최종본 전달
- backend가 schema 완성 시 compliance-qa에게 append-only 트리거 검증 요청

**Phase 종료:**
1. 모든 작업 completed 확인 (TaskGet)
2. 각 산출물 Read로 수집
3. compliance-qa의 qa_report.md 검토
4. Critical 이슈가 있으면 Phase 1 연장, 그렇지 않으면 TeamDelete
5. 사용자에게 Phase 1 요약 보고 + Phase 2 진행 여부 확인

### Phase 2: Chat Core

**목표:** Composer, useStreamingAnswer, Thinking, AnswerBlock (prose + citations + sources), DocViewer, minimal RAG pipeline (FDA corpus 1개만 연결).

**팀:** regula-chat-team = [frontend, rag-pipeline, backend, compliance-qa]

**주요 작업:**
1. (backend + rag-pipeline 공동) `app/api/ra/consult/route.ts` + `lib/ai/consult.ts` + SSE event type 공유 (`types/streaming.ts`)
2. (rag-pipeline) FDA retriever, prompt template, citation enforcement, confidence scoring
3. (frontend) Composer.tsx, Thinking.tsx, AnswerBlock.tsx, Citation.tsx, SourcesGrid.tsx, useStreamingAnswer.ts
4. (frontend) DocViewer.tsx — citation 클릭 시 딥링크
5. (compliance-qa) citation 경계면 교차 검증 (HTML data-source ↔ message_sources.cite_index), SSE event 순서 검증

**진입 조건:** `_workspace/phase-1/` 산출물 존재 + qa_report.md Critical 이슈 없음

### Phase 3: Structured Outputs

**목표:** Checklist, ComparisonTable, Timeline, RightContextPanel, SuggestedFollowups.

**팀:** regula-structured-team = [frontend, rag-pipeline, compliance-qa]

**주요 작업:**
1. (rag-pipeline) `lib/ai/structured-blocks.ts` — prose 완료 후 LLM에 follow-up prompt로 checklist/comparison/timeline JSON 생성
2. (rag-pipeline) SSE event 추가 발행 (`checklist`, `comparison`, `timeline`, `related`)
3. (frontend) `Checklist.tsx`, `ComparisonTable.tsx`, `Timeline.tsx`, `RightContextPanel.tsx`, `SuggestionPill.tsx`
4. (compliance-qa) 구조화 블록 스키마 검증, SSE 순서 (prose 완료 후에만 발행) 검증

### Phase 4: Breadth (8 views)

**목표:** History, Templates, Knowledge Base, Regulatory Updates, Dashboard, Projects, Sources, Settings + Project switching.

**팀:** regula-breadth-team = [frontend, backend, compliance-qa]

**주요 작업:**
1. (backend) `/api/ra/conversations`, `/api/ra/templates`, `/api/ra/sources`, `/api/ra/updates`, `/api/ra/dashboard`, `/api/ra/projects` 구현
2. (frontend) 6개 view 페이지 + 관련 컴포넌트 (`HistoryView`, `TemplatesView`, `DashboardView` 등)
3. (frontend) Zustand `currentProjectId` 연동, Right panel 프로젝트 표시
4. (frontend) History/Knowledge Base의 TanStack Virtual 적용
5. (compliance-qa) RLS 우회 가능성 검증, org/project scope 경계 테스트

### Phase 5: Enterprise Hardening

**목표:** Expert review flow 전체, audit_logs 완전성, RBAC, 다크 모드 최종, i18n (ko/en), 접근성 감사, Sentry/Langfuse.

**팀:** regula-enterprise-team = [backend, rag-pipeline, design-system, compliance-qa]

**주요 작업:**
1. (backend) `/api/ra/expert-review` 전체 흐름 + 전문가 큐 UI
2. (rag-pipeline + backend) expert-review 자동 게이팅 (regula-expert-review-gating 스킬)
3. (backend) RBAC 미들웨어, RLS 정책
4. (design-system + frontend) 다크 모드 폴리시 완료, locale 전환
5. (compliance-qa + design-system) WCAG 2.1 AA 감사, Axe-core 통과
6. (compliance-qa) Sentry + Langfuse wiring, audit 완전성 정적 분석

### Phase 6: Quality & Launch

**목표:** LLM eval harness (50+ RA 질문), Playwright E2E, 로드 테스트, 보안 리뷰, 문서.

**팀:** regula-quality-team = [compliance-qa (lead), architect, backend]

**주요 작업:**
1. (compliance-qa) promptfoo 기반 LLM eval 셋 구축, `tests/eval/` 디렉토리
2. (compliance-qa) Playwright E2E (login → consultation → citation → expert review → project switch)
3. (compliance-qa) Axe-core 0 violations 최종 확인
4. (compliance-qa + backend) 보안 감사 (OWASP Top 10, CSP, HSTS, rate limit 검증)
5. (architect) production deploy 준비 (Vercel config, env 정리, Sentry DSN, Langfuse 활성화)
6. (compliance-qa) 최종 통합 리포트 `_workspace/phase-6/launch_readiness.md`

## 데이터 흐름 (Phase 경계)

```
_workspace/phase-1/  ──Read──→  Phase 2 팀
  ├── architect_scaffold.md     │
  ├── design_system_map.md      │
  ├── backend_api_matrix.md     │
  └── qa_report.md              ↓

_workspace/phase-2/  ──Read──→  Phase 3 팀
  ├── frontend_components.md
  ├── rag_pipeline_design.md
  └── qa_report.md (phase-1 + phase-2 누적)

... (동일 패턴 Phase 6까지)
```

## 팀 통신 표준

- 팀 내 실시간 조율: SendMessage
- 작업 진행 상황: TaskUpdate
- 산출물 전달: 파일 기반 (`_workspace/phase-N/*.md` 또는 프로젝트 소스 파일)
- Critical 이슈: SendMessage + 리더(오케스트레이터) 즉시 보고

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| 팀원 1명 실패 (tools/API 문제) | 리더가 유휴 알림 수신 → SendMessage로 상태 확인 → 1회 재시작. 실패 시 서브 에이전트로 대체 호출 |
| handoff README 파싱 실패 | Phase 중단. 사용자에게 handoff 원본 확인 요청 |
| 의존성 설치 실패 (`pnpm install`) | architect가 버전 충돌 분석, 대안 제시 |
| regula-compliance-qa가 Critical 이슈 보고 | Phase 진행 보류, 해당 에이전트에 수정 지시, 재검증 후 진행 |
| Citation 강제 우회 감지 (rag-pipeline의 LLM 응답 검증 실패) | post-processing 강제, prompt 강화, regula-citation-contract 스킬 재검토 |
| audit_logs 누락 감지 | regula-compliance-qa가 해당 Route Handler 목록 제공 → backend가 즉시 수정 |
| Phase 간 산출물 shape 불일치 | regula-compliance-qa의 경계면 교차 검증으로 감지 → 해당 팀원 재호출 |
| 타임아웃 | 현재까지 수집된 부분 결과 보존, 미완료 작업 목록 `_workspace/phase-N/incomplete.md`에 기록 |

## 후속 작업 패턴

### 부분 재실행

"design-system 쪽 토큰 매핑 다시" 같은 요청:

1. Phase 0 컨텍스트 확인에서 `_workspace/phase-1/design_system_map.md` 존재 확인
2. 팀 생성 없이 **서브 에이전트 모드**로 regula-design-system만 호출:
   ```
   Agent(
     subagent_type: "general-purpose",
     model: "opus",
     prompt: ".Codex/agents/regula/regula-design-system.md 역할. _workspace/phase-1/design_system_map.md를 읽고 사용자 피드백({피드백 내용})을 반영하여 해당 섹션만 수정하라."
   )
   ```
3. 수정 후 regula-compliance-qa 서브로 재검증

### 특정 Phase만 재실행

"Phase 3 처음부터 다시":

1. `_workspace/phase-3/`를 `_workspace/phase-3-{YYYYMMDD-HHMMSS}/`로 이동
2. Phase 3 팀 재구성 및 정상 Phase 3 워크플로우 실행
3. 이전 버전은 보존 (사후 비교용)

### 이전 결과 기반 개선

"Phase 2 결과 좀 더 개선해줘":

1. `_workspace/phase-2/qa_report.md`를 읽어 Medium/Low 이슈 리스트 추출
2. 이슈별 담당 에이전트를 서브로 호출하여 개선 지시
3. regula-compliance-qa가 재검증하여 qa_report.md에 "improved" 마킹

## 테스트 시나리오

### 정상 흐름 (초기 실행, 전체 Roadmap)
1. 사용자: "Regula 프로젝트 시작하자"
2. Phase 0: `_workspace/` 없음 → 초기 실행 모드
3. Phase 1: regula-foundation-team 구성 → 스캐폴딩 완료 → qa_report.md pass
4. 사용자 Phase 2 진행 확인 → Phase 2: regula-chat-team 구성 → Chat core 완료
5. ... Phase 6까지 반복
6. 최종: `_workspace/phase-6/launch_readiness.md` + 프로덕션 준비 완료 프로젝트

### 에러 흐름 (Critical 이슈 발생)
1. Phase 2 실행 중 regula-compliance-qa가 "SSE event 순서 위반, prose_delta가 sources 이후에 도착" Critical 보고
2. 리더가 Phase 진행 중단, rag-pipeline에 SendMessage로 지시
3. rag-pipeline이 `lib/ai/streaming.ts` 수정 (Phase C 블록은 prose 완료 후에만 yield)
4. compliance-qa 재검증 → pass
5. Phase 2 정상 종료

### 부분 재실행 흐름
1. 사용자: "Phase 1의 audit_logs 트리거 SQL을 postgres 16에 맞게 수정해줘"
2. Phase 0: `_workspace/phase-1/` 존재 + 부분 수정 요청 감지
3. 서브 에이전트로 regula-backend 1명만 호출
4. `migrations/000X_audit_append_only.sql` 수정
5. 서브 에이전트로 regula-compliance-qa 재검증
6. `_workspace/phase-1/qa_report.md` 갱신 (이슈 resolved 마킹)
