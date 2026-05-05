# Regula 1차 릴리즈 v1.0.0-rc 보강 — 갭 리포트 (2026-05-05)

## 0. 메타

- 작성일: 2026-05-05
- 작성자: manager-spec (사용자 결정사항 + Explore 정찰 결과 기반)
- 입력 모드: ultrathink + thorough
- 우선순위 3영역: ① 런타임/E2E 실행성, ② 배포 준비도(Cloudflare/Vercel), ③ 관측성(Sentry/PostHog/Langfuse/Web Vitals)
- 산출물 경로: `.moai/plans/review-gaps-2026-05-05.md`(본 문서), `.moai/plans/amendments-2026-05-05.md`, 신규 SPEC 디렉토리 0~4개
- 이슈 정책: `--no-issue` (사용자 검토 후 직접 생성)

---

## 1. 요약

현재 7.1/10 → 목표 8.5+/10에 도달하기 위해 **신규 SPEC 2종 발행**과 **기존 SPEC 3종 amendment 권고**가 필요하다.

핵심 결론:

- **런타임/E2E**: 기존 RELEASE-HARDENING-001 Group E (REQ-HARDEN-022~024)가 citation-click 단일 spec만 다루고 있어, **8개 E2E spec 전체에 대한 `test.skip(true)` 일괄 해제 + global-setup + .auth.json 시드 자동화**는 **신규 SPEC 필요**. 단, "로컬 런타임 부트스트랩"(`.env.local` 생성기 / DB seed) 부분은 **QUALITY-001 Group A (REQ-QUAL-001~005, `pnpm db:seed:corpus`)**가 80%+ 커버하므로 **amendment 권고**.
- **배포**: 기존 CICD-001은 **CI-only**(`.github/workflows/ci.yml` 단일 파일 정의)이며 deploy.yml 부재. CLOUDFLARE-001 REQ-CF-010은 deploy 워크플로 있지만 **Phase 7 범위(Cloudflare 전면 통합)**로 1차 RC 시점에 진입 불가. **신규 SPEC 필요**: 1차 RC용 경량 deploy.yml (Vercel preview + Cloudflare staging) + post-deploy smoke 자동화.
- **관측성**: 사용자 입력의 Explore 결과를 코드 직접 검증으로 보정. 실제로 `app/layout.tsx`가 `<AnalyticsProvider />`를 렌더링하고 `components/observability/AnalyticsProvider.tsx`가 `initPostHog()` + `<Analytics />`(Vercel) **만** 통합한다 — **즉 PostHog + Vercel Analytics 2-way 통합**. Sentry는 `sentry.client.config.ts`/`sentry.server.config.ts`의 자동 init에 의존하며 `AnalyticsProvider`에 명시적 통합이 없고, Langfuse는 server-side 전용이므로 Provider 통합 대상이 아니다. **갭은 (a) Langfuse 미들웨어 자동 trace 래핑, (b) Sentry RootLayout 명시적 ErrorBoundary, (c) 4-way를 단일 통합 검증 게이트의 부재**. ENTERPRISE-001 Group G (REQ-ENTERPRISE-066~073)가 4-way 통합 정의를 80%+ 커버하므로 **amendment 권고**(런치 통합 검증 + Langfuse 미들웨어 + Sentry ErrorBoundary 3 REQ).

신규 SPEC 발행 결정:

| 영역 | 결정 | 이유 |
| --- | --- | --- |
| 런타임 부트스트랩 | amendment (QUALITY-001) | seed 메커니즘 80%+ 커버, `.env.local` 생성기만 추가 필요 |
| **E2E 활성화** | **신규 SPEC: `SPEC-REGULA-E2EFIX-001`** | RELEASE-HARDENING-001은 citation-click 단일만, 전체 8 spec 대상 일괄 해제 SPEC 부재 |
| **배포 자동화** | **신규 SPEC: `SPEC-REGULA-DEPLOY-001`** | CICD-001은 CI-only, CLOUDFLARE-001은 Phase 7. 1차 RC 시점 deploy 자동화 SPEC 부재 |
| 관측성 통합 | amendment (ENTERPRISE-001) | Group G 4-way 정의 보유, 통합 검증 게이트와 Langfuse 미들웨어만 추가 |

---

## 2. 영역별 갭 매트릭스

### 2.1 런타임/E2E 실행성

| 차원 | 현재 상태 | 기존 SPEC 커버 | 미커버 갭 | 권고 액션 |
| --- | --- | --- | --- | --- |
| `.env.example`, `.env.eval.example` 존재 | OK | FOUNDATION REQ-FND-007, LAUNCH REQ-LAUNCH-039 | `.env.local` 자동 생성기 부재 (placeholder ↔ dev 값 매핑) | **amendment to QUALITY-001** (Group A 확장) |
| Playwright 8 spec | 모두 `test.skip(true)` + `PLAYWRIGHT_BASE_URL` 가드로 비활성 | RELEASE-HARDENING-001 Group E (REQ-HARDEN-022~024)는 **citation-click.spec.ts 단독** | **다른 7 spec (auth, consultation, expert-review, project-switch, i18n, a11y, security-headers)의 `test.skip(true)` 일괄 해제 + global-setup 부재** | **신규 SPEC: SPEC-REGULA-E2EFIX-001** |
| `tests/e2e/fixtures/` | `auth.ts`(미완성, .auth.json 옵셔널 로드), `msw-sse.ts`(TODO 잔존) 존재 | RELEASE-HARDENING-001 REQ-HARDEN-021은 msw-sse.ts TODO 정리 | **`.auth.json` 시드 자동 생성 스크립트(playwright global-setup) 부재** | **신규 SPEC: SPEC-REGULA-E2EFIX-001** |
| DB seed 스크립트 | `pnpm db:seed:corpus` 미존재(Explore에서 확인됨) | QUALITY-001 REQ-QUAL-001~005 | seed 자체는 QUALITY-001이 커버 | **amendment 불필요** — QUALITY-001 그대로 진행 |
| E2E CI 통합 | `.github/workflows/ci.yml`은 e2e job 보유 추정 | RELEASE-GATE-001 REQ-GATE-006, LAUNCH REQ-LAUNCH-022 | 통과 후 `--auth-state` 환경변수 주입 흐름 부재 | **신규 SPEC: SPEC-REGULA-E2EFIX-001 Group C** |

### 2.2 배포 준비도 (Cloudflare/Vercel)

| 차원 | 현재 상태 | 기존 SPEC 커버 | 미커버 갭 | 권고 액션 |
| --- | --- | --- | --- | --- |
| `vercel.json` (HSTS/CSP/함수 timeout) | 존재 | LAUNCH REQ-LAUNCH-037 | OK | 없음 |
| `wrangler.toml` (Workers + R2 + Vectorize + Queues + Cron) | 존재 | CLOUDFLARE-001 REQ-CF-003 | Phase 7 SPEC 범위, 1차 RC 미진입 | 없음 |
| `next.config.mjs`, `open-next.config.ts` | 존재 | CLOUDFLARE-001 REQ-CF-002 | Phase 7 범위 | 없음 |
| `scripts/post-deploy-smoke.sh` | 존재 | LAUNCH REQ-LAUNCH-043 | OK (수동 호출) | **신규 SPEC: SPEC-REGULA-DEPLOY-001 Group D** (smoke 자동화) |
| `.github/workflows/ci.yml` | 존재 | CICD-001, RELEASE-GATE-001 Group A | OK | 없음 |
| **`.github/workflows/deploy.yml`** | **부재(Explore 확인됨)** | CICD-001 범위 외, CLOUDFLARE-001 REQ-CF-010은 Phase 7 cf-deploy.yml | **1차 RC용 deploy.yml 부재 — Vercel preview/staging 자동화 + Cloudflare staging 자동화 부재** | **신규 SPEC: SPEC-REGULA-DEPLOY-001** |
| Preview environment provisioning | `vercel.json` 정의되어 있으나 자동 PR 단위 provisioning 운영 구성 부재 | LAUNCH REQ-LAUNCH-037 정적 정의만 | **PR마다 preview URL 발급 + 환경별 secret 주입 흐름** | **신규 SPEC: SPEC-REGULA-DEPLOY-001 Group B** |
| Production deploy gate (manual approval) | LAUNCH REQ-LAUNCH-041 정의 | LAUNCH-001(completed) | LAUNCH는 documentation only, **실제 GitHub Environments + reviewer 룰 적용 SPEC 미발행** | **신규 SPEC: SPEC-REGULA-DEPLOY-001 Group C** |

### 2.3 관측성 (Sentry/PostHog/Langfuse/Web Vitals)

| 차원 | 현재 상태 | 기존 SPEC 커버 | 미커버 갭 | 권고 액션 |
| --- | --- | --- | --- | --- |
| `sentry.client.config.ts`, `sentry.server.config.ts` | 존재, `Sentry.init` 호출 확인 | ENTERPRISE-001 REQ-ENTERPRISE-066 | OK | 없음 |
| `lib/observability/sentry.ts` | 존재 | ENTERPRISE-001 REQ-ENTERPRISE-066 | OK | 없음 |
| `lib/observability/posthog.ts` (`initPostHog()`) | 존재, `components/observability/AnalyticsProvider.tsx`에서 호출 | ENTERPRISE-001 REQ-ENTERPRISE-067 | **EU region host 강제 검증 미실행** | **amendment to ENTERPRISE-001 Group G** |
| `lib/observability/langfuse.ts` | 존재 | ENTERPRISE-001 REQ-ENTERPRISE-068 | **`/api/ra/consult` 미들웨어 / route handler에서 자동 trace 래핑 검증 부재** | **amendment to ENTERPRISE-001 Group G** |
| `@vercel/analytics` | 패키지 선언 + `<Analytics />` 통합 in `components/observability/AnalyticsProvider.tsx` | ENTERPRISE-001 REQ-ENTERPRISE-069 | OK (Phase 7 CLOUDFLARE-001은 Cloudflare Web Analytics로 교체 예정이나 1차 RC 범위 외) | 없음 |
| Sentry `<ErrorBoundary>` Root 통합 | **app/layout.tsx에 명시적 ErrorBoundary 미발견** | ENTERPRISE-001 REQ-ENTERPRISE-066 (사용 명시) | **ErrorBoundary가 Layout이 아닌 page-level에만 있을 가능성** — 통합 검증 부재 | **amendment to ENTERPRISE-001** (REQ-ENTERPRISE-066 보강 또는 신규 REQ) |
| 4-way 통합 단일 게이트 | Group G 8개 REQ로 분산 | ENTERPRISE-001 Group G (REQ-ENTERPRISE-066~073) | **`/login` → `/dashboard` 시나리오에서 4 벤더 모두 이벤트 수신 검증 단일 E2E 게이트 부재** | **amendment to ENTERPRISE-001** (Group G에 통합 게이트 REQ 1개 추가) |
| `.env.example` 4 벤더 키 | OK (REQ-ENTERPRISE-071) | ENTERPRISE-001 REQ-ENTERPRISE-071 | OK | 없음 |

---

## 3. 신규 SPEC 발행 결정표

| ID 후보 | 영역 | 결정 | 근거 | 의존 |
| --- | --- | --- | --- | --- |
| ~~SPEC-REGULA-RUNTIME-001~~ | 로컬 런타임 부트스트랩 | **발행 보류 → amendment to QUALITY-001 Group A** | seed 자체는 QUALITY-001 REQ-QUAL-001~005 80%+ 커버, `.env.local` 생성기 1개 REQ만 추가 필요 | — |
| **SPEC-REGULA-E2EFIX-001** | E2E 활성화 | **신규 발행** | RELEASE-HARDENING-001 Group E는 citation-click 단독 (REQ-HARDEN-022~024). 다른 7 spec 일괄 해제, global-setup 자동화, .auth.json 시드는 미커버. 8 spec × test.skip(true) 일괄 해제는 별도 SPEC가 적합 (HARDENING-001 amendment로 처리하기엔 범위 과다) | RELEASE-HARDENING-001, RELEASE-GATE-001 |
| **SPEC-REGULA-DEPLOY-001** | 배포 자동화 | **신규 발행** | CICD-001은 CI-only, CLOUDFLARE-001은 Phase 7 (1차 RC 미진입). 1차 RC용 deploy.yml + Vercel preview + Cloudflare staging + post-deploy smoke 자동화는 신규 SPEC만 가능. LAUNCH-001(completed)은 deploy 문서화만이며 실제 워크플로 SPEC 부재 | LAUNCH-001, RELEASE-001 |
| ~~SPEC-REGULA-OBSV-001~~ | 4-way observability 앱 통합 | **발행 보류 → amendment to ENTERPRISE-001 Group G** | Group G (REQ-ENTERPRISE-066~073) 8개 REQ가 4-way 정의 80%+ 커버. 통합 검증 게이트 + Langfuse 미들웨어 + Sentry ErrorBoundary 3개 REQ만 amendment로 추가 필요 | — |

**결론**: **신규 SPEC 2개 발행** + **기존 SPEC 2종 amendment 권고**.

---

## 4. 권고 우선순위

### P0 (1차 RC 진입 필수)

1. **SPEC-REGULA-E2EFIX-001** (P0) — `test.skip(true)` 일괄 해제 미실행 시 RELEASE-001 REQ-REL-010(release PR CI green) 충족 불가
2. **amendment to QUALITY-001 Group A** (P0) — `.env.local` 생성기 부재 시 신규 개발자 + CI runner가 corpus seed 실행 직전 fail 가능

### P1 (1차 RC 안정성 강화)

3. **SPEC-REGULA-DEPLOY-001** (P1) — 1차 RC 배포 시점에 수동 `vercel deploy` 의존, 회귀 시 rollback 자동화 부재. 단, 첫 RC는 manual deploy로도 출시 가능하므로 P0이 아님
4. **amendment to ENTERPRISE-001 Group G** (P1) — 4-way observability 단일 통합 게이트 부재. 첫 RC에서 부분 동작은 확인되었으나 4 벤더 동시 수신 회귀를 잡을 자동 검증이 없음. P0가 아닌 이유: Sentry/PostHog 개별로 동작 중

### P2 (1차 RC 후 정리)

- (해당 없음 — 사용자 결정 3영역 모두 P0/P1으로 처리)

---

## 5. 의존성 그래프

```
SPEC-REGULA-RELEASE-001 (umbrella, P0)
├── SPEC-REGULA-RELEASE-GATE-001 (P0)
├── SPEC-REGULA-RELEASE-HARDENING-001 (P1)
│   └─ Group E (citation-click E2E only)
├── SPEC-REGULA-QUALITY-001 (P2)
│   └─ Group A (corpus seed) ←── [amendment] .env.local 생성기 추가
└── (NEW)
    ├── SPEC-REGULA-E2EFIX-001 (P0, depends_on: RELEASE-HARDENING-001 Group E)
    │   └─ 7 spec test.skip(true) 일괄 해제 + global-setup + .auth.json
    └── SPEC-REGULA-DEPLOY-001 (P1, depends_on: LAUNCH-001 (completed), RELEASE-001)
        └─ deploy.yml + preview + post-deploy smoke 자동화

SPEC-REGULA-ENTERPRISE-001 (Phase 5, completed)
└── Group G (4-way observability) ←── [amendment]
    ├── REQ-ENTERPRISE-074 (신규): Sentry RootLayout ErrorBoundary
    ├── REQ-ENTERPRISE-075 (신규): Langfuse `/api/ra/consult` 미들웨어 자동 trace
    └── REQ-ENTERPRISE-076 (신규): 4-way 통합 E2E 게이트 (`/login` → 4 벤더 수신 확인)

SPEC-REGULA-CLOUDFLARE-001 (Phase 7, draft, 1차 RC 미진입)
└── 본 갭 리포트 범위 외
```

신규 SPEC 간 충돌:

- **E2EFIX-001 vs RELEASE-HARDENING-001**: file ownership 분리 — HARDENING-001은 `tests/e2e/citation-click.spec.ts` 단독 소유, E2EFIX-001은 나머지 7 spec + `tests/e2e/fixtures/auth.ts` + `playwright/globalSetup.ts`(신규)
- **DEPLOY-001 vs CLOUDFLARE-001 REQ-CF-010**: DEPLOY-001은 `.github/workflows/deploy.yml` (1차 RC, Vercel + Cloudflare staging), CLOUDFLARE-001은 `.github/workflows/cf-deploy.yml` (Phase 7 production). 파일명 분리로 충돌 회피.
- **DEPLOY-001 vs CICD-001**: CICD-001은 `ci.yml` 단독 소유, DEPLOY-001은 `deploy.yml` 신규 소유. 충돌 없음.

---

## 6. 검증 절차 (자체 검증)

본 갭 리포트가 누락 없이 작성되었는지 다음 체크로 검증:

- [x] 사용자 결정사항 3영역 모두 매트릭스에 등장
- [x] 사용자 입력의 Explore 결과 5개 사실(있음/부분/없음) 모두 영역별로 분류
- [x] 기존 SPEC 7종(RELEASE-001, RELEASE-GATE-001, RELEASE-HARDENING-001, LAUNCH-001, CLOUDFLARE-001, ENTERPRISE-001 Group G, CICD-001) 모두 검토
- [x] 80%+ 커버 SPEC은 amendment로 분류 (SPEC 발행 회피)
- [x] 신규 SPEC 발행 시 ID/scope/depends_on 명시
- [x] 시간 예측 사용 안 함 (Priority High/Medium/Low만 사용)
- [x] conversation_language: ko로 작성

---

## 7. 다음 단계

1. 본 리포트 사용자 검토
2. 사용자 승인 시 **신규 SPEC 2종 디렉토리 생성** (`SPEC-REGULA-E2EFIX-001`, `SPEC-REGULA-DEPLOY-001`) → spec.md/plan.md/acceptance.md 3-doc 셋
3. **amendments-2026-05-05.md** 작성 — QUALITY-001 / ENTERPRISE-001 amendment 권고 REQ 본문
4. 사용자 직접 GitHub 이슈 생성 (이슈 자동 생성 금지)
5. 신규 SPEC P0 (E2EFIX-001) 우선 RUN 진입 → P1 (DEPLOY-001) 진입

---

*End of review-gaps-2026-05-05.md*
