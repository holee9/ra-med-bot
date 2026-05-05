# Regula 1차 릴리즈 v1.0.0-rc 보강 — Amendment 권고 (2026-05-05)

## 0. 메타

- 작성일: 2026-05-05
- 작성자: manager-spec
- 입력: `.moai/plans/review-gaps-2026-05-05.md` §3 결정표
- 원칙: **기존 SPEC 파일은 절대 수정하지 않는다**. 본 문서는 사용자가 후속 PR로 amendment를 적용할 때 참고할 권고 REQ 본문만 정리한다.
- 적용 대상 기존 SPEC: 2종
  1. `SPEC-REGULA-QUALITY-001` Group A (corpus seed)
  2. `SPEC-REGULA-ENTERPRISE-001` Group G (4-way observability)

---

## 1. SPEC-REGULA-QUALITY-001 amendment 권고

### 1.1 배경

QUALITY-001 Group A (REQ-QUAL-001~005)은 `pnpm db:seed:corpus` 메커니즘으로 `source_sections`에 100+ 청크를 시드하는 요구를 정의한다. 그러나 **`.env.local` 파일이 없는 상태**에서는 `lib/env.ts` zod fail-fast (FOUNDATION REQ-FND-010a)가 즉시 abort하여 seed 명령조차 실행 불가하다. 이 갭은 신규 개발자 온보딩과 fresh CI runner에서 재현된다.

### 1.2 권고 신규 REQ

#### REQ-QUAL-026 (Ubiquitous) — `.env.local` 부트스트랩 스크립트

**요구사항:** The system **shall** provide a script `pnpm dev:bootstrap` that, when executed in a clean checkout without `.env.local`, generates `.env.local` from `.env.example` with placeholder-to-development value mapping for these key categories: (a) `DATABASE_URL` to a local pgvector docker connection string, (b) AI provider keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `COHERE_API_KEY`) to documented placeholder strings prefixed with `dev-placeholder-` that fail-fast in non-development NODE_ENV, (c) Auth provider keys (`AUTH_SECRET`, `AUTH_MICROSOFT_*`, `AUTH_GOOGLE_*`) to documented placeholders, (d) observability keys (`SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `LANGFUSE_*`) to disabled-in-dev placeholders.

**근거:**
- FOUNDATION REQ-FND-010a `lib/env.ts` zod fail-fast이 빈 `.env.local`에서 abort
- QUALITY-001 Group A seed 메커니즘이 환경변수 부재 시 실행 불가 (Q-1 corpus seed 의존)
- 신규 개발자 온보딩 친화도 + CI fresh runner 재현성

**검증 방법:**
- Fresh checkout (`.env.local` 부재)에서 `pnpm dev:bootstrap` 실행 → `.env.local` 생성 확인
- 생성된 `.env.local`의 `DATABASE_URL`로 `pnpm db:seed:corpus` 실행 시 zod fail-fast 통과
- 기존 `.env.local` 존재 시 `pnpm dev:bootstrap`은 idempotent (덮어쓰지 않음, exit 0 + warning)

#### REQ-QUAL-027 (Unwanted) — 프로덕션 placeholder 사용 금지

**요구사항:** The bootstrap-generated placeholders **shall not** be accepted in any environment where `NODE_ENV !== 'development'`. **IF** any value matching the regex `/^dev-placeholder-/` is detected in production env, **THEN** `lib/env.ts` zod schema **shall** raise a fail-fast error with message `"dev-placeholder values are forbidden in non-development environments"`.

**근거:**
- 보안 — placeholder 값이 production에 누출되어도 즉시 차단
- TRUST 5 Secured 원칙 + handoff §16

**검증 방법:**
- `NODE_ENV=production ANTHROPIC_API_KEY=dev-placeholder-anthropic pnpm build` → fail-fast exit code ≠ 0
- `NODE_ENV=development` 동일 시나리오 → 통과 (개발 환경 허용)

#### REQ-QUAL-028 (Ubiquitous) — DEVELOPMENT.md 업데이트

**요구사항:** The `DEVELOPMENT.md` Section 2 (Setup) **shall** document the `pnpm dev:bootstrap` workflow as the canonical first-run sequence: (1) `git clone`, (2) `pnpm install`, (3) `pnpm dev:bootstrap`, (4) `pnpm db:up && pnpm db:migrate && pnpm db:seed:corpus`, (5) `pnpm dev`.

**근거:** LAUNCH REQ-LAUNCH-044 DEVELOPMENT.md 8 섹션 정합성

**검증 방법:** `DEVELOPMENT.md` 파싱하여 5단계 sequence가 Section 2에 존재 확인

### 1.3 적용 가이드

이 3개 REQ는 QUALITY-001 spec.md `## 2. Requirements (EARS)` 섹션 끝에 **새 그룹 "Group G — Local Bootstrap (REQ-QUAL-026 ~ 028)"**로 추가한다. revision_history는 다음 entry 추가:

```yaml
revision_history:
  - version: 0.3.0
    date: 2026-05-05
    author: manager-spec (release-gap remediation)
    notes: "1차 RC 갭 리포트(2026-05-05) §2.1 권고에 따라 Group G — Local Bootstrap (REQ-QUAL-026~028) 추가. .env.local 부트스트랩 스크립트로 신규 개발자 온보딩 + CI fresh runner 재현성 확보."
```

---

## 2. SPEC-REGULA-ENTERPRISE-001 amendment 권고

### 2.1 배경

ENTERPRISE-001 Group G (REQ-ENTERPRISE-066~073)은 4-way observability(Sentry / PostHog / Langfuse / Vercel Analytics)를 정의하지만, 다음 3개 갭이 존재한다:

1. **Sentry RootLayout ErrorBoundary 미들웨어** 통합 검증 부재 — `app/layout.tsx`에 명시적 `<Sentry.ErrorBoundary>`가 없음 (ENTERPRISE-066은 Sentry SDK 설정만 명시, RootLayout wrapper 명시적 부재)
2. **Langfuse `/api/ra/consult` 자동 trace 미들웨어** — REQ-ENTERPRISE-068은 `lib/ai/consult.ts`의 LLM call 래핑만 명시. Route Handler 진입 시점부터 자동 trace 미보장
3. **4-way 단일 통합 검증 게이트** — Group G 8개 REQ가 분산 검증. 4 벤더 모두 동시 수신을 단일 시나리오로 검증하는 E2E 또는 통합 테스트 부재

### 2.2 권고 신규 REQ

#### REQ-ENTERPRISE-074 (Ubiquitous) — Sentry RootLayout ErrorBoundary

**요구사항:** The `app/layout.tsx` **shall** wrap its children with `<Sentry.ErrorBoundary fallback={...}>` from `@sentry/nextjs`, providing a client-rendered fallback UI when an unhandled error occurs in any descendant Server or Client Component.

**근거:**
- ENTERPRISE REQ-ENTERPRISE-066이 Sentry SDK 설정만 명시, RootLayout 통합 명시적 부재
- `app/error.tsx`만으로는 Sentry breadcrumb chain이 끊길 수 있음 (Server Component 에러는 page-level error.tsx로만 처리)
- 운영 시 errorBoundary 미통합 발견 사례

**검증 방법:**
- `app/layout.tsx`에 `import { ErrorBoundary } from '@sentry/nextjs'` (또는 동등 import) 존재
- Throwing `new Error('test')` in arbitrary Client Component → Sentry dashboard event 수신 + breadcrumb chain에 RootLayout 포함

#### REQ-ENTERPRISE-075 (Event-Driven) — Langfuse Route Handler 자동 trace 미들웨어

**요구사항:** **WHEN** a request arrives at `/api/ra/consult`, `/api/ra/expert-review/*`, or `/api/ra/consultations/*`, **THE** system **shall** wrap the Route Handler invocation in a Langfuse `trace` automatically via a shared middleware/wrapper at `lib/observability/langfuse-handler.ts` exporting `withLangfuseTrace(handler)`. The wrapper **shall** inject `trace_id` into the response headers as `X-Langfuse-Trace-Id` AND set `traceMetadata = {route, method, statusCode, latencyMs}` PII-free.

**근거:**
- REQ-ENTERPRISE-068은 `lib/ai/consult.ts` LLM call 래핑만 명시. Route Handler 진입 → DB 쿼리 → LLM 호출 → 응답 사이의 전체 trace가 단일 trace_id로 묶이지 않음
- 디버깅 시 사용자 ID / messageId만으로 trace 검색 어려움
- handoff §18 "Langfuse dashboard 통합" 정신과 일치

**검증 방법:**
- POST `/api/ra/consult` 요청 → 응답 헤더 `X-Langfuse-Trace-Id` 존재
- Langfuse dashboard에서 해당 trace_id 조회 시 single trace에 retrieval / generation / citation 3 spans 모두 포함

#### REQ-ENTERPRISE-076 (Ubiquitous) — 4-way 통합 검증 E2E 게이트

**요구사항:** The system **shall** provide an E2E test `tests/e2e/observability-integration.spec.ts` that, in a single scenario `(login → 1 consult query → logout)`, verifies all four observability vendors received expected events: (a) Sentry — at least 1 transaction event with `op: pageload` and `op: navigation`, (b) PostHog — at least 1 `$pageview` event AND zero PII fields (no `email`, `userId`, `question`, `answer`), (c) Langfuse — at least 1 trace with `trace_id` matching the response header from REQ-ENTERPRISE-075, (d) Vercel Analytics — at least 1 Web Vitals beacon (LCP / INP / CLS). Each vendor verification **shall** use SDK-provided test/mock instrumentation OR network interception (`page.route()`) to assert the outbound HTTP request payload shape.

**근거:**
- Group G 8개 REQ는 벤더별 단독 검증만 정의. 4 벤더가 동시에 정상 동작하는지 회귀 테스트하는 단일 게이트 부재
- 1차 RC 후 Sentry/PostHog 중 한쪽이 silent break되는 운영 회귀 위험
- LAUNCH REQ-LAUNCH-021 a11y E2E와 별도 spec으로 분리 (관측성은 a11y와 다른 dimension)

**검증 방법:**
- `pnpm test:e2e tests/e2e/observability-integration.spec.ts` Chromium 통과
- 4 벤더 중 1개 라도 mock event 미수신 시 test fail
- PII 필드 검출 시 test fail (REQ-ENTERPRISE-070 보완)

### 2.3 적용 가이드

이 3개 REQ는 ENTERPRISE-001 spec.md Group G (REQ-ENTERPRISE-066~073) 끝에 추가한다. revision_history 다음 entry 추가:

```yaml
revision_history:
  - version: 0.3.0
    date: 2026-05-05
    author: manager-spec (release-gap remediation)
    notes: "1차 RC 갭 리포트(2026-05-05) §2.3 권고에 따라 Group G에 REQ-ENTERPRISE-074~076 추가. Sentry RootLayout ErrorBoundary, Langfuse Route Handler 자동 trace 미들웨어, 4-way 통합 검증 E2E 게이트로 4-way observability 단일 회귀 검증 보강."
```

또한 `.moai/specs/SPEC-REGULA-ENTERPRISE-001/spec.md`의 §검증 자동화 매트릭스에 다음 항목 추가:

```
| Observability integration | `pnpm test:e2e --grep observability-integration` | 4-way 단일 시나리오 회귀 (REQ-ENTERPRISE-076) |
```

---

## 3. Amendment 적용 우선순위

| Amendment | Priority | 이유 |
| --- | --- | --- |
| QUALITY-001 REQ-QUAL-026 | P0 | `.env.local` 생성기 부재 시 신규 개발자 + CI runner가 corpus seed 직전 fail. 1차 RC 진입 차단 가능성 |
| QUALITY-001 REQ-QUAL-027 | P0 | placeholder 누출 방어. P0 (Secured) |
| QUALITY-001 REQ-QUAL-028 | P1 | DEVELOPMENT.md 정합성. 문서화만이므로 P1 |
| ENTERPRISE-001 REQ-ENTERPRISE-074 | P1 | Sentry ErrorBoundary는 운영 안정성 향상이나 첫 RC 차단 사유 아님 |
| ENTERPRISE-001 REQ-ENTERPRISE-075 | P1 | Langfuse 자동 trace는 디버깅 효율 향상이나 선택적 |
| ENTERPRISE-001 REQ-ENTERPRISE-076 | P1 | 4-way 통합 게이트는 회귀 방지 강화. 첫 RC 후 적용 가능 |

---

## 4. 검증 절차

각 amendment 적용 후:

- [ ] 해당 SPEC의 spec.md HISTORY 표 업데이트
- [ ] 해당 SPEC의 frontmatter `version` 0.2.0 → 0.3.0 bump
- [ ] traceability-matrix.md (있을 경우) 신규 REQ 행 추가
- [ ] 신규 REQ가 검증 자동화 가능 형태인지 (CI gate 또는 E2E spec) 확인
- [ ] 본 amendments-2026-05-05.md 문서를 PR 설명에 인용

---

## 5. 적용 차단 사유 (해당 없음)

본 amendment 권고는 다음을 변경하지 않는다:

- frozen zone (constitution.md, audit append-only trigger 등)
- 기존 REQ 본문 (추가만 허용, 기존 REQ 수정 금지)
- 다른 SPEC의 in-scope (cross-SPEC ownership 위반 없음)
- 1차 RC scope (RELEASE-001 §2 In/Out scope 변경 없음)

---

*End of amendments-2026-05-05.md*
