# SPEC-REGULA-E2EFIX-001 — 구현 계획 (plan.md)

## 1. 개요

본 SPEC은 7개 E2E spec의 `test.skip(true)` 일괄 해제, Playwright globalSetup 자동화, CI 통합을 다룬다. 신규 비즈니스 기능 0건, 인프라 코드 변경만 존재한다.

## 2. Milestones (Priority-based, no time estimates)

### Milestone M1 — Priority High: 환경 가드 표준화 + test.skip 해제

**대상 REQ**: REQ-E2EFIX-001, 002, 003

작업 단위:

1. `tests/e2e/fixtures/env-guard.ts` 신규 작성 — `requiresLiveServer()` / `requiresAuthState()` helper export
2. 7 spec 파일에서 `test.skip(true, ...)` 호출 제거
3. 각 spec 상단의 `process.env.CI !== 'true' && !process.env.PLAYWRIGHT_BASE_URL` 인라인 가드를 helper import로 교체
4. production user pattern 차단 로직을 helper에 포함

검증 지점:
- 명시적 7-spec grep (HARDENING-001 진행 상태와 무관, [H3] 옵션 A 채택):
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
  결과: 0건 (citation-click.spec.ts는 HARDENING-001 ownership으로 본 grep에서 제외)
- 7 spec import statement에 `from './fixtures/env-guard'` 존재
- citation-click.spec.ts는 본 SPEC RUN에서 미수정 (helper 미적용, [H4] 명시)

### Milestone M2 — Priority High: Playwright globalSetup + storage state

**대상 REQ**: REQ-E2EFIX-004, 005, 006, 007, 008

작업 단위:

1. `playwright/globalSetup.ts` 신규 작성 — SSO 자동 로그인 + storage state 직렬화
2. `playwright.config.ts` 에 `globalSetup` + `use.storageState` 키 추가
3. `tests/e2e/fixtures/auth.ts` 재작성 — placeholder marker 제거, native storageState 활용
4. `.gitignore` 에 `tests/e2e/fixtures/.auth.json` 추가
5. globalSetup 실패 시 abort + 에러 메시지 형식 정의

검증 지점:
- 로컬에서 `pnpm test:e2e` 실행 시 `.auth.json` 자동 생성
- 잘못된 credentials 주입 시 즉시 abort
- `.auth.json`이 git status에 등장하지 않음

### Milestone M3 — Priority Medium: CI 통합

**대상 REQ**: REQ-E2EFIX-009, 010

작업 단위:

1. `.github/workflows/ci.yml` e2e job 보강
   - `E2E_TEST_USER_EMAIL`, `E2E_TEST_USER_PASSWORD` GitHub Secrets 주입
   - `PLAYWRIGHT_BASE_URL` 자동 결정 (preview URL 또는 localhost:3000)
   - `pnpm playwright test --project=chromium --project=firefox` 실행
   - artifact upload (encrypted, retention 7 days)
2. Webkit job은 별도 matrix entry로 분리 (warning only, job-level required check 미설정)

검증 지점:
- CI run 결과에서 Chromium + Firefox green
- Webkit 실패 시에도 PR merge 차단되지 않음 (warning만)
- artifact retention 정확히 7 days

## 3. 파일 변경 매트릭스

| 파일 | 작업 | Milestone | REQ |
| --- | --- | --- | --- |
| `tests/e2e/fixtures/env-guard.ts` | 신규 | M1 | REQ-E2EFIX-002 |
| `tests/e2e/auth.spec.ts` | 수정 (skip 제거 + helper import) | M1 | REQ-E2EFIX-001, 002 |
| `tests/e2e/consultation.spec.ts` | 수정 | M1 | REQ-E2EFIX-001, 002 |
| `tests/e2e/expert-review.spec.ts` | 수정 | M1 | REQ-E2EFIX-001, 002 |
| `tests/e2e/project-switch.spec.ts` | 수정 | M1 | REQ-E2EFIX-001, 002 |
| `tests/e2e/i18n.spec.ts` | 수정 | M1 | REQ-E2EFIX-001, 002 |
| `tests/e2e/a11y.spec.ts` | 수정 | M1 | REQ-E2EFIX-001, 002 |
| `tests/e2e/security-headers.spec.ts` | 수정 | M1 | REQ-E2EFIX-001, 002 |
| `tests/e2e/citation-click.spec.ts` | **수정 금지** (HARDENING-001 ownership) | — | — |
| `playwright/globalSetup.ts` | 신규 | M2 | REQ-E2EFIX-004, 007 |
| `playwright.config.ts` | 수정 (globalSetup + storageState 키) | M2 | REQ-E2EFIX-005 |
| `tests/e2e/fixtures/auth.ts` | 재작성 | M2 | REQ-E2EFIX-006 |
| `.gitignore` | 수정 (.auth.json entry 추가) | M2 | REQ-E2EFIX-008 |
| `.github/workflows/ci.yml` | 수정 (e2e job 보강) | M3 | REQ-E2EFIX-009, 010 |

총 신규 파일: 2 (env-guard.ts, globalSetup.ts)
총 수정 파일: 11
총 미수정 (격리): 1 (citation-click.spec.ts)

## 4. 기술 접근 (Technical Approach)

### 4.1 SSO 자동 로그인 전략

Microsoft Entra ID와 Google Workspace 두 SSO provider를 지원한다. globalSetup에서 `E2E_AUTH_PROVIDER` 환경변수(`microsoft` | `google`)로 분기:

- **Microsoft**: OAuth2 redirect flow를 Playwright `page.fill()` + `page.click()`으로 자동화. MFA는 test account에 대해 비활성화 (전제조건).
- **Google**: 동일 패턴.

### 4.2 storage state 직렬화 형식

Playwright 표준 `context.storageState({ path })` 사용. 파일 구조:

- `cookies`: 세션 쿠키 + auth.js token cookies
- `origins[].localStorage`: PostHog distinct_id, locale 선호 등

### 4.3 환경 가드 helper API

```
// tests/e2e/fixtures/env-guard.ts (시그니처만)
export function requiresLiveServer(): { skip: boolean, reason: string }
export function requiresAuthState(): { skip: boolean, reason: string }
export function isProductionEmail(email: string): boolean
```

### 4.4 CI artifact 보안

`.auth.json`은 GitHub Actions artifact로 업로드 시:

- `encrypted: true` (GitHub Actions feature)
- `retention-days: 7`
- 디버그 용도만 — production 계정 사용 금지(REQ-E2EFIX-003)

## 5. 위험 (Risks) and Mitigations

| Risk | Mitigation |
| --- | --- |
| SSO provider 일시 outage | RELEASE-001 REQ-REL-020 bounded build 적용. globalSetup timeout 30s |
| storage state 만료 | 매 CI run마다 새로 생성. 만료 자체는 자연 mitigation |
| MFA 활성 test 계정 | 사전 조건으로 MFA 비활성화 명시 (`docs/runbook.md` 갱신) |
| Webkit flakiness | LAUNCH REQ-LAUNCH-022 정책 계승, warning only |
| 운영 계정 누출 | REQ-E2EFIX-003 production email regex 차단 |

## 6. RUN 진입 게이트

- RELEASE-HARDENING-001 Group E (citation-click.spec.ts)와 file ownership 충돌 0건 확인
- 전용 test 계정 생성 + MFA 비활성화 확인 (수동 운영 작업)
- GitHub Secrets에 `E2E_TEST_USER_EMAIL`, `E2E_TEST_USER_PASSWORD` 등록 확인

## 7. 완료 조건 요약

- [ ] 10 REQ 전부 acceptance 통과
- [ ] 7 spec × Chromium/Firefox = 14 조합 모두 green
- [ ] `.auth.json` 자동 생성 + .gitignore 추적 차단
- [ ] CI artifact retention 7 days + encrypted
- [ ] Webkit warning-only 정책 동작 확인
