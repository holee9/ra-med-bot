---
id: SPEC-REGULA-RELEASE-HARDENING-001
title: "Regula Release Hardening — Dashboard·Knowledge·Console·TODO·E2E·Workflow Beta"
status: draft
phase: "release-hardening"
priority: High
version: 0.2.0
created: 2026-05-04
updated: 2026-05-05
author: manager-spec
issue_number: 33
depends_on:
  - SPEC-REGULA-RELEASE-GATE-001
closes_issues:
  - "#27"
  - "#29"
related_specs:
  - SPEC-REGULA-RELEASE-001
  - SPEC-REGULA-LAUNCH-001
  - SPEC-REGULA-WORKFLOWS-001
  - SPEC-REGULA-ENTERPRISE-001
  - SPEC-REGULA-CHAT-001
  - SPEC-REGULA-QUALITY-001
related_issues:
  - "#27"
  - "#29"
  - "#33"
labels:
  - release
  - hardening
  - high-priority
revision_history:
  - version: 0.2.0
    date: 2026-05-05
    author: manager-spec (plan-auditor remediation)
    notes: "Plan-auditor 보강 — REQ-HARDEN-015 EARS 라벨 (Optional)→(Ubiquitous) 수정 및 문법 오류 수정. REQ-HARDEN-020 ownership을 QUALITY-001로 명시 위임 (hybrid-router.ts 수정 책임 이관). closes_issues 명시 (#27, #29). frontmatter 표준화. traceability-matrix.md 신규 작성. _shared/qa-gate-roadmap.md 참조 도입."
  - version: 0.1.0
    date: 2026-05-04
    author: manager-spec
    notes: |
      Initial draft. P1 hardening for first release. 6 issue groups covering
      Dashboard Stats stub (H-1), Knowledge Base hardcoded data (H-2),
      console.* in production paths (H-3 / Issue #29), TODO and placeholder
      cleanup (H-4 / Issue #27), citation-click E2E skip removal (H-5),
      Workflow Beta disclosure (H-6). Total 28 EARS requirements across
      Group A through Group F. Depends on RELEASE-GATE-001 P0 completion.
---

# SPEC-REGULA-RELEASE-HARDENING-001 — Regula Release Hardening (P1)

## 1. 목적 (Purpose)

Regula 1차 릴리즈의 **사용자 경험 및 품질 직결 이슈**를 정리하는 P1 하드닝 SPEC이다. RELEASE-GATE-001 (P0, 릴리즈 차단성 결함) 완료 이후 진행하며, 다음 6개 결함을 코드 레벨에서 해소한다.

| ID | 결함 | 영향 | 출처 |
|---|---|---|---|
| H-1 | Dashboard Stats stub (`stats: {}` 반환) | `/dashboard` 빈 카드 노출 | 직접 검증 (`app/api/ra/dashboard/route.ts:8`) |
| H-2 | Knowledge Base hardcoded sourceGroups | `/knowledge` DB 미연동 | 직접 검증 (`app/(app)/knowledge/page.tsx:1`) |
| H-3 | `console.log/warn/error` 직접 호출 (production paths) | PII 유출 위험, 구조화 로그 부재 | Issue #29, 15개 파일 27건 검증 |
| H-4 | TODO/placeholder/Mock 잔존 | 미완 기능 production 배포 위험 | Issue #27, 9개 파일 검증 |
| H-5 | citation-click E2E `test.skip` (인증 세션 미설정) | 핵심 기능 회귀 테스트 부재 | LAUNCH-001 잔여, `tests/e2e/citation-click.spec.ts:14` |
| H-6 | Workflow executor 전체 mock 구현 | 사용자가 실제 LLM 결과로 오인 위험 | WORKFLOWS-001 잔여, `lib/workflows/submission-drafter/executor.ts:26` |

본 SPEC은 신규 비즈니스 기능을 추가하지 않는다. **기존 구현물의 품질·정직성·테스트 가능성을 1차 릴리즈 수준으로 끌어올리는 것**이 유일한 목표이다.

---

## 2. 범위 (Scope)

### In Scope

- Dashboard `/api/ra/dashboard` 실제 DB 쿼리 구현 (4개 메트릭)
- Knowledge `/knowledge` 페이지를 sources 테이블 기반 동적 렌더링으로 전환
- `app/`, `lib/`, `workers/` 경로의 `console.*` 호출 제거 및 구조화 로거(Langfuse + Sentry) 전환
- production 경로의 TODO/FIXME/placeholder 주석 정리: 구현 또는 deferred SPEC 발행
- 외부 API placeholder (eu-ectd, fda-estar) feature flag 게이팅
- citation-click E2E `test.skip` 해제 및 인증 세션 fixture 구성
- 3개 워크플로우 (submission-drafter, audit-response, indication-impact) UI에 Beta 배지 추가
- Mock 응답에 `_mock: true` 플래그 부착, audit_logs에 mock-data 태깅

### Out of Scope (1차 릴리즈 후 별도 SPEC)

- 워크플로우 executor의 실제 LLM 구현 (1차 릴리즈에서는 Beta 명시로 사용자 기대 정렬)
- 외부 API (EU eCTD mTLS, FDA eSTAR) 실제 통합
- Vectorize runtime hybrid router 정식 구현 (현재는 `lib/ai/hybrid-router.ts` TODO)
- Knowledge Base 계층 트리/검색/필터 UI 고도화
- Dashboard 실시간 업데이트 (websocket / SSE)
- 신규 워크플로우 추가
- Pen-test 실행 (계획 문서만 LAUNCH-001에서 작성됨)

---

## 3. EARS 요구사항

### Group A — Dashboard Stats (실 데이터 연동)

#### REQ-HARDEN-001 (Event-driven)
**WHEN** the user requests `GET /api/ra/dashboard`, **THE** system **SHALL** return a JSON object of shape `{ orgId: string, stats: { totalConversations: number, expertReviews: number, pendingReviews: number, totalProjects: number } }`.

#### REQ-HARDEN-002 (Ubiquitous)
The system **SHALL** compute `stats.totalConversations` as the count of `conversations` rows scoped to the requester's `organizationId`.

#### REQ-HARDEN-003 (Ubiquitous)
The system **SHALL** compute `stats.expertReviews` as the total count of `expert_reviews` rows scoped to the requester's `organizationId`, and `stats.pendingReviews` as the count where `status = 'pending'`.

#### REQ-HARDEN-004 (Ubiquitous)
The system **SHALL** compute `stats.totalProjects` as the count of `projects` rows scoped to the requester's `organizationId`.

#### REQ-HARDEN-005 (State-driven)
**WHILE** the organization has zero rows in any source table, the system **SHALL** return `0` for the corresponding metric (never `null`, never `undefined`, never an empty object).

---

### Group B — Knowledge Base Dynamic Sources

#### REQ-HARDEN-006 (Event-driven)
**WHEN** the user requests `GET /api/ra/sources`, **THE** system **SHALL** return a JSON array of source objects of shape `{ id, orgLabel, title, year, type, url }` scoped to the requester's `organizationId`.

#### REQ-HARDEN-007 (Ubiquitous)
The system **SHALL** group sources by their `orgLabel` (or a derived category field) on the `/knowledge` page and render the groupings dynamically from the API response.

#### REQ-HARDEN-008 (Unwanted)
The `/knowledge` page **SHALL NOT** contain hardcoded source group definitions in the component file.

#### REQ-HARDEN-009 (State-driven)
**WHILE** the organization has zero indexed sources, the `/knowledge` page **SHALL** display an empty state with the localized message "사용 가능한 지식 소스가 없습니다" instead of rendering hardcoded fallback groups.

#### REQ-HARDEN-010 (Event-driven)
**WHEN** the API request to `GET /api/ra/sources` fails (HTTP 5xx or network error), the page **SHALL** render a non-blocking error notice and **SHALL NOT** silently render placeholder data.

---

### Group C — Console Log Policy (PII Safety)

#### REQ-HARDEN-011 (Unwanted)
The system **SHALL NOT** invoke `console.log`, `console.warn`, `console.error`, or `console.debug` from any file under `app/`, `lib/`, or `workers/` except where explicitly annotated with a `// @MX:NOTE: console-allowed` line and a SPEC reference.

#### REQ-HARDEN-012 (Ubiquitous)
The system **SHALL** route all production logging through the structured logger interface (Sentry for errors, Langfuse for AI traces, structured stdout JSON for general events).

#### REQ-HARDEN-013 (Unwanted) — PII Critical
The logger **SHALL NOT** emit raw user query text, raw assistant answer text, raw uploaded document content, or any field flagged as PII in `lib/ingest/pii/*` to any sink (stdout, Sentry, Langfuse, Slack, email).

#### REQ-HARDEN-014 (Where)
**WHERE** an error context requires content for debugging, the logger **SHALL** emit a content hash, length, and locale only — never the content itself.

#### REQ-HARDEN-015 (Ubiquitous)
Audit log writes via `writeAudit()` **shall** retain their existing shape; this SPEC does not modify the audit pipeline.

#### REQ-HARDEN-016 (Where)
**WHERE** a file is a CLI script (`scripts/`), a one-off migration runner, or a test helper (`tests/`, `*.spec.ts`, `*.test.ts`), `console.*` usage is permitted and excluded from this rule.

---

### Group D — TODO and Placeholder Cleanup

#### REQ-HARDEN-017 (Unwanted)
A `git grep -rnE "TODO|FIXME|placeholder|mock implementation" --include="*.ts" app/ lib/ workers/` **SHALL** return zero hits, **OR** every remaining hit **SHALL** carry a `// @MX:TODO` annotation with a `@MX:SPEC` sub-line referencing a deferred SPEC ID.

#### REQ-HARDEN-018 (Event-driven)
**WHEN** an external integration is not yet implemented (e.g., `lib/external/eu-ectd.ts`, `lib/external/fda-estar.ts`), the implementation **SHALL** be gated by a feature flag check, and the flag **SHALL** default to `disabled` in the production environment.

#### REQ-HARDEN-019 (Unwanted)
**IF** a feature-flag-disabled external integration is invoked at runtime, **THEN** the system **SHALL** throw a typed error `FeatureNotAvailableError` and **SHALL NOT** return mock data implicitly.

#### REQ-HARDEN-020 (Ubiquitous)
The `lib/ai/hybrid-router.ts` Vectorize runtime path **shall** be owned by SPEC-REGULA-QUALITY-001 (REQ-QUAL-011~014); HARDENING-001 does not modify this file. This requirement exists to make the cross-SPEC ownership explicit and to prevent duplicate work between HARDENING-001 and QUALITY-001.

#### REQ-HARDEN-021 (Ubiquitous)
The `tests/e2e/fixtures/msw-sse.ts` MSW handler TODO **SHALL** be either implemented or removed; if removed, the affected E2E tests **SHALL** be either rewritten without MSW or explicitly marked deferred via `test.fixme` with a tracking issue link.

---

### Group E — Citation Click E2E Coverage

#### REQ-HARDEN-022 (Unwanted)
The file `tests/e2e/citation-click.spec.ts` **SHALL NOT** contain any `test.skip(true, ...)` calls; only conditional skips bound to environment availability (`PLAYWRIGHT_BASE_URL`, `CI`) are permitted.

#### REQ-HARDEN-023 (Ubiquitous)
The system **SHALL** provide a Playwright auth fixture (e.g., `tests/e2e/fixtures/auth.ts`) that produces a persisted authenticated session (storage state), and the citation-click suite **SHALL** consume this fixture.

#### REQ-HARDEN-024 (Event-driven)
**WHEN** the CI pipeline executes the `e2e` job, the citation-click suite **SHALL** execute and pass on Chromium and Firefox; Webkit may be marked as `expect-failure` only with an explicit tracking SPEC reference.

---

### Group F — Workflow Beta Disclosure

#### REQ-HARDEN-025 (Ubiquitous)
The `/workflows` listing page **SHALL** render a "Beta" badge component on every workflow card (currently 3: submission-drafter, audit-response, indication-impact).

#### REQ-HARDEN-026 (Event-driven)
**WHEN** the user lands on a workflow execution page, the system **SHALL** display a non-dismissable disclosure banner with the localized text equivalent of "이 기능은 베타입니다. 출력 결과는 mock 데이터이며, 실제 규제 의사결정에 사용하지 마십시오."

#### REQ-HARDEN-027 (Ubiquitous)
Every API response from a mock-implementation step (i.e., `lib/workflows/*/executor.ts` returning hardcoded values) **SHALL** include a top-level `_mock: true` flag in its JSON output.

#### REQ-HARDEN-028 (Event-driven)
**WHEN** a workflow run completes with at least one step using mock data, the corresponding `audit_logs` entry **SHALL** record `metadata.mock_data: true` and `metadata.workflow_run_id`.

---

## 4. Acceptance Criteria

상세 Given-When-Then 시나리오는 `acceptance.md` 참고. 핵심 게이트:

- `GET /api/ra/dashboard` 응답이 `stats: { totalConversations: number, expertReviews: number, pendingReviews: number, totalProjects: number }` 형식을 만족 (모두 number, null/undefined/{ } 금지)
- `GET /api/ra/sources` 가 동적 결과 반환, `/knowledge` 페이지 hardcoded sourceGroups 제거 확인
- `git grep -rnE "console\.(log|warn|error|debug)" app/ lib/ workers/ --include="*.ts"` 결과가 0건 또는 모두 `@MX:NOTE: console-allowed` 주석 동반
- `git grep -rnE "TODO|FIXME|placeholder" app/ lib/ workers/ --include="*.ts"` 결과가 0건 또는 모두 `@MX:TODO` + `@MX:SPEC` 동반
- `tests/e2e/citation-click.spec.ts` 의 `test.skip(true, ...)` 제거 확인, CI에서 chromium·firefox 통과
- `/workflows`, `/workflows/*` 페이지에 Beta 배지 + 디스클로저 배너 노출 (Playwright 시각 확인)
- 워크플로우 실행 결과 JSON에 `_mock: true` 포함, `audit_logs.metadata.mock_data` 필드 기록 확인

---

## 5. Exclusions (What NOT to Build)

본 SPEC이 **명시적으로 다루지 않는** 항목:

1. **워크플로우 실제 LLM 구현** — 3개 워크플로우 모두 mock 유지. Beta 배지로 사용자 기대 정렬만 수행. 실제 LLM 통합은 1차 릴리즈 후 별도 SPEC (`SPEC-REGULA-WORKFLOWS-LLM-002`)으로 분리.
2. **EU eCTD / FDA eSTAR 실제 통합** — feature flag로 격리만 수행. mTLS 구현은 별도 SPEC (`SPEC-REGULA-EXTERNAL-001`).
3. **Vectorize runtime 정식 구현** — TODO 정리 및 deferred SPEC 발행만 수행. 실제 구현은 별도 SPEC.
4. **Dashboard 실시간 업데이트** — 페이지 새로고침 기반 단순 갱신만 구현. WebSocket/SSE는 out of scope.
5. **Knowledge Base 검색·필터·계층 트리 UI** — 동적 렌더링 전환만 수행. 사용자 인터랙션 고도화는 out of scope.
6. **Logger 라이브러리 신규 도입** — 이미 의존성에 존재하는 Langfuse / Sentry / 구조화 stdout 사용. pino, winston 등 신규 라이브러리 추가 금지.
7. **Audit log 스키마 변경** — `metadata.mock_data` 필드 추가만 허용. `audit_logs` 테이블 컬럼 추가/제거는 금지 (마이그레이션 회피).
8. **신규 비즈니스 기능, 새로운 API endpoint** — 본 SPEC은 기존 구현물의 품질 향상만 다룬다.

---

## 6. Dependencies and Sequencing

- **Hard dependency**: SPEC-REGULA-RELEASE-GATE-001 완료 (P0 릴리즈 차단성 결함 해소). RELEASE-GATE-001 미완 시 본 SPEC RUN 진입 금지.
- **Soft dependency**: SPEC-REGULA-RELEASE-001 (1차 릴리즈 범위 lock)에서 #27, #29 가 in-scope으로 명시됨.
- **No conflict**: SPEC-REGULA-LAUNCH-001 (Phase 6 quality gates)와 동일 영역(E2E, security)을 다루지만 LAUNCH-001은 인프라·테스트 harness 구축, 본 SPEC은 잔여 결함 해소로 역할이 분리됨.

---

## 7. Risk Notes

- **PII 유출 리스크 (Group C)**: 의료기기 규제 RAG 시스템 특성상 사용자 query 자체가 PHI/PII에 해당할 수 있음. 로거 전환 시 sample input으로 회귀 검증 필요.
- **테스트 인증 세션 위험 (Group E)**: storage state fixture 작성 시 실제 운영 계정의 세션이 CI에 누출되지 않도록 dedicated test account + env-scoped credential 사용.
- **Mock disclosure UX 트레이드오프 (Group F)**: Beta 배지가 너무 약하면 사용자 오인 위험, 너무 강하면 신뢰도 저하. RELEASE-001 §1차 릴리즈 범위와 정렬된 톤으로 작성 필요.

---

REQ coverage 요약:
- Group A (Dashboard): 5 REQ
- Group B (Knowledge): 5 REQ
- Group C (Console): 6 REQ
- Group D (TODO): 5 REQ
- Group E (E2E): 3 REQ
- Group F (Workflow Beta): 4 REQ

**Total: 28 EARS requirements**

---

## 8. References

### 8.1 GitHub Artifacts

- Issue #27: production 경로 TODO/placeholder 정리 (closed by 본 SPEC Group D)
- Issue #29: runtime console 로그 정책 및 관측성 정리 (closed by 본 SPEC Group C)
- Issue #33: SPEC tracking issue

### 8.2 관련 SPEC

- SPEC-REGULA-RELEASE-001 (umbrella)
- SPEC-REGULA-RELEASE-GATE-001 (depends_on)
- SPEC-REGULA-QUALITY-001 (downstream — REQ-HARDEN-020에 의해 hybrid-router.ts ownership 위임)
- SPEC-REGULA-LAUNCH-001
- SPEC-REGULA-WORKFLOWS-001
- SPEC-REGULA-ENTERPRISE-001
- SPEC-REGULA-CHAT-001

### 8.3 코드 진입점

- `app/api/ra/dashboard/route.ts` (Group A)
- `app/(app)/knowledge/page.tsx` (Group B)
- `lib/ai/consult.ts`, `lib/ai/structured-blocks.ts`, `app/api/ra/consult/route.ts` (Group C, PII Critical)
- `lib/external/eu-ectd.ts`, `lib/external/fda-estar.ts` (Group D, feature flag)
- `tests/e2e/citation-click.spec.ts` (Group E)
- `lib/workflows/{submission-drafter,audit-response,indication-impact}/executor.ts` (Group F)

### 8.4 연구 / 추적 문서

- `research.md` (본 디렉토리)
- `traceability-matrix.md` (본 디렉토리)
- `plan.md`, `acceptance.md`

### 8.5 QA 단계 게이트 정의

QA 단계 게이트(0~5) 정의는 `.moai/specs/_shared/qa-gate-roadmap.md`를 참조하라.
