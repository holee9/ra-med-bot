---
id: SPEC-REGULA-QUALITY-001
title: "Regula Quality Elevation — Corpus Seed · Eval Pipeline · Cloudflare Fallback · DocIngest · Security"
status: completed
phase: "quality-elevation"
priority: High
version: 0.4.0
created: 2026-05-04
updated: 2026-05-05
author: drake.lee
issue_number: 34
depends_on:
  - SPEC-REGULA-RELEASE-GATE-001
  - SPEC-REGULA-RELEASE-HARDENING-001
related_specs:
  - SPEC-REGULA-RELEASE-001
  - SPEC-REGULA-DOCINGEST-001
  - SPEC-REGULA-CLOUDFLARE-001
  - SPEC-REGULA-FOUNDATION-001
related_issues:
  - "#34"
labels:
  - quality
  - rag
  - eval
  - security
  - infra
  - bootstrap
revision_history:
  - version: 0.3.0
    date: 2026-05-05
    author: manager-spec (release-gap remediation)
    notes: "1차 RC 갭 리포트(2026-05-05) §2.1 권고에 따라 Group G — Local Bootstrap (REQ-QUAL-026~028) 추가."
  - version: 0.2.0
    date: 2026-05-05
    author: manager-spec (plan-auditor remediation)
    notes: "Plan-auditor 보강 — frontmatter 표준화 (related→related_specs, related_issues 추가, version 0.2.0). REQ-QUAL-011에 hybrid-router.ts:142 단독 owner 명시 노트 추가 (HARDENING-001 REQ-HARDEN-020이 본 SPEC에 위임). traceability-matrix.md 신규 작성. _shared/qa-gate-roadmap.md 참조 도입."
  - version: 0.1.0
    date: 2026-05-04
    author: drake.lee
    notes: "초기 초안 작성 — P2 품질 향상 6개 그룹 정의 (REQ-QUAL-001~025)"
---

# SPEC-REGULA-QUALITY-001 — Quality Elevation

## HISTORY

| Version | Date       | Author                              | Change                                                                                                              |
| ------- | ---------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 0.3.0   | 2026-05-05 | manager-spec (release-gap remediation) | 1차 RC 갭 리포트(2026-05-05) §2.1 권고에 따라 Group G — Local Bootstrap (REQ-QUAL-026~028) 추가. (#99 SPEC amendment 이슈, closed; 구현 추적은 #34) |
| 0.2.0   | 2026-05-05 | manager-spec (plan-auditor remediation) | Plan-auditor 보강 — frontmatter 표준화, REQ-QUAL-011 sole-owner 노트, traceability-matrix.md 신규 작성                |
| 0.1.0   | 2026-05-04 | drake.lee                           | 초기 초안 작성 — P2 품질 향상 6개 그룹 정의 (REQ-QUAL-001~025)                                                          |

---

## 1. Overview

### 1.1 Purpose

Regula 의료기기 규제 RAG 시스템의 **실제 기능 정확성과 평가 신뢰성**을 완성하는 P2 품질 향상 작업을 정의한다. RELEASE-GATE-001 (배포 게이트)과 RELEASE-HARDENING-001 (운영 안정화) 이후 실행되는 후속 단계로, 시스템이 "동작은 하지만 데이터가 비어 있는" 상태에서 "실제로 답을 생성하고, 평가를 통과하며, 운영 신뢰성을 확보한" 상태로 격상한다.

### 1.2 Background

코드베이스 분석에서 확인된 6개의 품질 격차(Verified Quality Gaps):

- **Q-1**: `source_sections` (pgvector embedding) 테이블에 시드 데이터 부재 — 5개 코퍼스(FDA/EU-MDR/MFDS/NMPA/PMDA) 모두 빈 상태
- **Q-2**: `pnpm eval:ci` (promptfoo, 55 시나리오, 6 코퍼스) 가 실제 코퍼스 없이 통과 불가
- **Q-3**: `lib/ai/hybrid-router.ts:142` 의 `TODO: implement with VectorizeIndex binding` 미해결, pgvector 폴백 동작 미문서화
- **Q-4**: `app/(app)/admin/documents/upload/` UI ↔ `lib/ingest/` 파이프라인 ↔ `source_sections` 적재 흐름 검증 미완
- **Q-5**: 보안 헤더 E2E 테스트(CSP/HSTS/X-Frame-Options/X-Content-Type-Options)의 CI 통과 불확실
- **Q-6**: `scripts/qa/check-rbac.mjs` 의 admin 문서 라우트 커버리지 미확인

### 1.3 Goals

- 실제 규제 코퍼스 시드 데이터로 하이브리드 검색이 정상 응답하도록 한다
- promptfoo 평가 파이프라인이 ≥ 80% 통과율로 CI에서 자동 실행되도록 한다
- Cloudflare Vectorize TODO를 해소하고 pgvector 폴백 행동을 명시화한다
- 문서 업로드 → 청크 → 임베딩 → 검색 가능 흐름을 엔드투엔드 검증한다
- 보안 헤더와 admin RBAC 가 CI에서 자동 검증되도록 한다

### 1.4 Non-Goals

- 신규 규제 코퍼스 추가 (FDA/EU-MDR/MFDS/NMPA/PMDA 외)
- LLM 모델 변경 또는 프롬프트 엔지니어링 개편
- UI/UX 재설계
- 멀티테넌시 격리 강화 (TENANT-001 범위)

---

## 2. Requirements (EARS)

EARS 패턴: Ubiquitous(U) / Event-Driven(ED) / State-Driven(SD) / Optional(O) / Unwanted(UB).

### Group A — Corpus Seed Data (REQ-QUAL-001 ~ 005)

- **REQ-QUAL-001 (U)**: The system **shall** provide a reproducible seed mechanism (script or migration) that populates `source_sections` with the minimum viable regulatory corpus, executable via `pnpm db:seed:corpus`.
- **REQ-QUAL-002 (U)**: The seed dataset **shall** contain at least 20 chunks per corpus across 5 corpora (FDA, EU-MDR, MFDS, NMPA, PMDA), totaling ≥ 100 rows in `source_sections` with non-null `embedding vector(1536)`.
- **REQ-QUAL-003 (U)**: Seed content **shall** be drawn from real regulatory text (e.g., FDA 21 CFR Part 820 excerpts, EU MDR Article references, MFDS Act references) and **shall not** contain placeholder or lorem-ipsum text.
- **REQ-QUAL-004 (ED)**: **When** a developer runs `pnpm db:seed:corpus` against a fresh database, the system **shall** complete corpus loading and embedding generation deterministically, producing the same chunk ids on reruns.
- **REQ-QUAL-005 (ED)**: **When** the seeded database receives a hybrid search query for canonical regulatory questions (e.g., "510(k) submission requirements", "EU MDR clinical evaluation"), the retriever **shall** return at least 1 result above the minimum cosine similarity threshold.

### Group B — promptfoo Eval Pipeline (REQ-QUAL-006 ~ 010)

- **REQ-QUAL-006 (U)**: `pnpm eval:ci` (configured at `tests/eval/promptfoo.config.yaml`) **shall** execute against a database seeded per Group A and exit with code 0 on success.
- **REQ-QUAL-007 (SD)**: **While** the seeded corpus is present, the eval suite **shall** achieve a pass rate of at least 80% across the 55 scenarios spanning 6 datasets (`fda.yaml`, `eu-mdr.yaml`, `mfds.yaml`, `nmpa.yaml`, `pmda.yaml`, `internal-sop.yaml`).
- **REQ-QUAL-008 (U)**: Eval results **shall** be persisted to a versioned location (e.g., `tests/eval/results/<timestamp>.json`) for trend tracking, and the latest baseline **shall** be committed to the repository.
- **REQ-QUAL-009 (ED)**: **When** any eval scenario falls below the threshold, the failure record **shall** include a documented root-cause classification (corpus-gap | retrieval-gap | model-error | evaluator-flake).
- **REQ-QUAL-010 (UB)**: The eval pipeline **shall not** exceed the existing CI timeout of 30 minutes; **if** runtime exceeds budget, the runner **shall** terminate gracefully and report the partial result.

### Group C — Cloudflare Vectorize Fallback (REQ-QUAL-011 ~ 014)

- **REQ-QUAL-011 (U)**: `lib/ai/hybrid-router.ts` **shall not** contain unresolved `TODO` comments related to Vectorize integration after this SPEC completes. **Note**: This REQ is the sole owner of `lib/ai/hybrid-router.ts:142` resolution; HARDENING-001 REQ-HARDEN-020 explicitly defers to this SPEC for Vectorize fallback work.
- **REQ-QUAL-012 (SD)**: **While** environment variable `CLOUDFLARE_VECTORIZE_INDEX_NAME` is unset or empty, the hybrid router **shall** route public-corpus queries to the pgvector path without raising an error, and the behavior **shall** be documented in code and `.env.example`.
- **REQ-QUAL-013 (ED)**: **When** `CLOUDFLARE_VECTORIZE_INDEX_NAME` is set in a Workers runtime, the router **shall** dispatch to the Vectorize binding; in non-Workers test environments the router **shall** fall back to pgvector even if the env var is set.
- **REQ-QUAL-014 (U)**: An integration test **shall** verify the pgvector fallback path executes successfully when Cloudflare env vars are absent, asserting non-empty retrieval against the seeded corpus.

### Group D — Document Ingestion End-to-End (REQ-QUAL-015 ~ 019)

- **REQ-QUAL-015 (U)**: The admin document upload flow (`/admin/documents/upload`) **shall** be wired end-to-end to the `lib/ingest/` pipeline (extract → PII redact → chunk → embed → persist to `source_sections`).
- **REQ-QUAL-016 (ED)**: **When** an admin uploads a supported document, the system **shall** insert a new `sources` row and ≥ 1 corresponding `source_sections` rows with valid `embedding`, observable via the admin documents list within the same session.
- **REQ-QUAL-017 (ED)**: **When** the upload completes, a subsequent knowledge-base search containing terms from the uploaded document **shall** return that document among the top-K results.
- **REQ-QUAL-018 (UB)**: **If** a non-admin / non-ra-member role attempts to access `/admin/documents/*` routes or the upload API, **then** the system **shall** deny access with HTTP 403 and emit an audit log entry.
- **REQ-QUAL-019 (UB)**: **If** an upload exceeds the configured size limit, uses an unsupported format, or fails PII detection, **then** the system **shall** reject the upload with a structured error and **shall not** create partial `source_sections` rows.

### Group E — Security Headers Verification (REQ-QUAL-020 ~ 023)

- **REQ-QUAL-020 (U)**: The Playwright E2E test for security headers **shall** pass in CI on the `chromium` project against a build representative of production.
- **REQ-QUAL-021 (U)**: All `/api/ra/*` routes **shall** emit the following headers with the specified values:
  - `Content-Security-Policy` containing a nonce that matches inline script nonces
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security` with `max-age` ≥ 31536000
  - `X-Content-Type-Options: nosniff`
- **REQ-QUAL-022 (ED)**: **When** any HTML response is rendered, the CSP nonce in the response header **shall** equal the `nonce` attribute on every inline `<script>` tag in the body.
- **REQ-QUAL-023 (UB)**: The middleware **shall not** allow a response that omits any of the four required headers above on protected routes; **if** a header is missing, the response **shall** fail the E2E assertion and block CI.

### Group F — Admin RBAC Audit (REQ-QUAL-024 ~ 025)

- **REQ-QUAL-024 (U)**: `pnpm ci:rbac` **shall** include `/admin/documents`, `/admin/documents/upload`, `/admin/documents/[id]`, and `/admin/radar` in its coverage matrix and exit successfully.
- **REQ-QUAL-025 (UB)**: **If** the RBAC matrix lacks an entry for any admin route exposed in the application router, **then** `pnpm ci:rbac` **shall** fail with a clear identification of the missing route.

### Group G — Local Bootstrap (REQ-QUAL-026 ~ 028)

신규 개발자 온보딩 + CI fresh runner 재현성 확보를 위한 `.env.local` 부트스트랩 메커니즘. FOUNDATION REQ-FND-010a `lib/env.ts` zod fail-fast이 빈 `.env.local`에서 abort하는 문제와, Group A seed 메커니즘이 환경변수 부재 시 실행 불가한 갭을 해소한다. (구현 추적: #34)

- **REQ-QUAL-026 (U)**: The system **shall** provide a script `pnpm dev:bootstrap` that, when executed in a clean checkout without `.env.local`, generates `.env.local` from `.env.example` with placeholder-to-development value mapping for these key categories: (a) `DATABASE_URL` to a local pgvector docker connection string, (b) AI provider keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `COHERE_API_KEY`) to documented placeholder strings prefixed with `dev-placeholder-` that fail-fast in non-development NODE_ENV, (c) Auth provider keys (`AUTH_SECRET`, `AUTH_MICROSOFT_*`, `AUTH_GOOGLE_*`) to documented placeholders, (d) observability keys (`SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `LANGFUSE_*`) to disabled-in-dev placeholders. The script **shall** be idempotent: when `.env.local` already exists, the script **shall not** overwrite it and **shall** exit 0 with a warning.

- **REQ-QUAL-027 (UB)**: The bootstrap-generated placeholders **shall not** be accepted in any environment where `NODE_ENV !== 'development'`. **If** any value matching the regex `/^dev-placeholder-/` is detected in production env, **then** `lib/env.ts` zod schema **shall** raise a fail-fast error with message `"dev-placeholder values are forbidden in non-development environments"`.

- **REQ-QUAL-028 (U)**: The `DEVELOPMENT.md` Section 2 (Setup) **shall** document the `pnpm dev:bootstrap` workflow as the canonical first-run sequence: (1) `git clone`, (2) `pnpm install`, (3) `pnpm dev:bootstrap`, (4) `pnpm db:up && pnpm db:migrate && pnpm db:seed:corpus`, (5) `pnpm dev`.

---

## 3. Acceptance Criteria (Machine-Verifiable)

| # | Check                                                           | Command / Evidence                                                                  |
| - | --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1 | Corpus seed loaded                                              | `SELECT COUNT(*) FROM source_sections;` returns > 100                               |
| 2 | Embedding non-null                                              | `SELECT COUNT(*) FROM source_sections WHERE embedding IS NOT NULL;` equals total    |
| 3 | Eval CI passes                                                  | `pnpm eval:ci` exits 0; pass rate ≥ 80%                                             |
| 4 | No Vectorize TODO                                               | `grep -E "TODO.*Vectorize\|wire up Vectorize" lib/ai/hybrid-router.ts` returns no matches |
| 5 | pgvector fallback test passes                                   | Integration test `tests/integration/hybrid-router-fallback.test.ts` passes          |
| 6 | DocIngest end-to-end                                            | Upload test fixture → search returns it within same suite                           |
| 7 | Security headers E2E passes                                     | `pnpm test:e2e --grep @security-headers` exits 0 on chromium                        |
| 8 | RBAC coverage clean                                             | `pnpm ci:rbac` exits 0 with admin doc routes included                               |
| 9 | Bootstrap script generates .env.local                           | Fresh checkout + `pnpm dev:bootstrap` → `.env.local` 생성, 후속 `pnpm db:seed:corpus` 통과 |
| 10 | dev-placeholder blocked in production                           | `NODE_ENV=production ANTHROPIC_API_KEY=dev-placeholder-anthropic pnpm build` exits ≠ 0 |
| 11 | DEVELOPMENT.md 5-step sequence                                  | `DEVELOPMENT.md` Section 2 contains 5단계 sequence (git clone → pnpm install → pnpm dev:bootstrap → db:up/migrate/seed → pnpm dev) |

---

## 4. Exclusions (What NOT to Build)

- **EXC-1**: 신규 규제 코퍼스 도입 — FDA/EU-MDR/MFDS/NMPA/PMDA 5종 외 추가 코퍼스(WHO/IMDRF 등)는 본 SPEC 범위 밖
- **EXC-2**: 모델/프롬프트 변경 — Claude 모델 교체, 프롬프트 템플릿 재작성, query-rewrite 로직 변경 금지
- **EXC-3**: Vectorize 신규 구현 — Cloudflare Workers 런타임에서의 실제 Vectorize binding 호출은 별도 SPEC(CLOUDFLARE-001 후속)으로 이관, 본 SPEC은 폴백 명시화/문서화에 한정
- **EXC-4**: UI 개편 — 관리자 페이지 디자인/레이아웃 변경, 새 컴포넌트 추가 금지 (기존 폼 재배선만)
- **EXC-5**: 인증/권한 모델 확장 — 신규 role 추가, RBAC 정책 변경 금지 (커버리지 검증만)
- **EXC-6**: 성능 최적화 — 검색 인덱스 튜닝, 임베딩 차원 축소, 캐시 도입 금지
- **EXC-7**: 멀티테넌트 격리 강화 — TENANT-001 v2.0 범위로 분리

---

## 5. References

### 5.1 의존 SPEC

- `SPEC-REGULA-RELEASE-GATE-001` (P0)
- `SPEC-REGULA-RELEASE-HARDENING-001` (P1)

### 5.2 관련 SPEC

- `SPEC-REGULA-RELEASE-001` (umbrella)
- `SPEC-REGULA-DOCINGEST-001`
- `SPEC-REGULA-CLOUDFLARE-001`
- `SPEC-REGULA-FOUNDATION-001`

### 5.3 코드 진입점

- `lib/ai/hybrid-router.ts` (line 142 TODO — 본 SPEC의 단독 owner, REQ-QUAL-011 참조)
- `lib/ai/retrievers/hybrid-search.ts`
- `lib/db/schema.ts` (`sourceSections` table)
- `lib/ingest/embed.ts`
- `app/(app)/admin/documents/upload/page.tsx`
- `tests/eval/promptfoo.config.yaml`
- `scripts/qa/check-rbac.mjs`

### 5.4 연구 / 추적 문서

- `research.md` (본 디렉토리)
- `traceability-matrix.md` (본 디렉토리)
- `plan.md`, `acceptance.md`

### 5.5 QA 단계 게이트 정의

QA 단계 게이트(0~5) 정의는 `.moai/specs/_shared/qa-gate-roadmap.md`를 참조하라.

### 5.6 RACI Matrix (Cross-SPEC 책임 분담)

본 SPEC family에서 책임이 중첩될 수 있는 항목의 RACI를 명시한다.

| 항목 | RELEASE-GATE-001 | QUALITY-001 | QA Gate (#73-#79) |
|---|---|---|---|
| 보안 헤더 미들웨어 코드 (R) | — | Owner (REQ-QUAL-020~023) | Verifier (#76 PR Acceptance) |
| 보안 헤더 E2E 테스트 작성 (R) | — | Owner | — |
| 보안 헤더 E2E CI 실행 결과 (A) | Verifier | Owner | Verifier (#76, #79) |
| RBAC 매트릭스 코드 (R) | — | Owner (REQ-QUAL-024~025) | Verifier (#76) |
| Branch/PR/Issue closure (R/A) | Owner | — | Verifier (#76) |
| Synthetic monitoring (R) | — | — | Owner (#79 QA Gate 5) |
| Domain UAT (R/A) | — | — | Owner (#78 QA Gate 4) |

R = Responsible, A = Accountable
