---
spec_id: SPEC-REGULA-RELEASE-HARDENING-001
title: Acceptance Criteria — Regula Release Hardening
version: 0.1.0
status: draft
created: 2026-05-04
---

# Acceptance Criteria — SPEC-REGULA-RELEASE-HARDENING-001

## Group A — Dashboard Stats

### Scenario A-1: 인증 사용자가 통계 조회 시 4개 메트릭 number 반환
**Given** organizationId가 `org-test-001`인 사용자가 인증된 세션을 보유하고
**And** 해당 조직에 conversations 5개, expert_reviews 3개 (그 중 status=pending 1개), projects 2개가 존재하며
**When** 사용자가 `GET /api/ra/dashboard` 를 호출하면
**Then** 응답 body는 `{ orgId: "org-test-001", stats: { totalConversations: 5, expertReviews: 3, pendingReviews: 1, totalProjects: 2 } }` 구조를 만족한다
**And** stats 내부의 모든 필드는 typeof === "number" 이다
**And** 어떤 필드도 null/undefined 가 아니다

### Scenario A-2: 빈 조직의 경우 0 반환 (empty object 금지)
**Given** organizationId가 `org-empty-001`인 사용자가 인증된 세션을 보유하고
**And** 해당 조직에 conversations/expert_reviews/projects 모두 0건이며
**When** 사용자가 `GET /api/ra/dashboard` 를 호출하면
**Then** 응답 body의 `stats` 는 `{}` 가 아니라 `{ totalConversations: 0, expertReviews: 0, pendingReviews: 0, totalProjects: 0 }` 이다

### Scenario A-3: Dashboard 페이지가 0이 아닌 실 값 표시
**Given** Scenario A-1과 동일한 데이터 상태에서
**When** 사용자가 `/dashboard` 페이지를 로드하면
**Then** "상담" 카드에 "5", "전문가 검토" 카드에 "1" (pendingReviews), "프로젝트" 카드에 "2" 가 표시된다

### Edge case A-E1: 인증 실패
**Given** 인증되지 않은 요청이고
**When** `GET /api/ra/dashboard` 호출 시
**Then** `withPermission` 미들웨어가 401/403 을 반환한다 (기존 동작 유지)

---

## Group B — Knowledge Base Dynamic Sources

### Scenario B-1: 등록된 sources를 그룹화하여 표시
**Given** organizationId가 `org-test-001`이고
**And** sources 테이블에 `{ orgLabel: 'FDA', title: '21 CFR 820', ... }`, `{ orgLabel: 'ISO', title: 'ISO 13485', ... }` 등 6건이 존재하며
**When** 사용자가 `/knowledge` 페이지를 로드하면
**Then** 페이지는 `GET /api/ra/sources` 를 호출하고
**And** orgLabel 별 그룹이 동적으로 렌더링되며
**And** 각 source의 title이 화면에 표시된다

### Scenario B-2: 빈 corpus 상태
**Given** organizationId의 sources 테이블이 빈 상태이고
**When** `/knowledge` 페이지를 로드하면
**Then** 화면에 "사용 가능한 지식 소스가 없습니다" (또는 동등 i18n key) 메시지가 표시된다
**And** hardcoded 그룹 (`공식 규제 기관`, `국제 표준`, `사내 지식`)은 화면에 나타나지 않는다

### Scenario B-3: API 오류 graceful degradation
**Given** `/api/ra/sources` 엔드포인트가 500 응답을 반환하도록 mock된 상태에서
**When** 사용자가 `/knowledge` 페이지를 로드하면
**Then** 화면에 "지식 베이스를 불러올 수 없습니다" 형식의 오류 안내가 표시되고
**And** hardcoded fallback 그룹은 표시되지 않는다

### Static check B-S1: hardcoded 정의 부재
**Given** 본 SPEC RUN 완료 시점에서
**When** `app/(app)/knowledge/page.tsx` 파일을 정적 분석하면
**Then** 파일 내에 `const sourceGroups = [...]` 형태의 하드코딩 리터럴이 존재하지 않는다

---

## Group C — Console Log Policy

### Static check C-S1: console.* zero hits
**Given** 본 SPEC RUN 완료 시점에서
**When** `git grep -rnE "console\.(log|warn|error|debug)" app/ lib/ workers/ --include="*.ts"` 를 실행하면
**Then** 결과는 0건이거나, 모든 hit는 동일 라인 또는 직전 라인에 `// @MX:NOTE: console-allowed` 주석을 포함한다

### Static check C-S2: PII 직접 로깅 부재
**Given** 본 SPEC RUN 완료 시점에서
**When** `consult` 라우트, `lib/ai/consult.ts`, `lib/ai/structured-blocks.ts` 의 모든 logger 호출 site를 검토하면
**Then** 어떤 호출도 `query`, `answer`, `userMessage`, `content`, `text` 변수를 직접 인자로 전달하지 않는다
**And** 길이/해시/locale 만 전달한다

### Scenario C-1: Sentry로 error 레벨 라우팅
**Given** logger.error 호출이 발생하면
**When** Sentry SDK가 활성화된 환경에서
**Then** Sentry에 해당 이벤트가 기록되고
**And** 이벤트의 `extra` 필드에 PII가 포함되지 않는다

### Static check C-S3: ESLint 규칙 강화
**Given** 본 SPEC RUN 완료 시점에서
**When** `pnpm lint` 를 실행하면
**Then** `app/`, `lib/`, `workers/` 경로에서 `no-console` 위반 0건

### Edge case C-E1: 허용된 예외 (CLI 스크립트)
**Given** `scripts/preflight.sh` 또는 `scripts/run-eval.sh` 등 CLI 진입점에서
**When** console 호출이 존재하면
**Then** 이는 본 SPEC의 규제 대상이 아니다 (REQ-HARDEN-016 적용)

---

## Group D — TODO/Placeholder Cleanup

### Static check D-S1: TODO/FIXME zero hits in production paths
**Given** 본 SPEC RUN 완료 시점에서
**When** `git grep -rnE "TODO|FIXME|placeholder|mock implementation" --include="*.ts" app/ lib/ workers/` 를 실행하면
**Then** 결과는 0건이거나, 모든 hit는 `@MX:TODO` 또는 `@MX:NOTE` 주석에 포함되며 `@MX:SPEC` 사용 SPEC ID가 명시되어 있다

### Scenario D-1: 외부 API feature flag 동작
**Given** 환경변수 `FEATURE_EU_ECTD` 가 `disabled` 또는 unset 인 상태에서
**When** `lib/external/eu-ectd.ts` 의 진입 함수가 호출되면
**Then** `FeatureNotAvailableError` 가 throw 된다
**And** mock 데이터가 반환되지 않는다

### Scenario D-2: 외부 API feature flag enabled 시
**Given** 환경변수 `FEATURE_EU_ECTD=enabled` 인 상태에서
**When** `lib/external/eu-ectd.ts` 의 진입 함수가 호출되면
**Then** 실제 mTLS 호출이 시도되거나 (구현된 경우) 또는 명시적 `NotImplementedError` 가 throw 된다
**And** 1차 릴리즈에서는 production 환경에서 이 flag가 항상 disabled 이다

### Static check D-S2: Vectorize TODO SPEC 참조
**Given** 본 SPEC RUN 완료 시점에서
**When** `lib/ai/hybrid-router.ts` 를 검토하면
**Then** Vectorize 관련 미구현 코드는 `@MX:TODO` + `@MX:SPEC: SPEC-REGULA-VECTORIZE-001` 주석을 동반한다

### Static check D-S3: MSW fixture TODO 정리
**Given** 본 SPEC RUN 완료 시점에서
**When** `tests/e2e/fixtures/msw-sse.ts` 를 검토하면
**Then** TODO 주석이 0건이며, MSW handler가 구현되었거나 fixture 자체가 제거되었다

---

## Group E — Citation E2E

### Scenario E-1: 인증 fixture 적용 및 skip 해제
**Given** `playwright.config.ts` 가 storage state fixture를 사용하도록 구성된 상태에서
**When** Playwright runner가 `tests/e2e/citation-click.spec.ts` 를 실행하면
**Then** 4개 테스트 모두 `test.skip(true, ...)` 를 만나지 않고
**And** chromium·firefox 환경에서 실행된다

### Static check E-S1: skip(true) 부재
**Given** 본 SPEC RUN 완료 시점에서
**When** `tests/e2e/citation-click.spec.ts` 를 검토하면
**Then** `test.skip(true, ...)` 패턴이 0건이다

### Scenario E-2: CI 통과
**Given** GitHub Actions `e2e` job 이 실행되는 상태에서
**When** workflow가 완료되면
**Then** `Citation click → DocViewer (REQ-LAUNCH-019)` describe 블록이 chromium·firefox 환경에서 PASS 처리된다

### Edge case E-E1: 인증 시크릿 부재 시 명확한 실패
**Given** CI 환경에 `PLAYWRIGHT_AUTH_USER` 시크릿이 설정되지 않은 상태에서
**When** `globalSetup` 이 실행되면
**Then** 명확한 에러 메시지와 함께 fail 한다 (silent skip 금지)

---

## Group F — Workflow Beta Disclosure

### Scenario F-1: Beta 배지 표시
**Given** 사용자가 `/workflows` 페이지를 로드하고
**And** WORKFLOW_REGISTRY에 3개 워크플로우가 등록된 상태에서
**When** 페이지가 렌더링되면
**Then** 3개 WorkflowCard 각각에 "Beta" 텍스트를 포함한 배지 컴포넌트가 화면에 노출된다

### Scenario F-2: 실행 페이지 디스클로저 배너
**Given** 사용자가 `/workflows/submission-drafter` (또는 동등 path) 실행 페이지를 로드하면
**When** 페이지 로드 직후
**Then** 페이지 상단에 "이 기능은 베타입니다. 출력 결과는 mock 데이터이며, 실제 규제 의사결정에 사용하지 마십시오." 메시지의 디스클로저 배너가 표시된다
**And** 배너는 사용자 액션으로 닫히지 않는다 (non-dismissable)

### Scenario F-3: API 응답에 _mock 플래그
**Given** 워크플로우 실행 API가 호출되고
**When** `lib/workflows/submission-drafter/executor.ts` 의 mock step이 실행되면
**Then** 결과 JSON 의 top-level에 `_mock: true` 가 포함된다

### Scenario F-4: Audit log mock_data 태깅
**Given** 워크플로우 실행이 완료되고
**When** 실행 중 mock step 이 1개 이상 포함되었다면
**Then** 해당 workflow_run_id 를 가진 `audit_logs` 엔트리의 metadata 필드는 `{ mock_data: true, workflow_run_id: "<uuid>" }` 형식의 값을 포함한다

---

## Definition of Done (DoD)

본 SPEC의 모든 RUN 작업은 다음 조건을 모두 만족할 때 종료된다.

### 코드 게이트
- [ ] 28개 EARS 요구사항 모두에 대해 implementation 완료
- [ ] `pnpm typecheck` 통과 (zero error)
- [ ] `pnpm lint` 통과 (zero error, no-console 위반 0건 in app/lib/workers)
- [ ] `pnpm test` 통과 (단위·통합 테스트)
- [ ] CI `e2e` job 에서 chromium·firefox 매트릭스 PASS

### 정적 검증 게이트
- [ ] Static check C-S1, C-S2, C-S3 통과
- [ ] Static check D-S1, D-S2, D-S3 통과
- [ ] Static check E-S1 통과
- [ ] Static check B-S1 통과

### 시나리오 게이트
- [ ] Scenario A-1, A-2, A-3 verified
- [ ] Scenario B-1, B-2, B-3 verified
- [ ] Scenario C-1 verified
- [ ] Scenario D-1, D-2 verified
- [ ] Scenario E-1, E-2 verified
- [ ] Scenario F-1, F-2, F-3, F-4 verified

### 리뷰 게이트
- [ ] PR이 그룹별로 분리되어 (A+B, C, D, E, F) 리뷰됨
- [ ] expert-security 가 Group C 의 PII 마스킹 검증 완료
- [ ] manager-quality 의 TRUST 5 검증 완료

### 문서 게이트
- [ ] CHANGELOG.md 에 본 SPEC ID 와 변경사항 요약 추가
- [ ] feature flag 환경변수 매트릭스 (`FEATURE_EU_ECTD`, `FEATURE_FDA_ESTAR`) 가 `docs/deployment/env-matrix.md` 에 등록됨
- [ ] (해당 시) `SPEC-REGULA-VECTORIZE-001` deferred SPEC stub 발행
- [ ] (해당 시) `SPEC-REGULA-EXTERNAL-001` deferred SPEC stub 발행

### 의존성 게이트
- [ ] SPEC-REGULA-RELEASE-GATE-001 (P0) 가 status: completed 상태로 종료됨
