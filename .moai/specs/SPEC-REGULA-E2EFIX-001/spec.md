---
id: SPEC-REGULA-E2EFIX-001
title: "Regula E2E Activation — test.skip(true) 일괄 해제 및 인증 세션 자동화"
status: completed
phase: "release-hardening"
priority: High
version: 0.1.1
created: 2026-05-05
updated: 2026-05-06
author: manager-spec
issue_number: 97
depends_on:
  - SPEC-REGULA-RELEASE-HARDENING-001
  - SPEC-REGULA-RELEASE-GATE-001
related_specs:
  - SPEC-REGULA-RELEASE-001
  - SPEC-REGULA-LAUNCH-001
  - SPEC-REGULA-QUALITY-001
related_issues: []
closes_issues: []
labels:
  - release
  - e2e
  - high-priority
revision_history:
  - version: 0.1.0
    date: 2026-05-05
    author: manager-spec (release-gap remediation)
    notes: |
      Initial draft. 1차 RC 갭 리포트(2026-05-05) §2.1 후속.
      RELEASE-HARDENING-001 Group E (citation-click 단독 처리)와의 file ownership 분리 명시.
      8개 E2E spec 중 7개 (auth, consultation, expert-review, project-switch, i18n, a11y, security-headers)의
      `test.skip(true)` 일괄 해제 + Playwright global-setup 자동화 + .auth.json 시드 + CI 통합.
      총 10개 REQ across 3 groups.
  - version: 0.1.1
    date: 2026-05-05
    author: manager-spec
    notes: |
      plan-auditor High [H1~H5] 정정 — environment 자원 분리, staging-only EARS 명시,
      grep 게이트 명시 7-spec 나열, helper 적용 범위 명확화, REQ-DEPLOY-006 EARS 패턴 ED로 정정.
      [H3] REQ-E2EFIX-001 acceptance: grep 명령을 7 spec 파일 명시적 나열(옵션 A)로 변경
      → HARDENING-001 RUN 선완료 시에도 본 SPEC 검증 무효화 방지.
      [H4] REQ-E2EFIX-002: helper 적용 범위를 7 spec으로 한정. citation-click은 HARDENING-001
      ownership이므로 본 SPEC RUN 제외. 8 spec 일관성 회복은 별도 후속 PR(v0.2.0 또는
      SPEC-REGULA-E2EFIX-002)로 진행.
---

# SPEC-REGULA-E2EFIX-001 — Regula E2E Activation

## 1. 목적 (Purpose)

Regula 1차 릴리즈 v1.0.0-rc 진입의 핵심 차단 요인 중 하나는 **8개 Playwright E2E spec 모두가 `test.skip(true)` 또는 `PLAYWRIGHT_BASE_URL` 환경 가드로 비활성화된 상태**라는 점이다. 본 SPEC은 다음을 달성한다:

1. **citation-click.spec.ts 외 7개 spec의 `test.skip(true)` 일괄 해제** (auth, consultation, expert-review, project-switch, i18n, a11y, security-headers)
2. **Playwright global-setup 자동화** — 단일 SSO 로그인 → `.auth.json` storage state 직렬화
3. **`tests/e2e/fixtures/auth.ts` fixture 보강** — 현재 placeholder marker만 주입하는 형태에서 실제 storage state 로드로 전환
4. **CI 통합** — `.github/workflows/ci.yml`의 e2e job에서 globalSetup 자동 실행 + `.auth.json` 환경변수 주입

본 SPEC은 신규 비즈니스 기능을 추가하지 않는다. **기존 8 spec의 활성화와 인증 세션 시드 자동화만을 다룬다.**

### 1.1 결함 매트릭스

| ID | 결함 | 영향 | 출처 |
| --- | --- | --- | --- |
| EF-1 | `tests/e2e/auth.spec.ts` 다수 test가 `test.skip(true, 'Requires authenticated session')` | core 인증 플로우 회귀 미검증 | 직접 검증 (Explore §런타임/E2E) |
| EF-2 | `tests/e2e/consultation.spec.ts`, `expert-review.spec.ts`, `project-switch.spec.ts`, `i18n.spec.ts`, `a11y.spec.ts`, `security-headers.spec.ts` 동일 패턴 | 5개 LAUNCH-001 LR-F-* 게이트 미검증 | 동일 |
| EF-3 | `tests/e2e/fixtures/auth.ts`가 `.auth.json` 옵셔널 로드 + window marker 주입만 수행 (실제 storage state 미적용) | authenticated 시나리오 항상 미인증 컨텍스트 | 직접 검증 (`tests/e2e/fixtures/auth.ts:15-25`) |
| EF-4 | `playwright/globalSetup.ts` 부재 — `.auth.json` 시드 자동화 없음 | 신규 개발자 + CI runner가 매번 수동 SSO | 직접 검증 (디렉토리 부재) |

### 1.2 비범위 (Out of Scope)

- **`tests/e2e/citation-click.spec.ts` 처리** — RELEASE-HARDENING-001 REQ-HARDEN-022~024 단독 owner. 본 SPEC은 해당 파일을 수정하지 않는다.
- **신규 E2E spec 추가** — 본 SPEC은 활성화만 다룬다. 신규 시나리오는 별도 SPEC.
- **MSW 기반 SSE mock 보강** — RELEASE-HARDENING-001 REQ-HARDEN-021의 `tests/e2e/fixtures/msw-sse.ts` TODO 정리는 별도.
- **DB seed 메커니즘** — QUALITY-001 Group A (REQ-QUAL-001~005) 단독 owner.
- **Webkit 브라우저 처리 정책** — LAUNCH REQ-LAUNCH-022 (warning only) 그대로 계승.

---

## 2. 범위 (Scope)

### In Scope

- 7개 spec 파일의 `test.skip(true, 'Requires authenticated session — run with PLAYWRIGHT_AUTH_STATE set')` 일괄 제거
- 환경 가드 (`process.env.CI !== 'true' && !process.env.PLAYWRIGHT_BASE_URL` 패턴)는 유지하되, CI에서 `PLAYWRIGHT_BASE_URL` + `PLAYWRIGHT_AUTH_STATE`가 자동 주입되도록 보강
- `playwright/globalSetup.ts` 신규 작성 — Microsoft/Google SSO 자동 로그인 → cookies + localStorage 직렬화 → `.auth.json` 저장
- `tests/e2e/fixtures/auth.ts` 재작성 — `storageState` 옵션을 활용한 정식 인증 컨텍스트
- `playwright.config.ts`에 `globalSetup` 키 추가
- `.github/workflows/ci.yml`의 e2e job에 `PLAYWRIGHT_AUTH_STATE` env + globalSetup 실행 단계 추가
- 전용 테스트 계정 사용 정책 명시 (실제 운영 계정 사용 금지)

### Out of Scope

- citation-click spec (HARDENING-001)
- msw-sse fixture (HARDENING-001)
- DB corpus seed (QUALITY-001)
- 워크플로우 Beta E2E 추가 (HARDENING-001 Group F)

---

## 3. EARS 요구사항

EARS 패턴 라벨: U=Ubiquitous, ED=Event-Driven, SD=State-Driven, O=Optional, UB=Unwanted.

### Group A — test.skip 일괄 해제 (REQ-E2EFIX-001 ~ 003)

#### REQ-E2EFIX-001 (UB) — `test.skip(true)` 금지

The 7 E2E spec files (`tests/e2e/auth.spec.ts`, `consultation.spec.ts`, `expert-review.spec.ts`, `project-switch.spec.ts`, `i18n.spec.ts`, `a11y.spec.ts`, `security-headers.spec.ts`) **shall not** contain any `test.skip(true, ...)` calls. Only conditional skips bound to environment availability (`process.env.PLAYWRIGHT_BASE_URL`, `process.env.CI`) **are** permitted.

Acceptance (HARDENING-001 진행 상태와 무관하게 본 SPEC 7-spec만 측정 — 옵션 A: 명시적 file 나열):

```
git grep -nE "test\.skip\(true" \
  tests/e2e/auth.spec.ts \
  tests/e2e/consultation.spec.ts \
  tests/e2e/expert-review.spec.ts \
  tests/e2e/project-switch.spec.ts \
  tests/e2e/i18n.spec.ts \
  tests/e2e/a11y.spec.ts \
  tests/e2e/security-headers.spec.ts
```

- 위 명령 결과: **0건** (citation-click.spec.ts는 HARDENING-001 ownership으로 본 grep에서 제외)
- All 7 spec files compile and execute (skip만 환경 가드로 처리)
- 본 grep 게이트는 RELEASE-HARDENING-001 REQ-HARDEN-022 grep 게이트와 file 집합이 다르므로(7 vs 1), HARDENING-001 RUN 선완료 시에도 본 SPEC의 검증이 무효화되지 않는다

#### REQ-E2EFIX-002 (U) — 환경 가드 표준화

The 7 E2E spec files **shall** use a single shared environment guard helper imported from `tests/e2e/fixtures/env-guard.ts`, replacing per-file inline `describe.skip(...)` patterns; the helper **shall** export `requiresLiveServer()` and `requiresAuthState()` returning `{ skip: boolean, reason: string }` derived from `PLAYWRIGHT_BASE_URL` and `PLAYWRIGHT_AUTH_STATE` env presence.

Helper 적용 범위 (HARDENING-001 ownership 분리):
- 본 SPEC의 helper 적용 대상은 7 spec (auth, consultation, expert-review, project-switch, i18n, a11y, security-headers)에 한정한다.
- `tests/e2e/citation-click.spec.ts`는 RELEASE-HARDENING-001 REQ-HARDEN-022~024 단독 ownership이므로 본 SPEC의 helper 적용 대상에서 **제외**한다.
- HARDENING-001 RUN 완료 후, 8 spec 가드 패턴 일관성 회복을 위한 helper 마이그레이션은 별도 후속 PR(예: 본 SPEC v0.2.0 또는 SPEC-REGULA-E2EFIX-002)로 진행한다. 후속 PR이 완료되면 8 spec이 단일 helper를 공유하게 된다.

Acceptance:
- `tests/e2e/fixtures/env-guard.ts` 존재
- 7 spec files all `import { requiresLiveServer, requiresAuthState } from './fixtures/env-guard'`
- citation-click.spec.ts는 본 SPEC RUN에서 helper import 미요구 (수정 금지 파일)
- helper 단위 테스트 통과

#### REQ-E2EFIX-003 (UB) — 운영 계정 사용 금지

The E2E auth flow **shall not** use any production user account. **IF** `PLAYWRIGHT_AUTH_STATE`이 가리키는 storage state 또는 SSO credentials가 production user pattern (이메일 도메인이 회사 production 도메인 매칭)에 해당하면, **THEN** globalSetup **shall** abort with error `"E2E must use dedicated test account"`.

Acceptance:
- `playwright/globalSetup.ts` 내 production email regex 차단 로직 단위 테스트 존재
- 의도적 production 이메일 입력 시 abort 확인

### Group B — Global Setup + .auth.json 자동화 (REQ-E2EFIX-004 ~ 008)

#### REQ-E2EFIX-004 (U) — Playwright globalSetup 추가

The system **shall** provide `playwright/globalSetup.ts` (또는 `tests/e2e/global-setup.ts`) that, when executed by `playwright.config.ts` `globalSetup` hook, performs: (a) launch Chromium browser, (b) navigate to login page, (c) fill SSO credentials from `E2E_TEST_USER_EMAIL` + `E2E_TEST_USER_PASSWORD` env, (d) wait for redirect to `/`, (e) serialize `context.storageState()` to file specified by `PLAYWRIGHT_AUTH_STATE` env (default `tests/e2e/fixtures/.auth.json`).

Acceptance:
- `playwright/globalSetup.ts` 또는 동등 경로 파일 존재
- 실행 시 `tests/e2e/fixtures/.auth.json` 생성 확인 (cookies + localStorage 포함)

#### REQ-E2EFIX-005 (U) — playwright.config.ts globalSetup 등록

The `playwright.config.ts` **shall** export `globalSetup: require.resolve('./playwright/globalSetup')` (or equivalent path) AND `use.storageState: process.env.PLAYWRIGHT_AUTH_STATE ?? 'tests/e2e/fixtures/.auth.json'`.

Acceptance:
- `playwright.config.ts` parsing으로 `globalSetup` 키 존재 확인
- `use.storageState` 키 + 기본값 일치 확인

#### REQ-E2EFIX-006 (U) — auth fixture 정식 storage state 적용

The `tests/e2e/fixtures/auth.ts` `authenticatedPage` fixture **shall** use Playwright's native `storageState` option (via project-level config or per-test `test.use({ storageState: ... })`), replacing the current placeholder marker injection (`__E2E_AUTH_LOADED__`).

Acceptance:
- `tests/e2e/fixtures/auth.ts` 가 `addInitScript(window.__E2E_AUTH_LOADED__)` 패턴 제거
- 인증 컨텍스트가 cookies + localStorage 모두 가지고 시작

#### REQ-E2EFIX-007 (ED) — globalSetup 실패 시 abort

**WHEN** globalSetup이 SSO 로그인 실패(redirect timeout, credential rejection)를 감지하면, **THE** Playwright run **shall** abort immediately with non-zero exit code AND stdout에 `"globalSetup failed: <reason>"` 메시지를 출력한다.

Acceptance:
- 잘못된 credentials 주입 시 globalSetup 실행 중 throw
- `pnpm test:e2e` exit code ≠ 0
- 에러 메시지 형식 일치

#### REQ-E2EFIX-008 (UB) — `.auth.json` 커밋 금지

The `.auth.json` 파일 **shall not** be committed to the repository. `.gitignore`에 `tests/e2e/fixtures/.auth.json` 항목이 명시적으로 존재해야 한다.

Acceptance:
- `.gitignore` 파싱 시 해당 경로 entry 존재
- `git ls-files tests/e2e/fixtures/` 결과에 `.auth.json` 부재

### Group C — CI 통합 (REQ-E2EFIX-009 ~ 010)

#### REQ-E2EFIX-009 (ED) — CI e2e job globalSetup 자동 주입

**WHEN** the CI pipeline (`.github/workflows/ci.yml`) executes the `e2e` job, **THE** job **shall** (a) populate `E2E_TEST_USER_EMAIL` and `E2E_TEST_USER_PASSWORD` from GitHub Secrets, (b) populate `PLAYWRIGHT_BASE_URL` from preview deployment URL or `http://localhost:3000`, (c) execute `pnpm playwright test` (which triggers globalSetup), (d) upload `.auth.json` as ephemeral artifact for debugging only (artifact retention ≤ 7 days, encrypted).

Acceptance:
- `.github/workflows/ci.yml` e2e job 정의에 3 env + 1 step + 1 artifact upload 모두 존재
- artifact 주입 후 retention period 검증

#### REQ-E2EFIX-010 (U) — Chromium + Firefox 필수 통과

The CI e2e job **shall** require all 7 spec × 2 browsers (Chromium, Firefox) = 14 spec-browser combinations to pass. Webkit 결과는 LAUNCH REQ-LAUNCH-022 정책(warning only, ≤ 5% failure threshold)을 그대로 계승한다.

Acceptance:
- CI 결과 matrix에서 Chromium + Firefox 모두 green
- Webkit 결과는 보고만 (job-level required check 아님)

---

## 4. Acceptance Criteria

상세 Given-When-Then 시나리오는 `acceptance.md` 참고. 핵심 게이트:

- `git grep -nE "test\.skip\(true" tests/e2e/auth.spec.ts tests/e2e/consultation.spec.ts tests/e2e/expert-review.spec.ts tests/e2e/project-switch.spec.ts tests/e2e/i18n.spec.ts tests/e2e/a11y.spec.ts tests/e2e/security-headers.spec.ts` → 0건 (citation-click.spec.ts는 HARDENING-001 ownership이므로 검증 대상 제외)
- `playwright/globalSetup.ts` 또는 동등 경로 파일 존재 + `pnpm test:e2e` 실행 시 `.auth.json` 자동 생성 확인
- `tests/e2e/fixtures/.auth.json`이 `.gitignore`에 의해 추적되지 않음
- CI에서 7 spec × 2 browser = 14 조합 모두 green
- Webkit 결과는 보고만 (실패 허용 ≤ 5%)
- `tests/e2e/fixtures/auth.ts` 가 storage state 정식 사용 (placeholder marker 제거)

---

## 5. Exclusions (What NOT to Build)

본 SPEC이 **명시적으로 다루지 않는** 항목:

1. **`tests/e2e/citation-click.spec.ts` 수정** — RELEASE-HARDENING-001 REQ-HARDEN-022~024 ownership. 본 SPEC은 해당 파일을 일체 수정하지 않는다.
2. **`tests/e2e/fixtures/msw-sse.ts` MSW handler 보강** — RELEASE-HARDENING-001 REQ-HARDEN-021 ownership.
3. **신규 E2E spec 추가** — 본 SPEC은 기존 8 spec 활성화만. dashboard / knowledge-base / templates 등 LAUNCH-001 Pending H1 항목은 별도 SPEC.
4. **DB seed / corpus 시드** — QUALITY-001 Group A ownership.
5. **`playwright.config.ts`의 retries / workers / browser projects 변경** — LAUNCH REQ-LAUNCH-014 그대로 계승.
6. **Webkit Pass 강제** — LAUNCH REQ-LAUNCH-022 정책(warning only) 그대로 유지.
7. **운영 계정 SSO 자동화** — 전용 test 계정만 허용.
8. **신규 비즈니스 기능, 새로운 API endpoint** — 본 SPEC은 E2E 활성화만 다룬다.

---

## 6. Dependencies and Sequencing

- **Hard dependency**: SPEC-REGULA-RELEASE-HARDENING-001 (Group E REQ-HARDEN-022~024) — citation-click.spec.ts ownership 분리 필수. HARDENING-001 RUN 진행 중 또는 완료 후 본 SPEC RUN 진입 가능 (병행 가능, file 충돌 없음).
- **Soft dependency**: SPEC-REGULA-RELEASE-GATE-001 (CI green 보장) — 본 SPEC RUN의 검증 환경 전제.
- **Coupled completion**: 본 SPEC 완료 시 RELEASE-HARDENING-001 Group E 완료와 결합되어 RELEASE-001 REQ-REL-010 (release PR CI green) 충족 가능.
- **No conflict**: file ownership 분리 명확
  - HARDENING-001: `tests/e2e/citation-click.spec.ts` 단독
  - 본 SPEC: 나머지 7 spec + `playwright/globalSetup.ts`(신규) + `tests/e2e/fixtures/auth.ts`(보강) + `tests/e2e/fixtures/env-guard.ts`(신규) + `playwright.config.ts` + `.github/workflows/ci.yml` + `.gitignore`

---

## 7. Risk Notes

- **테스트 인증 세션 위험 (Group B)**: storage state fixture 작성 시 실제 운영 계정의 세션이 CI artifact에 누출되지 않도록 dedicated test account + 7-day 단기 artifact retention + encrypted artifact upload 강제. REQ-E2EFIX-003 명시적 차단.
- **Webkit flakiness**: LAUNCH REQ-LAUNCH-022 정책(warning only) 계승. 본 SPEC은 webkit 동작 보장하지 않음.
- **CI runner SSO 안정성**: SSO provider (Microsoft Entra ID, Google) outage 시 globalSetup이 abort. RELEASE-001 REQ-REL-020 bounded build 정책으로 완화.
- **`.auth.json` 만료**: storage state cookies는 일정 시간 후 만료. globalSetup이 매 CI 실행 시 새로 생성하므로 자연 mitigation.

---

## 8. References

### 8.1 GitHub Artifacts

- (이슈 자동 생성 금지 — 사용자 검토 후 직접 생성 예정)

### 8.2 관련 SPEC

- SPEC-REGULA-RELEASE-001 (umbrella, REQ-REL-010 정합성)
- SPEC-REGULA-RELEASE-HARDENING-001 (citation-click 단독 ownership 분리)
- SPEC-REGULA-RELEASE-GATE-001 (CI green 전제)
- SPEC-REGULA-LAUNCH-001 (E2E browser matrix 정책)
- SPEC-REGULA-QUALITY-001 (DB seed)

### 8.3 코드 진입점

- `tests/e2e/auth.spec.ts` (Group A)
- `tests/e2e/consultation.spec.ts` (Group A)
- `tests/e2e/expert-review.spec.ts` (Group A)
- `tests/e2e/project-switch.spec.ts` (Group A)
- `tests/e2e/i18n.spec.ts` (Group A)
- `tests/e2e/a11y.spec.ts` (Group A)
- `tests/e2e/security-headers.spec.ts` (Group A)
- `tests/e2e/fixtures/env-guard.ts` (신규, Group A)
- `tests/e2e/fixtures/auth.ts` (보강, Group B)
- `playwright/globalSetup.ts` (신규, Group B)
- `playwright.config.ts` (보강, Group B)
- `.gitignore` (보강, Group B)
- `.github/workflows/ci.yml` (보강, Group C)

### 8.4 연구 / 추적 문서

- `plan.md` (본 디렉토리)
- `acceptance.md` (본 디렉토리)
- `.moai/plans/review-gaps-2026-05-05.md` §2.1

### 8.5 QA 단계 게이트 정의

QA 단계 게이트(0~5) 정의는 `.moai/specs/_shared/qa-gate-roadmap.md`를 참조하라.

---

REQ coverage 요약:
- Group A (test.skip 해제): 3 REQ
- Group B (globalSetup + .auth.json): 5 REQ
- Group C (CI 통합): 2 REQ

**Total: 10 EARS requirements**
