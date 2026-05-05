# SPEC-REGULA-E2EFIX-001 — 인수 기준 (acceptance.md)

## 1. 핵심 인수 기준 (Top-Level)

본 SPEC이 완료되었다고 판정하는 5개 핵심 게이트:

1. **G1**: 명시적 7-spec grep 결과가 0건 — `git grep -nE "test\.skip\(true" tests/e2e/auth.spec.ts tests/e2e/consultation.spec.ts tests/e2e/expert-review.spec.ts tests/e2e/project-switch.spec.ts tests/e2e/i18n.spec.ts tests/e2e/a11y.spec.ts tests/e2e/security-headers.spec.ts` (citation-click.spec.ts는 HARDENING-001 ownership으로 본 grep에서 제외 — HARDENING-001 진행 상태와 무관하게 본 SPEC 검증 유효)
2. **G2**: `pnpm test:e2e` 로컬 실행 시 `.auth.json` 자동 생성 + 7 spec × Chromium green
3. **G3**: CI에서 7 spec × {Chromium, Firefox} = 14 조합 모두 green
4. **G4**: `.gitignore`에 `tests/e2e/fixtures/.auth.json` entry 존재 + `git ls-files` 결과 부재
5. **G5**: 의도적 production email 주입 시 globalSetup 즉시 abort

## 2. Given-When-Then 시나리오

### 2.1 Group A — test.skip 일괄 해제 (REQ-E2EFIX-001~003)

#### 시나리오 A1 — test.skip(true) 호출 0건 (명시적 7-spec grep, [H3] 옵션 A)

**Given** 7 E2E spec 파일이 작업 대상 (auth, consultation, expert-review, project-switch, i18n, a11y, security-headers)
**When** 본 SPEC RUN 완료 후 다음 명령 실행:
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
**Then** 결과: **0건** (citation-click.spec.ts는 HARDENING-001 ownership으로 grep 인자에서 제외되므로 항상 본 grep 결과에 영향을 주지 않음 — HARDENING-001 RUN 선완료 시에도 본 시나리오 검증 유효)

#### 시나리오 A2 — env-guard helper 표준화

**Given** 7 spec 파일이 helper 표준 미사용 상태
**When** RUN M1 완료
**Then** 7 spec 파일 각각이 `import { requiresLiveServer, requiresAuthState } from './fixtures/env-guard'` 구문을 포함하고, 인라인 환경 가드 패턴 (`process.env.CI !== 'true' && !process.env.PLAYWRIGHT_BASE_URL`)이 제거됨

#### 시나리오 A3 — production email 차단

**Given** 전용 test 계정 미존재 또는 운영 이메일 주입
**When** `E2E_TEST_USER_EMAIL=user@regula-prod.com pnpm test:e2e` 실행
**Then** globalSetup이 즉시 abort + stderr에 `"E2E must use dedicated test account"` 출력 + exit code ≠ 0

### 2.2 Group B — globalSetup + .auth.json (REQ-E2EFIX-004~008)

#### 시나리오 B1 — globalSetup 자동 .auth.json 생성

**Given** 깨끗한 checkout (`.auth.json` 부재)
**Given** GitHub Secrets 또는 로컬 `.env.test`에 `E2E_TEST_USER_EMAIL`, `E2E_TEST_USER_PASSWORD` 설정
**When** `pnpm test:e2e --project=chromium` 실행
**Then** `tests/e2e/fixtures/.auth.json` 파일이 자동 생성되고, JSON 파싱 시 `cookies` 배열 길이 ≥ 1 + `origins[0].localStorage` 키 ≥ 1

#### 시나리오 B2 — playwright.config.ts globalSetup 등록

**Given** RUN M2 완료 후 `playwright.config.ts`
**When** TypeScript compile + AST 파싱
**Then** 다음 두 항목 모두 존재:
- `globalSetup: <require.resolve 또는 동등 경로 string>`
- `use: { storageState: process.env.PLAYWRIGHT_AUTH_STATE ?? 'tests/e2e/fixtures/.auth.json', ... }`

#### 시나리오 B3 — auth fixture storage state 정식 사용

**Given** RUN M2 완료 후 `tests/e2e/fixtures/auth.ts`
**When** 파일 내용 grep
**Then** `__E2E_AUTH_LOADED__` placeholder marker 패턴이 제거되고, `addInitScript` 호출이 0건 또는 storage-state 무관한 용도로만 존재. fixture가 `test.use({ storageState })` 또는 project-level storage state를 활용

#### 시나리오 B4 — globalSetup 실패 시 즉시 abort

**Given** 잘못된 credentials (`E2E_TEST_USER_PASSWORD=invalid-password`)
**When** `pnpm test:e2e` 실행
**Then** globalSetup이 SSO redirect timeout 또는 credential rejection 감지 후 30초 이내 abort + stderr `"globalSetup failed: <reason>"` 형식 + exit code ≠ 0 + 어떤 spec도 실행되지 않음

#### 시나리오 B5 — `.auth.json` 커밋 차단

**Given** RUN M2 완료
**When** `git status --short tests/e2e/fixtures/` 실행 (`.auth.json` 생성 후)
**Then** `.auth.json`이 untracked로도 staged로도 등장하지 않음 (`.gitignore` 처리)
**And** `git ls-files tests/e2e/fixtures/.auth.json` 결과가 빈 출력
**And** `.gitignore` 파일에 `tests/e2e/fixtures/.auth.json` 또는 동등 패턴 entry 존재

### 2.3 Group C — CI 통합 (REQ-E2EFIX-009~010)

#### 시나리오 C1 — CI e2e job env + secret 주입

**Given** RUN M3 완료 후 `.github/workflows/ci.yml`
**When** YAML 파싱
**Then** `e2e` job 정의에 다음 모두 존재:
- `env.E2E_TEST_USER_EMAIL: ${{ secrets.E2E_TEST_USER_EMAIL }}`
- `env.E2E_TEST_USER_PASSWORD: ${{ secrets.E2E_TEST_USER_PASSWORD }}`
- `env.PLAYWRIGHT_BASE_URL` 결정 로직 (preview URL fallback localhost:3000)
- `pnpm playwright test` 실행 step
- `actions/upload-artifact@v4` step with `retention-days: 7`

#### 시나리오 C2 — Chromium + Firefox 14 조합 green

**Given** PR이 본 SPEC RUN 결과로 생성
**When** GitHub Actions ci.yml workflow 실행
**Then** matrix `browser: [chromium, firefox]`에 대해 7 spec × 2 = 14 spec-browser 조합 모두 success
**And** webkit 결과가 별도 entry로 표시되지만 PR-level required check가 아님 (LAUNCH REQ-LAUNCH-022 계승)

#### 시나리오 C3 — Webkit warning-only

**Given** webkit에서 1 spec이 일시 실패
**When** CI 완료 + branch protection rules 평가
**Then** PR이 mergeable 상태 유지 (webkit job이 required check 미설정)
**And** webkit failure가 PR comment에 warning으로 표시 (선택적)

## 3. Edge Cases

| Edge Case | 처리 방식 | 검증 |
| --- | --- | --- |
| `.auth.json` 손상 (JSON parse fail) | globalSetup이 재실행하여 새로 생성 | 의도적 손상 후 다음 run에서 재생성 확인 |
| SSO provider outage | globalSetup timeout 30s 후 abort | 의도적 invalid URL로 timeout 시뮬레이션 |
| MFA 강제 활성 test 계정 | 사전 조건 위반 — runbook으로 명시 | docs/runbook.md에 MFA 비활성 사전조건 기재 |
| `PLAYWRIGHT_AUTH_STATE` 명시 + 파일 부재 | globalSetup이 새로 생성 | 빈 경로 주입 후 자동 생성 확인 |
| 동시 다중 CI run | 각 run이 독립 storage state 생성 (concurrency-safe) | matrix.parallel 시 충돌 없음 확인 |
| Chromium만 사용 가능 환경 | Firefox/Webkit job skip 가능 (e2e job matrix omitfailure not enforced) | matrix include/exclude 옵션 활용 |

## 4. Definition of Done

- [ ] G1~G5 5 핵심 게이트 모두 통과
- [ ] 10 REQ 모두 acceptance 시나리오 통과 확인
- [ ] `tests/e2e/fixtures/env-guard.ts` 단위 테스트 ≥ 3 (production email 차단, env 부재, 정상 케이스)
- [ ] `tests/e2e/fixtures/auth.ts` storage state 정식 사용 검증
- [ ] CI 7 spec × Chromium/Firefox = 14 조합 green (1 sample run 이상)
- [ ] CI artifact `.auth.json` 7-day retention + encrypted 확인
- [ ] HARDENING-001 Group E (citation-click) 파일 미수정 확인
- [ ] LAUNCH REQ-LAUNCH-022 Webkit warning-only 정책 계승 확인
- [ ] DEVELOPMENT.md 또는 runbook.md에 MFA 비활성 사전조건 + test 계정 운영 정책 명시

## 5. Quality Gate Criteria

- TypeScript strict mode compile 0 error
- Biome lint 0 violation (env-guard.ts, globalSetup.ts, auth.ts)
- 운영 계정 누출 사고 0건 (CI artifact retention + production email regex 차단)
- 시간 경과에 따른 storage state 재생성 자연 mitigation 동작 확인
- TRUST 5 — Tested(E2E green), Readable(helper API 명료), Unified(7 spec 패턴 통일), Secured(production 계정 차단), Trackable(REQ-E2EFIX-NNN 추적)

## 6. RACI (책임 매트릭스)

| 항목 | Responsible | Accountable | Consulted | Informed |
| --- | --- | --- | --- | --- |
| env-guard.ts 작성 | manager-tdd / 구현 담당 | manager-spec | — | release-orchestrator |
| globalSetup.ts 작성 | manager-tdd / 구현 담당 | manager-spec | expert-frontend | release-orchestrator |
| 7 spec test.skip 제거 | manager-tdd | manager-spec | — | release-orchestrator |
| `.gitignore` 수정 | manager-tdd | manager-spec | manager-git | — |
| `.github/workflows/ci.yml` 수정 | manager-tdd | manager-spec | manager-git | release-orchestrator |
| Test 계정 생성 + MFA off | 운영팀 (수동) | 운영팀 | manager-spec | — |
| GitHub Secrets 등록 | 운영팀 (수동) | 운영팀 | manager-git | — |
| Webkit warning-only 정책 검증 | manager-tdd | manager-spec | LAUNCH-001 owner | — |
| HARDENING-001 ownership 분리 | manager-spec | manager-spec | HARDENING-001 owner | — |
