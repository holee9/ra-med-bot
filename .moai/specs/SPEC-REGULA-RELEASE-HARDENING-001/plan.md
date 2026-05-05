---
spec_id: SPEC-REGULA-RELEASE-HARDENING-001
title: Plan — Regula Release Hardening
version: 0.1.0
status: draft
created: 2026-05-04
---

# Plan — SPEC-REGULA-RELEASE-HARDENING-001

## 1. 구현 전략 개요

본 SPEC은 6개 독립 그룹의 결함 해소이므로 **그룹별 병렬 진행이 가능**하다. 단, 다음 순서 제약이 있다.

- Group C (console 정리)와 Group D (TODO 정리)는 **광범위한 파일 수정**을 동반하므로 다른 그룹과 동시 수정 시 머지 충돌 가능. 별도 PR 분리 권장.
- Group A, B는 동일 도메인(API + page)에 속하므로 묶어서 진행 가능.
- Group E (E2E)는 Group A/B 완료 후 진행 권장 (페이지가 stub일 때 E2E 작성 무의미).
- Group F (Beta disclosure)는 다른 그룹과 독립.

## 2. 마일스톤 (우선순위 기반, 시간 추정 없음)

### Milestone M1 — Priority High (사용자 직접 노출 결함)

- M1-A: Dashboard Stats 실 데이터 연동 (Group A, REQ-HARDEN-001~005)
- M1-B: Knowledge Base 동적 렌더링 (Group B, REQ-HARDEN-006~010)
- M1-F: Workflow Beta 배지 및 디스클로저 (Group F, REQ-HARDEN-025~028)

**완료 기준**: 사용자가 첫 화면(`/dashboard`)과 핵심 화면(`/knowledge`, `/workflows`)에서 더미 데이터·오해 소지를 보지 않는다.

### Milestone M2 — Priority High (보안·정직성)

- M2-C: Console 로그 정리 및 구조화 로거 전환 (Group C, REQ-HARDEN-011~016)
  - **PII critical**: `app/api/ra/consult/route.ts`, `lib/ai/consult.ts`, `lib/ai/structured-blocks.ts` 우선
  - 그 후 `lib/ingest/pii/*`, `lib/radar/*`, `workers/*` 진행
- M2-D: TODO/placeholder 정리 (Group D, REQ-HARDEN-017~021)
  - `lib/external/eu-ectd.ts`, `lib/external/fda-estar.ts` feature flag 게이팅
  - `lib/ai/hybrid-router.ts` Vectorize TODO → SPEC-REGULA-VECTORIZE-001 발행
  - `tests/e2e/fixtures/msw-sse.ts` MSW handler TODO 처리

**완료 기준**: PII 유출 경로 차단, production code 내 미완 표식 0건 (또는 모두 SPEC 참조 동반).

### Milestone M3 — Priority Medium (회귀 방지)

- M3-E: citation-click E2E 인증 fixture 구성 및 skip 해제 (Group E, REQ-HARDEN-022~024)

**완료 기준**: CI에서 chromium·firefox 환경에서 citation-click 시나리오 통과.

## 3. 기술 접근

### Group A: Dashboard Stats

- `app/api/ra/dashboard/route.ts` 의 stub을 Drizzle 쿼리로 교체
- `db.select({ count: count() }).from(...)` 패턴 사용 (Drizzle 0.x `count` import)
- 4개 카운트 쿼리를 `Promise.all`로 병렬 실행
- `withPermission('dashboard.view')` 래핑 유지 (인증·인가 변경 없음)
- 응답 shape은 React Query hook `useDashboardStats`의 기대값에 맞춤 (`valueFromStats(stats, key)` 호출 호환)

### Group B: Knowledge Base

- 옵션 1 (권장): 신규 `app/api/ra/sources/route.ts` (list endpoint) 추가 — `[id]` 외에 list가 없음
- 옵션 2: 기존 `app/api/ra/sources/[id]/route.ts` 외에 list 엔드포인트 부재 → 신규 라우트 작성 필수
- `app/(app)/knowledge/page.tsx` 를 client component(`'use client'`)로 전환 후 React Query 훅(`useKnowledgeSources`) 사용 또는 server component에서 직접 `db` 호출
- `orgLabel` 또는 `type` 필드로 그룹화 로직 작성

### Group C: Console Logger 전환

- 구조화 로거 wrapper 신설: `lib/observability/logger.ts` (없는 경우)
  - 메서드: `logger.info(event, fields)`, `logger.warn(event, fields)`, `logger.error(event, fields, err?)`
  - PII 마스킹 헬퍼: `redact(value)` — 길이/해시/locale만 반환
  - Sentry: error 레벨에서 `Sentry.captureException`
  - Langfuse: AI trace 컨텍스트는 기존 trace API 사용
- 기존 `console.*` 호출을 일괄 치환 (수동 검토 필수, PII 포함 여부 확인)
- `eslint-plugin-no-console` 규칙 강화 (`no-console: ["error", { allow: [] }]` for `app/`, `lib/`, `workers/`)

### Group D: TODO 정리

- `lib/external/eu-ectd.ts`, `lib/external/fda-estar.ts`:
  - 진입 함수 최상단에 `if (!isFeatureEnabled('external.eu-ectd')) throw new FeatureNotAvailableError(...)` 패턴
  - feature flag는 환경변수 기반 (`FEATURE_EU_ECTD=disabled` 디폴트)
- `lib/ai/hybrid-router.ts`:
  - 새 SPEC 발행: `SPEC-REGULA-VECTORIZE-001` (별도 작업)
  - 본 파일의 TODO 주석을 `// @MX:TODO: Vectorize runtime — see SPEC-REGULA-VECTORIZE-001` 로 정리
- `tests/e2e/fixtures/msw-sse.ts`:
  - MSW handler 구현 또는 fixture 제거 후 영향 받는 spec 조정

### Group E: Citation E2E

- `tests/e2e/fixtures/auth.ts` 작성:
  - Playwright `globalSetup`에서 dedicated test 계정으로 로그인 → `storageState` JSON 저장
  - CI env: `PLAYWRIGHT_AUTH_USER`, `PLAYWRIGHT_AUTH_PASSWORD` 시크릿 등록
- `playwright.config.ts` 의 citation 프로젝트에 `use: { storageState: '.auth/user.json' }` 추가
- `tests/e2e/citation-click.spec.ts` 의 `test.skip(true, '...')` 라인 제거
- 4개 테스트 모두 chromium·firefox에서 동작 검증

### Group F: Workflow Beta

- 신규 컴포넌트 `components/workflows/BetaBadge.tsx` (단순 라벨)
- `components/workflows/WorkflowCard.tsx` 에 `<BetaBadge />` 추가
- 신규 컴포넌트 `components/workflows/MockDataDisclosure.tsx` (배너)
- 워크플로우 실행 page (예: `app/(app)/workflows/[id]/page.tsx`) 상단에 `<MockDataDisclosure />` 렌더
- `lib/workflows/*/executor.ts` 의 모든 mock 응답에 `_mock: true` 추가
- audit log writer 호출 시 `metadata: { mock_data: true, workflow_run_id }` 전달

## 4. 영향 받는 파일 (예상)

### Group A
- `app/api/ra/dashboard/route.ts` (수정)
- `lib/queries/useDashboardStats.ts` (필요 시 type 갱신)

### Group B
- `app/api/ra/sources/route.ts` (신규)
- `app/(app)/knowledge/page.tsx` (수정)
- `lib/queries/useKnowledgeSources.ts` (신규, 옵션 1 채택 시)

### Group C
- `lib/observability/logger.ts` (신규 또는 수정)
- 27건의 console 호출이 있는 15개 파일 수정
- `eslint.config.*` rule 강화

### Group D
- `lib/external/eu-ectd.ts`, `lib/external/fda-estar.ts` (수정)
- `lib/ai/hybrid-router.ts` (수정)
- `tests/e2e/fixtures/msw-sse.ts` (수정 또는 삭제)
- `lib/feature-flags.ts` (신규 또는 수정)
- 기타 9개 파일의 TODO 주석 정리

### Group E
- `tests/e2e/fixtures/auth.ts` (신규)
- `tests/e2e/citation-click.spec.ts` (수정)
- `playwright.config.ts` (수정)
- `.github/workflows/ci.yml` (시크릿 추가)

### Group F
- `components/workflows/BetaBadge.tsx` (신규)
- `components/workflows/MockDataDisclosure.tsx` (신규)
- `components/workflows/WorkflowCard.tsx` (수정)
- 워크플로우 실행 page (수정)
- `lib/workflows/submission-drafter/executor.ts` (수정)
- `lib/workflows/audit-response/executor.ts` (수정)
- `lib/workflows/indication-impact/executor.ts` (수정)
- audit logger 호출 지점 (수정)

## 5. 위험 요소 및 완화

| 위험 | 완화 방안 |
|---|---|
| Console 정리 중 의도치 않은 디버그 출력 제거로 운영 가시성 저하 | M2 진행 전 Sentry/Langfuse 연결 확인. error 레벨은 반드시 Sentry로 보냄 |
| Citation E2E auth fixture에 운영 계정 누출 | dedicated test 계정 별도 발급, GitHub Secrets로만 주입 |
| Beta 배지 디자인 중 디자인 시스템 토큰 위반 | 기존 `tokens.json` palette/typography 사용, 신규 토큰 추가 금지 |
| Dashboard 쿼리 N+1 또는 풀스캔 성능 이슈 | `count(*)` 단순 쿼리 4건만 수행, organizationId 인덱스 활용 |
| 외부 API feature flag 런타임 검증 누락 | 진입점 단위 테스트 추가 (`FeatureNotAvailableError` throw 검증) |
| MSW handler 제거 시 영향 범위 불명 | 영향 받는 spec을 grep으로 사전 매핑 후 처리 |

## 6. 진행 순서

1. **Wave 1 (병렬)**: M1-A, M1-B, M1-F → 사용자 가시성 우선 해소
2. **Wave 2 (순차)**: M2-C → M2-D → 코드베이스 광범위 정리, 머지 충돌 회피
3. **Wave 3**: M3-E → Wave 1 결과물 회귀 방지 위한 E2E 보강

## 7. RUN Phase 권장 에이전트

- Group A, B: expert-backend (API), expert-frontend (page) 직렬
- Group C: expert-refactoring + expert-security 병행 (PII 검토)
- Group D: expert-backend
- Group E: expert-testing
- Group F: expert-frontend

각 Group은 별도 commit + 별도 PR로 분리하여 리뷰 부담을 낮춘다.
