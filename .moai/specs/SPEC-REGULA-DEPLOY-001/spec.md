---
id: SPEC-REGULA-DEPLOY-001
title: "Regula 1차 RC 배포 자동화 — Vercel Preview · Cloudflare Staging · Post-deploy Smoke"
status: draft
phase: "release-deploy"
priority: High
version: 0.1.1
created: 2026-05-05
updated: 2026-05-05
author: manager-spec
issue_number: 98
depends_on:
  - SPEC-REGULA-LAUNCH-001
  - SPEC-REGULA-RELEASE-001
  - SPEC-REGULA-CICD-001
related_specs:
  - SPEC-REGULA-RELEASE-GATE-001
  - SPEC-REGULA-RELEASE-HARDENING-001
  - SPEC-REGULA-CLOUDFLARE-001
  - SPEC-REGULA-E2EFIX-001
related_issues: []
closes_issues: []
labels:
  - release
  - deploy
  - high-priority
revision_history:
  - version: 0.1.0
    date: 2026-05-05
    author: manager-spec (release-gap remediation)
    notes: |
      Initial draft. 1차 RC 갭 리포트(2026-05-05) §2.2 후속.
      CICD-001 (CI-only)와 CLOUDFLARE-001 (Phase 7 cf-deploy.yml) 사이의 1차 RC 시점 deploy 자동화 부재 갭 해소.
      `.github/workflows/deploy.yml` 신규 도입 — Vercel preview-per-PR + Cloudflare staging
      + production manual gate + post-deploy smoke 자동화. 11 REQ across 4 groups.
      CLOUDFLARE-001 REQ-CF-010 cf-deploy.yml과 file 충돌 회피 (다른 파일명).
  - version: 0.1.1
    date: 2026-05-05
    author: manager-spec
    notes: |
      plan-auditor High [H1~H5] 정정 — environment 자원 분리, staging-only EARS 명시,
      grep 게이트 명시 7-spec 나열, helper 적용 범위 명확화, REQ-DEPLOY-006 EARS 패턴 ED로 정정.
      [H1] REQ-DEPLOY-007/008/009: Environment 이름 `production` → `production-vercel` (CLOUDFLARE-001과 자원 분리).
      [H2] REQ-DEPLOY-001a 신규 추가 — cloudflare-staging job의 staging-only EARS 단언.
      [H5] REQ-DEPLOY-006 EARS 패턴 (WHILE) → (ED) 정정.
      §6 Dependencies에 production-vercel/production-cloudflare Environment 분리 명시.
---

# SPEC-REGULA-DEPLOY-001 — Regula 1차 RC 배포 자동화

## 1. 목적 (Purpose)

Regula 1차 릴리즈 v1.0.0-rc 배포 시점에 다음 결함이 존재한다:

| ID | 결함 | 영향 | 출처 |
| --- | --- | --- | --- |
| D-1 | `.github/workflows/deploy.yml` 부재 | 배포가 수동 `vercel deploy` 호출에 의존, 회귀 시 rollback 자동화 부재 | 직접 검증 (`.github/workflows/` ls 결과) |
| D-2 | Preview environment per-PR 자동 provisioning 부재 | 코드 리뷰가 정적 코드 review만 가능, 동작 검증 미실시 | 직접 검증 (vercel.json은 정적 정의만) |
| D-3 | Production manual approval gate 미설정 | LAUNCH REQ-LAUNCH-041가 명시되어 있으나 실제 GitHub Environments + reviewers 룰 미적용 | LAUNCH-001 documentation only |
| D-4 | Post-deploy smoke 자동 실행 없음 | `scripts/post-deploy-smoke.sh` 존재하나 deploy 후 자동 호출 안 됨 | 직접 검증 |

본 SPEC은 **1차 RC 시점에 필요한 최소 deploy 자동화**만 다룬다. Phase 7 Cloudflare 전면 통합 (`SPEC-REGULA-CLOUDFLARE-001`)과는 다음과 같이 분리된다:

- **본 SPEC**: 1차 RC용 `.github/workflows/deploy.yml` (Vercel primary + Cloudflare staging만)
- **CLOUDFLARE-001**: Phase 7 `.github/workflows/cf-deploy.yml` (Cloudflare production canary)
- **파일명 분리로 충돌 0건**

본 SPEC은 신규 비즈니스 기능을 추가하지 않는다.

### 1.1 비범위 (Out of Scope)

- **Cloudflare production deploy** — CLOUDFLARE-001 cf-deploy.yml (Phase 7) 단독 ownership
- **Workers AI / Vectorize / R2 production 활성화** — Phase 7 범위
- **Multi-region failover** — Post-launch
- **DB migration auto-apply on deploy** — 수동 `pnpm drizzle-kit push` 유지 (안전성)
- **Rollback 자동 트리거 (자동 회귀 감지)** — runbook.md 수동 절차 유지 (LAUNCH REQ-LAUNCH-042 계승)
- **신규 비즈니스 기능, 신규 API endpoint**

---

## 2. 범위 (Scope)

### In Scope

- `.github/workflows/deploy.yml` 신규 작성
  - **Job 1 — Vercel preview**: `pull_request` 트리거, PR마다 preview URL 발급, PR comment에 URL 자동 게시
  - **Job 2 — Cloudflare staging**: `push` to `main` 트리거, OpenNext.js build → `wrangler deploy --env staging` (Phase 7 production 진입 전 임시 staging 환경)
  - **Job 3 — Vercel production**: `release/v*` tag 트리거, GitHub Environments `production-vercel` manual approval 후 배포 (CLOUDFLARE-001 Phase 7의 `production-cloudflare`와 자원 분리)
  - **Job 4 — Post-deploy smoke**: 위 3개 job 직후 자동 호출, `scripts/post-deploy-smoke.sh` 실행, 실패 시 PR/release comment에 보고
- GitHub Environments `preview` / `staging` / `production-vercel` 3종 정의 — `production-vercel`만 manual approval 활성. `production-cloudflare`는 Phase 7 CLOUDFLARE-001 ownership.
- `scripts/post-deploy-smoke.sh` 호출 인터페이스 표준화 (기존 LAUNCH REQ-LAUNCH-043 계승, 본 SPEC은 자동 호출 트리거만 추가)
- Vercel `Vercel Action` (`vercel/action@v3`) 또는 `amondnet/vercel-action` 사용
- Cloudflare `wrangler-action` (`cloudflare/wrangler-action@v3`) 사용
- Secrets 관리 — `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` GitHub Secrets에 등록

### Out of Scope

- Cloudflare production deploy (cf-deploy.yml, CLOUDFLARE-001 ownership)
- Multi-region routing, EU residency activation (CLOUDFLARE-001 Group H)
- DB migration auto-apply on deploy (운영 수동)
- Rollback 자동화 트리거 (LAUNCH REQ-LAUNCH-042 수동 절차 계승)
- Pen-test 자동 실행 (LAUNCH-001 OOS)

---

## 3. EARS 요구사항

EARS 패턴 라벨: U=Ubiquitous, ED=Event-Driven, SD=State-Driven, O=Optional, UB=Unwanted.

### Group A — deploy.yml 워크플로우 정의 (REQ-DEPLOY-001 ~ 003)

#### REQ-DEPLOY-001 (U) — deploy.yml 파일 존재

The system **shall** provide `.github/workflows/deploy.yml` with **at least three named jobs**: `vercel-preview` (triggered on `pull_request`), `cloudflare-staging` (triggered on `push` to `main`), `vercel-production` (triggered on `release` event with `release/v*` tag).

Acceptance:
- 파일 존재 + YAML parse OK
- 3 job names 모두 존재
- 트리거 정의 정확

#### REQ-DEPLOY-001a (ED) — cloudflare-staging job staging-only 단언

**WHEN** the `cloudflare-staging` job executes, **THE** workflow **shall** invoke `pnpm wrangler deploy --env staging` (and only that wrangler deploy variant) **AND shall not** execute any other `wrangler deploy` command (e.g., `--env production`, no-env default, `--env preview`). 본 단언은 REQ-DEPLOY-002 grep 검증과 짝을 이룬다 — REQ-DEPLOY-002가 negative grep(`--env production` 0 매치)을 검증하고, 본 REQ-DEPLOY-001a가 positive 단언(`--env staging`만 호출)을 추가한다.

Acceptance:
- `cloudflare-staging` job step에서 `pnpm wrangler deploy --env staging` 명령 1회 호출
- 동일 job 또는 다른 job에서 `wrangler deploy` 명령이 `--env staging` 외 인자로 호출되지 않음 (`grep -nE "wrangler deploy" .github/workflows/deploy.yml` 결과가 모두 `--env staging`만 포함)
- REQ-DEPLOY-002 negative grep과 짝을 이룸

#### REQ-DEPLOY-002 (UB) — cf-deploy.yml과 분리

The `deploy.yml` **shall not** include any `wrangler deploy --env production` command. Production Cloudflare deploys are owned by `SPEC-REGULA-CLOUDFLARE-001` REQ-CF-010 in `cf-deploy.yml` (Phase 7).

Acceptance:
- `grep "wrangler deploy --env production" .github/workflows/deploy.yml` 결과 0
- staging 한정 (`--env staging`)만 허용

#### REQ-DEPLOY-003 (U) — Required Secrets 명시

The `deploy.yml` **shall** declare all required secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) in its `env` blocks via `${{ secrets.* }}` references; missing secret **shall** cause CI fail with clear error message identifying which secret is missing.

Acceptance:
- `.github/workflows/deploy.yml` 내 `${{ secrets.VERCEL_TOKEN }}` 등 5개 secret 참조 존재
- 의도적 secret 미등록 상태에서 PR 트리거 시 명확한 error 메시지 출력

### Group B — Preview Environment per PR (REQ-DEPLOY-004 ~ 006)

#### REQ-DEPLOY-004 (ED) — PR 단위 Vercel preview 자동 배포

**WHEN** a pull request is opened or updated against `main`, **THE** `vercel-preview` job **shall** (a) build the Next.js project with `pnpm build`, (b) deploy to Vercel preview environment via `vercel deploy --prebuilt --token=$VERCEL_TOKEN`, (c) capture the preview URL output, (d) post a comment on the PR with the preview URL prefixed `Preview deployed:`.

Acceptance:
- PR open/update 시 GitHub Actions deploy.yml `vercel-preview` job 실행
- Vercel preview URL이 PR comment에 게시됨
- preview URL이 `https://*.vercel.app` 패턴

#### REQ-DEPLOY-005 (UB) — Preview에 production secrets 주입 금지

The `vercel-preview` job **shall not** inject production-scoped Vercel environment variables. Preview environment **shall** use Vercel's `preview` environment scope only; **IF** a production-only secret (e.g., `ANTHROPIC_API_KEY` matching production key prefix) is detected in preview env, **THEN** Vercel deployment **shall** fail.

Acceptance:
- Vercel project settings에서 환경 분리 검증
- preview env에 production secret 미주입 확인 (`vercel env ls preview`)

#### REQ-DEPLOY-006 (ED) — Preview cleanup 정책

**WHEN** a pull request is closed (merged or rejected), **THE** `deploy.yml` workflow **shall** rely on Vercel's native auto-cleanup mechanism to mark the preview deployment as inactive within 24 hours **AND shall not** add a custom cleanup workflow or step. 본 REQ는 정책을 기록하며 추가 cleanup 로직을 도입하지 않는다.

Acceptance:
- Vercel project 설정에서 preview retention 정책 확인
- PR close 24h 후 Vercel dashboard에서 inactive 표시

### Group C — Production Manual Gate (REQ-DEPLOY-007 ~ 009)

#### REQ-DEPLOY-007 (U) — GitHub Environments `production-vercel` 정의

The repository **shall** define a GitHub Environment named `production-vercel` with the following protection rules: (a) `Required reviewers` ≥ 1 from the set {QA lead, Compliance lead, Product owner} (LAUNCH REQ-LAUNCH-041 계승), (b) `Wait timer` ≥ 0 minutes, (c) `Deployment branches` = `release/v*` 태그 한정.

Note (Environment 자원 분리): 본 SPEC은 `production-vercel` Environment를 단독 소유한다. CLOUDFLARE-001 Phase 7 진입 시 Cloudflare 측은 별도의 `production-cloudflare` Environment를 정의하며, 1차 RC 시점에는 본 SPEC이 `production-vercel` 단독 소유로 자원 충돌 0건이다.

Acceptance:
- GitHub repo Settings → Environments → production-vercel 페이지 스크린샷
- Required reviewers list ≥ 1 명시 확인
- Deployment branches 제한 확인

#### REQ-DEPLOY-008 (ED) — Release tag 시 production deploy 트리거

**WHEN** a Git tag matching `release/v*` (e.g., `release/v1.0.0-rc`) is pushed, **THE** `vercel-production` job **shall** start AND wait for manual approval from `production-vercel` environment reviewers before executing `vercel deploy --prod --prebuilt --token=$VERCEL_TOKEN`.

Acceptance:
- `release/v1.0.0-rc` 태그 push 시 GitHub Actions에서 `vercel-production` job pending 상태 진입
- 승인 reviewer가 approve 시 deploy 실행, reject 시 abort
- approve 없이 24h 경과 시 timeout (정책 documented)

#### REQ-DEPLOY-009 (UB) — Manual approval 우회 금지

The `vercel-production` job **shall not** be triggerable without `production-vercel` environment approval. **IF** a workflow_dispatch or branch-direct push attempts to bypass tag + approval, **THEN** the job **shall** fail with `"Production deployment requires release/v* tag and environment approval"`.

Acceptance:
- 의도적 workflow_dispatch 시도 → fail
- 의도적 branch direct push (release tag 없이) → fail
- 에러 메시지 정확

### Group D — Post-deploy Smoke 자동 호출 (REQ-DEPLOY-010 ~ 011)

#### REQ-DEPLOY-010 (ED) — 모든 deploy 후 smoke 자동 실행

**WHEN** any of the three deploy jobs (`vercel-preview`, `cloudflare-staging`, `vercel-production`) completes successfully, **THE** `post-deploy-smoke` job **shall** execute automatically with the deployed URL injected as `BASE_URL` env, running `scripts/post-deploy-smoke.sh` (LAUNCH REQ-LAUNCH-043 계승). Smoke 실패 시 deploy 자체는 유지되나 PR/commit/release에 failure status 게시.

Acceptance:
- 3 deploy job 각각의 `needs:` 또는 `on.workflow_run`로 smoke job 연결
- preview deploy 후 PR comment에 smoke 결과 게시 (`Smoke check: passed/failed`)
- production deploy 후 release notes에 smoke 결과 추가

#### REQ-DEPLOY-011 (UB) — Smoke 실패 시 production deploy auto-rollback 금지

The post-deploy smoke failure **shall not** trigger automatic Vercel rollback. Rollback is owner-driven via `runbook.md` (LAUNCH REQ-LAUNCH-042). **IF** smoke fails for production, **THEN** the system **shall** (a) annotate the deployment as `unhealthy` in Vercel, (b) post a P1 alert to Sentry / Slack (별도 채널 구성), (c) NOT execute `vercel rollback`.

Acceptance:
- Smoke 실패 시 deployment 상태 unhealthy로 라벨 (Vercel API 호출)
- `vercel rollback` 명령 호출 0건 확인
- Sentry P1 alert 또는 Slack 메시지 자동 게시 확인 (실제 채널 설정은 운영 수동)

---

## 4. Acceptance Criteria

상세 Given-When-Then 시나리오는 `acceptance.md` 참고. 핵심 게이트:

- `.github/workflows/deploy.yml` 존재 + 3 job + smoke job + 5 secret 참조
- PR open 시 Vercel preview URL이 PR comment에 24시간 이내 게시
- `release/v*` tag push → production manual approval pending → approve 후 deploy 성공 + smoke 자동 실행
- Smoke 실패 시 auto-rollback 0건, unhealthy 라벨 + alert 게시
- `wrangler deploy --env production` command가 deploy.yml에 등장하지 않음 (CLOUDFLARE-001 ownership 분리)

---

## 5. Exclusions (What NOT to Build)

본 SPEC이 **명시적으로 다루지 않는** 항목:

1. **Cloudflare production deploy** — CLOUDFLARE-001 REQ-CF-010 cf-deploy.yml 단독 ownership. 본 SPEC은 staging 한정.
2. **Auto-rollback on smoke fail** — REQ-DEPLOY-011 명시적 금지. runbook.md 수동 절차 유지.
3. **DB migration 자동 적용** — `pnpm drizzle-kit push --strict` 수동 호출 유지.
4. **Multi-region routing** — Phase 7 CLOUDFLARE-001 Group H ownership.
5. **Pen-test 자동 실행** — LAUNCH-001 OOS 계승.
6. **Slack/Teams 채널 구성 자체** — 운영팀 수동 작업 (REQ-DEPLOY-011은 호출 인터페이스만 정의).
7. **Vercel project 신규 생성 또는 도메인 등록** — 사전 운영 작업 (전제조건).
8. **Cloudflare staging environment 신규 provisioning** — `wrangler.toml` `[env.staging]` 블록 활용 (CLOUDFLARE-001 REQ-CF-003 계승).
9. **신규 비즈니스 기능, 신규 API endpoint** — 본 SPEC은 배포 자동화만.

---

## 6. Dependencies and Sequencing

- **Hard dependency**:
  - SPEC-REGULA-LAUNCH-001 (completed) — REQ-LAUNCH-037 vercel.json + REQ-LAUNCH-041 production gate 정책 + REQ-LAUNCH-042 rollback runbook + REQ-LAUNCH-043 post-deploy smoke 정의
  - SPEC-REGULA-CICD-001 — `.github/workflows/ci.yml` 안정 동작 (deploy 전 CI green 전제)
  - SPEC-REGULA-RELEASE-001 — 1차 RC scope 명시
- **Soft dependency**:
  - SPEC-REGULA-RELEASE-GATE-001 — branch 정합성 보장 (PR merge → main → staging deploy 정상 흐름)
  - SPEC-REGULA-RELEASE-HARDENING-001 — production 경로 placeholder 제거 (deploy 성공 전제)
  - SPEC-REGULA-E2EFIX-001 — preview deploy 후 E2E green이 deploy 검증 데이터 (선택적)
- **Coupled completion**: 본 SPEC 완료 시 RELEASE-001 REQ-REL-060 release handoff 충족 가능
- **No conflict**:
  - 본 SPEC: `.github/workflows/deploy.yml` 단독 소유
  - CLOUDFLARE-001: `.github/workflows/cf-deploy.yml` 단독 소유 (Phase 7)
  - CICD-001: `.github/workflows/ci.yml` 단독 소유
- **GitHub Environment 자원 분리** (REQ-DEPLOY-007 정정):
  - 본 SPEC: `production-vercel` Environment 단독 소유 (1차 RC)
  - CLOUDFLARE-001 Phase 7: `production-cloudflare` Environment 별도 정의 (Phase 7 진입 시)
  - 1차 RC 시점에는 `production-vercel`만 존재 → 자원 충돌 0건
  - `production` (suffix 없음) Environment 이름은 본 release-deploy 단계에서 사용하지 않음 (예약 이름)

---

## 7. Risk Notes

- **Vercel token 누출 위험**: GitHub Secrets에만 저장, `secrets.VERCEL_TOKEN` 명시적 참조. workflow_dispatch에서 fork PR로부터 secret 접근 차단 (`pull_request_target` 미사용).
- **Cloudflare staging environment 미존재 위험**: `wrangler.toml` `[env.staging]` 블록이 없으면 `cloudflare-staging` job fail. 본 SPEC RUN 진입 전 검증 (수동 운영 작업).
- **Production approval reviewer 부재**: GitHub Environments에서 reviewer 미설정 시 자동 통과 가능. REQ-DEPLOY-007에서 명시적 검증 필요.
- **Smoke 실패 false positive**: 의존 외부 서비스 (Anthropic, Sentry) 일시 outage 시 smoke fail 가능. RELEASE-001 REQ-REL-020 bounded build 정책 적용 (재시도 1회 허용).
- **`release/v*` tag 작명 표준**: `release/v1.0.0-rc`, `release/v1.0.0`, `release/v1.1.0` 등. 표준 외 tag (예: `v1.0.0`) push 시 production deploy 미발화 — 의도적 동작.
- **Vercel preview URL 누출**: 인증 미설정 preview는 공개 URL. `vercel.json` 또는 Vercel project settings에서 password protection 또는 Vercel Authentication 설정 권고 (운영 수동 작업, 본 SPEC out of scope).

---

## 8. References

### 8.1 GitHub Artifacts

- (이슈 자동 생성 금지 — 사용자 검토 후 직접 생성 예정)

### 8.2 관련 SPEC

- SPEC-REGULA-LAUNCH-001 (completed) — REQ-LAUNCH-037, 041, 042, 043 계승
- SPEC-REGULA-RELEASE-001 (umbrella, REQ-REL-060)
- SPEC-REGULA-CICD-001 (CI 안정 동작)
- SPEC-REGULA-CLOUDFLARE-001 (Phase 7, file ownership 분리)
- SPEC-REGULA-RELEASE-GATE-001 (branch 정합성)
- SPEC-REGULA-RELEASE-HARDENING-001 (placeholder 제거)
- SPEC-REGULA-E2EFIX-001 (E2E green 데이터, 선택적)

### 8.3 코드 진입점

- `.github/workflows/deploy.yml` (신규, Group A/B/C/D)
- `vercel.json` (참조, LAUNCH REQ-LAUNCH-037)
- `wrangler.toml` (참조, `[env.staging]` 블록)
- `scripts/post-deploy-smoke.sh` (참조, LAUNCH REQ-LAUNCH-043)
- `docs/runbook.md` (참조, rollback 절차 LAUNCH REQ-LAUNCH-042)

### 8.4 연구 / 추적 문서

- `plan.md` (본 디렉토리)
- `acceptance.md` (본 디렉토리)
- `.moai/plans/review-gaps-2026-05-05.md` §2.2

### 8.5 QA 단계 게이트 정의

QA 단계 게이트(0~5) 정의는 `.moai/specs/_shared/qa-gate-roadmap.md`를 참조하라.

---

REQ coverage 요약:
- Group A (deploy.yml 정의): 3 REQ
- Group B (Preview per PR): 3 REQ
- Group C (Production manual gate): 3 REQ
- Group D (Post-deploy smoke 자동 호출): 2 REQ

**Total: 11 EARS requirements**
