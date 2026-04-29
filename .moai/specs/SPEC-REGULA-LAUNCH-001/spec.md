---
id: SPEC-REGULA-LAUNCH-001
title: Regula Phase 6 Quality & Launch — LLM Eval, E2E, Load, Security, Deploy, Docs
status: draft
created: 2026-04-22
updated: 2026-04-23
author: manager-spec
phase: 6
skill: regula
version: 0.2.0
priority: Medium
revision_history:
  - version: 0.1.0
    date: 2026-04-22
    author: manager-spec
    notes: |
      Initial Phase 6 draft. 48 REQ-LAUNCH organized in 6 groups (Eval 12,
      E2E 10, Load 6, Security 8, Deploy 7, Docs 5). 6 technical decisions
      locked: promptfoo, k6, Vercel, Neon (권장), GitHub Actions, Vercel Env.
      launch_readiness_checklist 25 items across 6 categories. Non-Obvious
      Constraints 7항목 전부 재검증 매핑. Depends on all 5 prior Phase SPECs.
  - version: 0.2.0
    date: 2026-04-23
    author: manager-spec (iteration via cross-spec-audit High patch)
    notes: |
      Applied cross-spec-audit High H9: REQ-LAUNCH-029 expansion — ENTERPRISE
      Phase 5의 13 automation CI gates 전원을 LAUNCH preflight (REQ-LAUNCH-040)
      시나리오에 포함하여 Phase 6 런치 시점의 regression 방지. 구체적으로:
      `pnpm tokens:check`, `pnpm modules:check`, `pnpm contrast:check`,
      `pnpm i18n:check`, `pnpm i18n:hardcoded-check`, `pnpm a11y`,
      `pnpm rbac:check`, `pnpm audit:check` 8개 추가 gate를 preflight에
      편입. depends_on을 FOUNDATION v0.4.0+, 모든 prior phase SPEC v0.2.0+로
      갱신. 신규 REQ 없음. REQ 재배치 없음.
related_handoff_sections:
  - "§15"
  - "§16"
  - "§17"
  - "§18"
  - "§20"
depends_on:
  - SPEC-REGULA-FOUNDATION-001 (v0.4.0+)
  - SPEC-REGULA-CHAT-001 (v0.2.0+)
  - SPEC-REGULA-STRUCTURED-001 (v0.2.0+)
  - SPEC-REGULA-BREADTH-001 (v0.2.0+)
  - SPEC-REGULA-ENTERPRISE-001 (v0.2.0+)
---

# SPEC-REGULA-LAUNCH-001 — Regula Phase 6 Quality & Launch

## 목적 (Purpose)

의료기기 RA(Regulatory Affairs) 전문가용 RAG 챗봇 `Regula`의 **프로덕션 런칭을 위한 품질 게이팅 Phase**로, 이전 5개 Phase(FOUNDATION/CHAT/STRUCTURED/BREADTH/ENTERPRISE)에서 구현한 모든 기능·제약·감사 장치를 **정량적 기준으로 재검증**하고, 운영 투입 전 반드시 성립해야 할 6개 범주의 launch readiness gate (Functional, Quality, LLM, Performance, Security, Operational)를 통과시키는 것이 목적이다.

본 Phase는 신규 비즈니스 로직을 구현하지 않는다. 대신 다음 6개 산출물 범주로 품질을 수립한다:
1. **LLM Eval Harness** (promptfoo 기반 55+ 규제 질의 regression)
2. **Playwright E2E** (5개 core flow + a11y + i18n, 3 browser matrix)
3. **Load Testing** (k6, first token P95 ≤ 1.5s @ 50 VU)
4. **Security Review** (OWASP Top 10 매핑 + 감사 trail 재검증 + 의존성 스캔)
5. **Production Deployment** (Vercel + Neon, 환경변수 매트릭스, 롤백 전략)
6. **Documentation** (DEVELOPMENT.md 확장 + README + architecture + runbook + compliance)

handoff §20 Phase 6 "Quality & launch" 블록 범위를 엄격히 준수하며, 신규 기능 추가·corpus 확장·GxP 워크플로우 심화는 모두 **Out of Scope** (Post-launch 별도 SPEC).

---

## 범위 (Scope)

### In Scope

#### Group A: LLM Eval Harness

| 구분 | 산출물 |
|---|---|
| 설정 | `tests/eval/promptfoo.config.yaml` (55+ 시나리오 정의) |
| 데이터셋 | `tests/eval/datasets/fda.yaml` (15), `tests/eval/datasets/eu-mdr.yaml` (15), `tests/eval/datasets/mfds.yaml` (10), `tests/eval/datasets/nmpa.yaml` (5), `tests/eval/datasets/pmda.yaml` (5), `tests/eval/datasets/internal-sop.yaml` (5) |
| Scorer | `tests/eval/scorers/citation-coverage.ts`, `tests/eval/scorers/hallucination.ts`, `tests/eval/scorers/confidence-calibration.ts`, `tests/eval/scorers/expert-review-gating.ts` |
| 검수 | `tests/eval/datasets/REVIEWED.md` (RA 리드 서명 + 날짜) |
| 실행 스크립트 | `scripts/run-eval.sh`, `package.json` script `eval:ci` |
| CI 통합 | `.github/workflows/ci.yml` 내 `eval` job (PR trigger) |

#### Group B: Playwright E2E

| 구분 | 산출물 |
|---|---|
| 설정 | `playwright.config.ts` (3 browser projects, baseURL, retries, workers) |
| Spec | `tests/e2e/auth.spec.ts` (SSO 로그인 → /), `tests/e2e/consultation.spec.ts` (질의 → 스트림 → citation), `tests/e2e/expert-review.spec.ts` (저 confidence 게이팅 → 큐 등록 → resolve), `tests/e2e/project-switch.spec.ts` (프로젝트 전환 대화 보존), `tests/e2e/citation-click.spec.ts` (DocViewer 딥링크), `tests/e2e/i18n.spec.ts` (ko↔en), `tests/e2e/a11y.spec.ts` (`@axe-core/playwright`) |
| Fixture | `tests/e2e/fixtures/msw-sse.ts` (SSE 모킹), `tests/e2e/fixtures/auth.ts` (저장된 세션) |
| Matrix | Chromium + Firefox + Webkit (3 projects) |
| CI 통합 | `.github/workflows/ci.yml` 내 `e2e` job (matrix strategy) |

#### Group C: Load Testing

| 구분 | 산출물 |
|---|---|
| 스크립트 | `tests/load/k6.js` (steady 50 VU + spike 100 VU), `tests/load/k6-mock.js` (MSW-backed mock mode) |
| Threshold | `http_req_duration{endpoint:consult_first_token}: p(95)<1500`, `http_req_duration{endpoint:consult_full}: p(95)<8000`, `http_req_failed: rate<0.01` |
| 실행 | `scripts/run-load.sh`, `package.json` script `load:staging`, `load:mock` |
| 리포트 | `tests/load/reports/` (Grafana Cloud link 또는 JSON export) |

#### Group D: Security Review

| 구분 | 산출물 |
|---|---|
| 체크리스트 | `docs/security/owasp-top10-2025.md` (10 카테고리 매핑 + status) |
| Threat model | `docs/security/threat-model.md` (A04 대응) |
| 정적 스캔 | gitleaks GitHub Action (`.github/workflows/security.yml`), `pnpm audit` CI gate |
| 감사 재검증 | `tests/integration/audit-immutability.test.ts` (UPDATE/DELETE/TRUNCATE 시도 거부), `tests/integration/audit-retention.test.ts` (partition 설정 확인) |
| CSP/헤더 | `next.config.mjs` 헤더 재확인, Mozilla Observatory ≥ A 등급 스크린샷 |
| Pen-test 계획 | `docs/security/pentest-plan.md` (Post-launch 3개월 이내 수행 계획만, 실행은 OOS) |

#### Group E: Production Deployment

| 구분 | 산출물 |
|---|---|
| Vercel 설정 | `vercel.json` (regions, function maxDuration, headers) |
| 환경변수 매트릭스 | `docs/deployment/env-matrix.md` (dev/preview/production 각 변수 정의) |
| DB 연결 | Neon prod branch 연결, Drizzle migration apply 검증 |
| Pre-flight | `scripts/preflight.sh` (lint + typecheck + test + eval + audit + build) |
| Rollback | `docs/runbook.md` 내 Vercel rollback + DB migration down 절차 |
| DNS | `docs/deployment/dns-setup.md` (Vercel 도메인 추가, CNAME, HSTS preload) |
| Deployment gate | GitHub environment `production` manual approval 설정 |

#### Group F: Documentation

| 구분 | 산출물 |
|---|---|
| 확장 | `DEVELOPMENT.md` (FOUNDATION REQ-FND-060 5 섹션 + Troubleshooting + Architecture overview + Compliance overview = 8 섹션) |
| 신규 | `README.md` (외부 사용자), `docs/architecture.md` (mermaid 다이어그램), `docs/runbook.md` (on-call), `docs/compliance.md` (21 CFR Part 11 요약), `docs/api-reference.md` (`/api/ra/*` + Zod 스키마) |
| Changelog | `CHANGELOG.md` (Phase 1-6 변경 이력) |

### Out of Scope

다음 항목은 Post-launch SPEC에서 처리하며, 본 SPEC에서는 **의도적으로 구현하지 않는다**:

| 항목 | 이관 위치 | 사유 |
|---|---|---|
| EU region data residency 런치 (fra1 activation) | Post-launch SPEC | Phase 6은 US region(iad1)만 런치 범위, fra1은 config만 준비 |
| 21 CFR Part 11 전자 서명(electronic signatures) | Post-launch GxP | FOUNDATION v0.3.0에서 이미 Post-launch로 결정됨 |
| Pen-test 실행 (docs/security/pentest-plan.md의 실제 수행) | Post-launch 3개월 이내 | 본 SPEC은 계획만 작성 |
| A/B 테스트 프레임워크 | Post-launch | Phase 6 범위 아님 |
| 모바일 네이티브 앱 (handoff §19 Suggested #13 외) | Post-launch | Phase 6 런치는 웹 only |
| 신규 규제 corpus 추가 (현재 5 권역 외) | 별도 SPEC | BREADTH Phase 4에서 5 권역 완료 |
| Slack/Teams 통합(handoff §19 Suggested #6) | Post-launch | §19 항목 |
| 브라우저 확장(§19 Suggested #7) | Post-launch | §19 항목 |
| 음성 모드(§19 Suggested #13) | Post-launch | §19 항목 |
| `/api/ra/*` 엔드포인트 **신규 추가** | 각 이전 Phase | Phase 6은 `api-reference.md` 문서화만, 구현은 Phase 2-5에서 종료 |
| LLM 프롬프트 튜닝 (faithfulness 개선) | 별도 SPEC | eval이 failure 발견 시 별도 트랙 |
| 외부 pen-test 결과 대응 | Post-launch | 결과 나온 후 별도 SPEC |

---

## 기술 결정 (Technical Decisions)

본 SPEC은 Phase 6 품질 게이팅에 필요한 6개 기술 결정을 확정한다. 이전 Phase에서 확정된 결정(pgvector, Inngest, Auth.js v5, Drizzle 13-테이블, append-only audit trigger 등)은 여기서 재확정하지 않으며, 그대로 계승한다.

### Phase 6 확정 결정

| # | 결정 항목 | 선택 | 탈락안 | 근거 | 재평가 조건 |
|---|---|---|---|---|---|
| 1 | LLM Eval 도구 | **promptfoo (OSS)** | LangSmith / ragas / custom | YAML DSL로 RA 리드 직접 편집, TypeScript custom scorer로 Phase 2 `citation-parser.ts` 재사용, Anthropic provider 네이티브, CI 통합 용이 (JSON/JUnit 출력). research.md §1 참조 | Anthropic zero-data-retention API 비호환 발견 시 custom harness로 전환, 시나리오 200+ 확장 시 병렬화 재검토 |
| 2 | Load testing 도구 | **k6** | Artillery / Locust | JavaScript 친화 + SSE 네이티브 지원 + Grafana Cloud 무료 티어 + `ramping-vus` executor로 spike 테스트 구성 용이. research.md §5 참조 | k6 Cloud 비용 문제 발생 시 Artillery + self-hosted Grafana로 전환 |
| 3 | Hosting | **Vercel (Edge + Node Runtime 혼용)** | 자체 Docker + ECS / Fly.io | handoff §18 명시, Vercel Git 통합으로 preview-per-PR, `vercel.json`의 regions/functions 설정으로 EU residency 준비 가능. `consult` 라우트는 nodejs runtime 강제 (pgvector 호환성). research.md §7 참조 | Vercel function cold start P95 > 800ms 또는 비용 월 $5k 초과 시 ECS 재검토 |
| 4 | Database hosting | **Neon (serverless Postgres)** | Supabase / AWS RDS | Branching 기능으로 Vercel preview per-PR 격리 DB, auto-suspend 비용 효율, Enterprise tier HIPAA BAA, Vercel native integration. research.md §8 참조. **Phase 5 closing 2주 전 Neon 계약 체결 필수 (R-08).** | 코퍼스 > 50M 청크 시 pgvector 성능 재측정, vendor lock-in 부담 증가 시 RDS + pgvector 셀프 호스팅으로 마이그레이션 |
| 5 | CI/CD | **GitHub Actions + Vercel 자동 배포 연동** | Vercel only / CircleCI | GitHub Actions로 test/eval/audit matrix 실행, Vercel은 push-based preview + manual-gated production. production 배포는 `environments.production.reviewers` 필수. research.md §9 참조 | GitHub Actions 월 사용량 > 무료 티어 3000분 시 self-hosted runner 도입 |
| 6 | Secret management | **Vercel Env (primary) + Doppler (backup 정책)** | AWS Secrets Manager / Vault | Vercel 네이티브, env 자동 주입, 팀 RBAC. Doppler는 dev 팀 공유용 backup only (production secret은 Vercel에만 존재). quarterly rotation 알림은 Doppler 대시보드 활용. research.md §7.4 참조 | 팀 규모 10+ 또는 멀티 클라우드 이동 시 Vault로 통합 |

### Phase 6에서 **변경하지 않는** 이전 Phase 결정 (참고용)

| # | 결정 항목 | 결정된 Phase | 선택 | Phase 6 영향 |
|---|---|---|---|---|
| P1-1 | Vector DB | Phase 1 (FOUNDATION) | pgvector | eval 데이터셋 실행에 동일 DB 사용 |
| P1-2 | Queue / Worker | Phase 1 | Inngest | load test에서 Inngest 응답시간 미포함(async job) |
| P1-3 | message_blocks 단일 테이블 | Phase 1 | 통합 | eval 시나리오 block_types 검증 기준 |
| P1-4 | audit_logs 변경 차단 | Phase 1 | UPDATE+DELETE+TRUNCATE 전부 + role 분리 | **Phase 6 Group D에서 동적 재검증** |
| P2-1 | LLM Orchestration | Phase 2 (CHAT) | (Phase 2 kickoff에서 결정) | eval은 최종 선택된 orchestration 통과 후 테스트 |

---

## EARS 인수 기준 (Acceptance Criteria)

각 요구사항은 `REQ-LAUNCH-NNN` ID로 식별하며, EARS 5개 패턴(Ubiquitous, Event-Driven, State-Driven/Conditional, Unwanted, Optional) 중 적절한 형태로 기술한다. 모든 요구사항은 테스트 가능(testable)해야 한다.

**요구사항 총계**: REQ-LAUNCH-001 ~ 048 (**총 48개**), 6 그룹:
- Group A (Eval): REQ-LAUNCH-001 ~ 012 (12개)
- Group B (E2E): REQ-LAUNCH-013 ~ 022 (10개)
- Group C (Load): REQ-LAUNCH-023 ~ 028 (6개)
- Group D (Security): REQ-LAUNCH-029 ~ 036 (8개)
- Group E (Deploy): REQ-LAUNCH-037 ~ 043 (7개)
- Group F (Docs): REQ-LAUNCH-044 ~ 048 (5개)

---

### Group A: LLM Eval Harness (REQ-LAUNCH-001 ~ 012)

#### REQ-LAUNCH-001 (Ubiquitous)
**요구사항:** The system SHALL include `promptfoo` as a `devDependency` in `package.json` (version `^0.90.0` 이상 minor 고정).
**근거:** research.md §1.2 선정 근거. OSS, CI 친화.
**검증 방법:** `pnpm why promptfoo` 실행 시 존재 확인. `package.json` parsing으로 버전 구간 `^0.90.x` 일치 확인.

#### REQ-LAUNCH-002 (Ubiquitous)
**요구사항:** The system SHALL define `tests/eval/promptfoo.config.yaml` that loads all six dataset files (`fda.yaml`, `eu-mdr.yaml`, `mfds.yaml`, `nmpa.yaml`, `pmda.yaml`, `internal-sop.yaml`) and declares `providers: [anthropic:claude-sonnet-4-5, anthropic:claude-haiku-4-5]` both.
**근거:** research.md §2.1 도메인 분포.
**검증 방법:** `tests/eval/promptfoo.config.yaml` 파싱 후 `tests.files` 배열이 6개 파일 포함 확인, `providers` 배열이 2개 Anthropic 모델 포함 확인.

#### REQ-LAUNCH-003 (Ubiquitous)
**요구사항:** The system SHALL include at least **55 test scenarios** across the six dataset files with the exact distribution: FDA 15, EU MDR 15, MFDS 10, NMPA 5, PMDA 5, internal-sop 5.
**근거:** research.md §2.1.
**검증 방법:** `promptfoo list --config tests/eval/promptfoo.config.yaml` 또는 각 yaml 파일의 `tests` 배열 크기 합산 ≥ 55 및 각 권역별 개수 일치 확인.

#### REQ-LAUNCH-004 (Ubiquitous)
**요구사항:** Each eval scenario SHALL declare at least the following fields: `id` (string matching `/^[A-Z]+-\d{3}$/`), `category` (one of `lookup|comparison|timeline|checklist|edge|trap|hallucination|korean`), `input` (user question, ≤ 2000 chars), `locale` (`ko` | `en`), and `expected` block containing `must_include_citations` (list of `{source_id, section}` objects), `confidence_min` (float 0-1), `expert_review_required` (boolean), `block_types_expected` (list from block_type enum).
**근거:** research.md §2.3 ground truth 구조.
**검증 방법:** yaml schema validator (예: `ajv` 또는 promptfoo 자체 schema) 로 6개 파일 전부 통과.

#### REQ-LAUNCH-005 (Ubiquitous)
**요구사항:** The system SHALL provide `tests/eval/datasets/REVIEWED.md` containing at least one RA lead signature (full name + date + email) attesting to dataset correctness, with date ≤ 30 days before the first production deploy attempt.
**근거:** research.md §2.4 검수 프로세스.
**검증 방법:** 파일 존재 + 정규식 `/.*\|\s*\d{4}-\d{2}-\d{2}\s*\|.*@.*/` match 1회 이상 + 최신 날짜가 배포 시각으로부터 30일 이내 확인.

#### REQ-LAUNCH-006 (Ubiquitous)
**요구사항:** The system SHALL provide `tests/eval/scorers/citation-coverage.ts` that imports the Phase 2 citation parser (from `@/lib/rag/citation-parser` or equivalent) and returns `{pass: coverage >= 1.0, score: coverage, reason: string}` for each scenario.
**근거:** research.md §3.1 재사용 전략. Citation 100% 강제(Non-Obvious Constraint #1).
**검증 방법:** Vitest에서 mock 응답(`"Claim A<sup class='cite'>1</sup>. Claim B<sup class='cite'>2</sup>. Claim C."` + 2 sources)을 scorer에 통과시켜 `coverage = 2/3` 리턴 확인.

#### REQ-LAUNCH-007 (Ubiquitous)
**요구사항:** The system SHALL provide `tests/eval/scorers/hallucination.ts` that flags a scenario as hallucination if (a) any `must_not_include` keyword appears in output, OR (b) any citation index exceeds `sources` array length, OR (c) Sonnet-as-judge faithfulness score < 0.80.
**근거:** research.md §3.2.
**검증 방법:** 3가지 위반 케이스별 Vitest mock test 통과.

#### REQ-LAUNCH-008 (Ubiquitous)
**요구사항:** The system SHALL provide `tests/eval/scorers/expert-review-gating.ts` that verifies `trap` and `hallucination` category scenarios emit `{type: 'expert_review_required', reason: string}` SSE event AND output confidence < 0.70.
**근거:** research.md §2.2 Trap/Hallucination 카테고리. Non-Obvious Constraint #3 (Expert-review auto-flagging).
**검증 방법:** mock SSE stream에서 두 조건 AND 판정 Vitest test 통과.

#### REQ-LAUNCH-009 (Conditional)
**요구사항:** WHEN `pnpm eval:ci` is executed on a pull request, THEN the system SHALL output JSON results and exit with code 0 only if: citation coverage = 100% across all 55 scenarios AND hallucination rate ≤ 2% AND expert-review gating recall = 100% on `trap`+`hallucination` categories.
**근거:** research.md §1 CI gate. handoff §17 "50+ curated RA questions vs expected citations/answers, run pre-release".
**검증 방법:** 의도적 failure(가짜 응답) 주입 시 exit code ≠ 0 확인, 정상 응답 시 exit code 0.

#### REQ-LAUNCH-010 (Conditional)
**요구사항:** WHEN confidence calibration is measured across all 55 scenarios, THEN the Brier score SHALL be ≤ 0.15 (lower is better).
**근거:** research.md §3.3 calibration.
**검증 방법:** `tests/eval/scorers/confidence-calibration.ts`가 `sum((predicted_confidence - actual_correctness)^2) / N ≤ 0.15` 계산 후 `pass` 리턴 확인.

#### REQ-LAUNCH-011 (Ubiquitous)
**요구사항:** The system SHALL provide `scripts/run-eval.sh` that: (1) loads `.env.eval` (separate API key namespace), (2) executes `promptfoo eval --config tests/eval/promptfoo.config.yaml --output tests/eval/results/$(date +%Y%m%d-%H%M%S).json`, (3) uploads the results JSON to Langfuse dataset `regula-regression` for trend tracking.
**근거:** research.md §1 + Langfuse 통합 (ENTERPRISE Phase 5 범위).
**검증 방법:** shell script 실행 권한 + `.env.eval.example` 존재 + Langfuse SDK import 확인.

#### REQ-LAUNCH-012 (Conditional)
**요구사항:** The `.github/workflows/ci.yml` SHALL define an `eval` job that runs on `pull_request` events touching `app/`, `lib/rag/`, `lib/prompts/`, or `tests/eval/` paths, using `ANTHROPIC_API_KEY_EVAL` secret (separate from production key), with timeout 30 minutes.
**근거:** research.md §9.1 CI 매트릭스 + Anthropic rate limit 분리(R-02).
**검증 방법:** `.github/workflows/ci.yml` 파싱, `eval` job의 `paths` filter + `secrets.ANTHROPIC_API_KEY_EVAL` + `timeout-minutes: 30` 확인.

---

### Group B: Playwright E2E (REQ-LAUNCH-013 ~ 022)

#### REQ-LAUNCH-013 (Ubiquitous)
**요구사항:** The system SHALL include `@playwright/test` as a `devDependency` (already partly installed per FOUNDATION Phase 1 REQ-FND-005), with `@axe-core/playwright` added for accessibility testing.
**근거:** handoff §17 + FOUNDATION REQ-FND-005.
**검증 방법:** `package.json` devDependencies에 두 패키지 존재 확인.

#### REQ-LAUNCH-014 (Ubiquitous)
**요구사항:** The system SHALL provide `playwright.config.ts` defining exactly three browser projects: `{name: 'chromium'}`, `{name: 'firefox'}`, `{name: 'webkit'}`, with `retries: 2` on CI and `workers: 4`, baseURL from `PLAYWRIGHT_BASE_URL` env (default `http://localhost:3000`).
**근거:** research.md §4.2 browser matrix.
**검증 방법:** config 파싱 후 projects 배열 길이 = 3, 각 name 매칭 확인.

#### REQ-LAUNCH-015 (Ubiquitous)
**요구사항:** The system SHALL provide `tests/e2e/auth.spec.ts` covering (1) `/login` 페이지 렌더 + Microsoft/Google 버튼 표시, (2) `/login`은 `robots: index, follow` 메타 포함, (3) `/` 이하 보호 경로는 unauthenticated 상태에서 `/login`으로 redirect.
**근거:** handoff §17 core flow #1 "login" + FOUNDATION REQ-FND-018 (로그인 meta override). Non-Obvious Constraint #7 (noindex 검증).
**검증 방법:** spec 파일에 3개 `test()` 블록 존재, Chromium 실행 시 3개 모두 pass.

#### REQ-LAUNCH-016 (Ubiquitous)
**요구사항:** The system SHALL provide `tests/e2e/consultation.spec.ts` covering: (1) 로그인된 세션으로 `/chat` 진입, (2) Composer에 규제 질의 입력 + submit, (3) SSE event 7종 수신 검증 (`meta`, `trace`, `prose_delta`, `confidence`, `sources`, `done` 최소 포함; 적절한 질의 시 `checklist|comparison|timeline` 중 하나), (4) 응답 내 `<sup class="cite">N</sup>` 마커 ≥ 1개 + 각 N이 sources[N-1] 유효 인덱스인지 DOM 검증.
**근거:** handoff §17 core flow #2 "new consultation" + §11.1 multi-phase streaming + Non-Obvious Constraint #1(Citation), #2(Multi-phase streaming).
**검증 방법:** spec 파일에 4개 `test.step()` 포함, 3 browser matrix 전부 pass.

#### REQ-LAUNCH-017 (Ubiquitous)
**요구사항:** The system SHALL provide `tests/e2e/citation-click.spec.ts` covering: Consultation 응답에서 `<sup class="cite">1</sup>` 클릭 → DocViewer 슬라이드 열림 → URL에 `#source={id}&offset={N}` 해시 포함 → DocViewer 내 해당 offset 텍스트 스크롤 이동 확인.
**근거:** handoff §17 core flow #3 "citation click" + §9.2 + FOUNDATION `source_sections` 테이블.
**검증 방법:** spec 실행 후 URL 해시 정규식 `/#source=[\w-]+&offset=\d+/` match 확인 + 스크롤 위치 검증.

#### REQ-LAUNCH-018 (Ubiquitous)
**요구사항:** The system SHALL provide `tests/e2e/expert-review.spec.ts` covering: (1) MSW로 저 confidence (score < 0.70) + `expert_review_required: true` SSE 이벤트 주입, (2) UI에서 "전문가 검토 필요" 배지 렌더 확인, (3) "전문가 검토 요청" 버튼 클릭 시 `POST /api/ra/expert-review` 호출 + ticket id 리턴, (4) 리드 계정으로 로그인 후 `/dashboard` 또는 큐 페이지에서 해당 ticket 표시.
**근거:** handoff §17 core flow #4 "expert review request" + §9.3 + Non-Obvious Constraint #3 (Expert-review auto-flagging).
**검증 방법:** 4개 단계 전부 green, MSW fixture 존재 확인.

#### REQ-LAUNCH-019 (Ubiquitous)
**요구사항:** The system SHALL provide `tests/e2e/project-switch.spec.ts` covering: 프로젝트 A 상태에서 질의 + 응답 수신 → 프로젝트 B로 전환 → 대화 스레드가 B context로 전환(A 대화는 History에 보존) → 동일 질의 입력 시 B의 `sourceFilter`/context가 반영되어 다른 응답 수신.
**근거:** handoff §17 core flow #5 "project switch" + §9.4.
**검증 방법:** spec 실행 후 두 응답의 `sources` 배열이 상이함 확인, A 대화가 `/history`에 존재 확인.

#### REQ-LAUNCH-020 (Ubiquitous)
**요구사항:** The system SHALL provide `tests/e2e/i18n.spec.ts` covering: 기본 `ko` locale에서 UI 한국어 렌더(`홈`, `새 상담` 등 FOUNDATION REQ-FND-019 라벨) → locale switcher로 `en` 전환 → UI 영문 렌더 + `<html lang="en">` 속성 변경 + 동일 페이지에서 폰트 `Noto Serif KR` / `Pretendard` 로드 상태 `document.fonts.check()` 검증.
**근거:** handoff §17 i18n + Non-Obvious Constraint #6 (Korean+English dual).
**검증 방법:** `<html>` lang 속성 전환 + `document.fonts.check("16px 'Noto Serif KR'")` true/false 전환 확인.

#### REQ-LAUNCH-021 (Ubiquitous)
**요구사항:** The system SHALL provide `tests/e2e/a11y.spec.ts` that runs `@axe-core/playwright` on the following routes: `/login`, `/`, `/chat`, `/history`, `/dashboard`, `/settings`. Each route SHALL produce **0 violations** at WCAG 2.1 AA level.
**근거:** handoff §17 Accessibility "0 violations on core pages" + ENTERPRISE Phase 5 a11y audit.
**검증 방법:** axe `results.violations.length === 0` for 6 routes.

#### REQ-LAUNCH-022 (Conditional)
**요구사항:** WHEN `pnpm test:e2e` is executed on CI, THEN all specs across all three browsers SHALL pass. For webkit only, flaky failures are allowed up to 1 retry (total `retries: 2` in config, but webkit may use additional flake threshold of 5%).
**근거:** research.md §4.3 flakiness 방지. webkit 실패는 warning only 정책 (리스크 R-05).
**검증 방법:** CI artifact Playwright HTML report 확인 + chromium/firefox는 failed = 0, webkit은 failed ≤ `ceil(total * 0.05)`.

---

### Group C: Load Testing (REQ-LAUNCH-023 ~ 028)

#### REQ-LAUNCH-023 (Ubiquitous)
**요구사항:** The system SHALL provide `tests/load/k6.js` defining two scenarios: `steady_50` (ramping-vus: 0→50 in 2m, steady 5m, ramp-down 1m) AND `spike` (ramping-vus: 0→100 in 30s, steady 1m, ramp-down 30s, startTime 10m).
**근거:** research.md §5.3.
**검증 방법:** k6 script 파싱, `options.scenarios`에 두 키 존재 + stages 배열 검증.

#### REQ-LAUNCH-024 (Ubiquitous)
**요구사항:** The k6 script SHALL define the following thresholds as HARD gates: `http_req_duration{endpoint:consult_first_token}: ['p(95)<1500']`, `http_req_duration{endpoint:consult_full}: ['p(95)<8000']`, `http_req_failed: ['rate<0.01']`.
**근거:** handoff §15 "First answer token ≤ 1.5s after submit" + research.md §5.3.
**검증 방법:** `options.thresholds` 객체에 3개 key 존재 확인.

#### REQ-LAUNCH-025 (Ubiquitous)
**요구사항:** The system SHALL provide `tests/load/k6-mock.js` that points to a MSW-backed mock SSE endpoint, enabling CI smoke runs without consuming Anthropic API quota.
**근거:** research.md §5.4 rate limit 우회 + 리스크 R-02.
**검증 방법:** k6-mock script 존재 + BASE_URL 환경변수가 `http://localhost:3001` (MSW) 기본값 확인.

#### REQ-LAUNCH-026 (Conditional)
**요구사항:** WHEN `pnpm load:staging` is executed against staging environment with a **dedicated load-test Anthropic API key** (separate quota), THEN first-token P95 latency SHALL be ≤ 1500ms AND `http_req_failed` rate SHALL be < 1%.
**근거:** handoff §15 first token + research.md §5.4 전용 key.
**검증 방법:** k6 JSON summary output에서 `metrics.http_req_duration{endpoint:consult_first_token}.values["p(95)"] < 1500` 확인.

#### REQ-LAUNCH-027 (Conditional)
**요구사항:** WHEN `pnpm load:staging` is executed, THEN LCP (Largest Contentful Paint) SHALL remain ≤ 2000ms for any `/` or `/chat` page load sampled during the steady_50 scenario.
**근거:** handoff §15 "LCP ≤ 2.0s on broadband".
**검증 방법:** k6의 `k6/browser` 또는 별도 Lighthouse CI run에서 LCP 값 측정, P95 ≤ 2000 확인.

#### REQ-LAUNCH-028 (Unwanted)
**요구사항:** The load test scripts SHALL NOT hit production URL (`regula.{prod-domain}`) directly. If `BASE_URL` matches the production host regex `/^https:\/\/regula\.(?!staging|preview)/`, the script SHALL abort with an error message "Refusing to load-test production".
**근거:** 운영 환경 보호, handoff §18 staging→production 원칙.
**검증 방법:** k6 script의 early abort 로직 단위 테스트.

---

### Group D: Security Review (REQ-LAUNCH-029 ~ 036)

#### REQ-LAUNCH-029 (Ubiquitous)
**요구사항:** The system SHALL provide `docs/security/owasp-top10-2025.md` containing exactly 10 sections (A01-A10) each with columns: Threat description, Regula mitigation, Implementing Phase (1-5), Phase 6 re-verification method, Status (`mitigated`|`n/a`|`residual`).
**근거:** research.md §6.1.
**검증 방법:** markdown 파싱 후 10 section (H2) 존재 + 각 section 내 5개 컬럼 테이블 확인.

#### REQ-LAUNCH-030 (Ubiquitous)
**요구사항:** The system SHALL provide `tests/integration/audit-immutability.test.ts` that attempts `UPDATE audit_logs SET ... WHERE id = ...`, `DELETE FROM audit_logs WHERE ...`, `TRUNCATE TABLE audit_logs` as the `app_role` user (non-privileged). All three SHALL fail with Postgres error codes (42501 insufficient_privilege OR trigger-raised error). Test SHALL also run the same statements as the `migrations_role` user (privileged) and verify that UPDATE/DELETE/TRUNCATE are still blocked by triggers regardless of role.
**근거:** FOUNDATION REQ-FND-044~044c append-only trigger + handoff §16 21 CFR Part 11 + Non-Obvious Constraint #4 (Audit logging).
**검증 방법:** Vitest integration test에서 3 statement × 2 role = 6 assertion 모두 `throws` 확인.

#### REQ-LAUNCH-031 (Ubiquitous)
**요구사항:** The system SHALL provide `tests/integration/audit-retention.test.ts` that verifies (1) `audit_logs` table has a retention partition strategy (pg_partman or equivalent) configured for 7-year window, (2) `SELECT count(*) FROM information_schema.tables WHERE table_name LIKE 'audit_logs_y%'` returns ≥ 1 partition, (3) the oldest partition creation date matches expected retention baseline.
**근거:** handoff §16 "7-year retention (per FDA expectations)" + Non-Obvious Constraint #4.
**검증 방법:** Vitest integration test + postgres meta-query 결과 검증.

#### REQ-LAUNCH-032 (Conditional)
**요구사항:** WHEN `pnpm audit --audit-level=high` is executed in CI, THEN the exit code SHALL be 0 (no High or Critical severity vulnerabilities in dependencies).
**근거:** handoff §16 Vulnerable Components + research.md §6.1 A06.
**검증 방법:** `.github/workflows/security.yml`의 step 종료 코드 검증, High/Critical 발견 시 CI red.

#### REQ-LAUNCH-033 (Conditional)
**요구사항:** WHEN `gitleaks detect --source . --no-git` is executed on CI, THEN 0 secrets SHALL be detected. The repository SHALL include `.gitleaks.toml` with project-specific allowlist rules (e.g., `.env.example` placeholders).
**근거:** research.md §6.1 A02 + 리스크 R-06.
**검증 방법:** `.github/workflows/security.yml` 내 gitleaks step green + `.gitleaks.toml` 존재 확인.

#### REQ-LAUNCH-034 (Ubiquitous)
**요구사항:** The system's production deployment SHALL return the following HTTP headers on every response: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `Content-Security-Policy` (nonce-based, no `unsafe-inline` for script-src), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/microphone/geolocation all disabled).
**근거:** handoff §16 Headers + research.md §7.2 vercel.json.
**검증 방법:** Playwright smoke test에서 `page.waitForResponse('/')` 후 `response.headers()` 검증. Mozilla Observatory 외부 스캔 ≥ A 등급 스크린샷 첨부.

#### REQ-LAUNCH-035 (Ubiquitous)
**요구사항:** The system SHALL configure Anthropic SDK to use **zero-data-retention (ZDR) mode** via the enterprise API endpoint OR the `anthropic-beta: zero-retention` header (whichever is current as of deployment). The configuration SHALL be set only via `ANTHROPIC_API_KEY` pointing to the ZDR-enabled enterprise key.
**근거:** handoff §16 "Use Anthropic's zero-data-retention mode via enterprise API".
**검증 방법:** `lib/llm/anthropic-client.ts` (또는 Phase 2 파일) 코드 검사로 ZDR 설정 확인. Anthropic enterprise dashboard에서 key의 ZDR flag `enabled` 스크린샷.

#### REQ-LAUNCH-036 (Unwanted)
**요구사항:** The system SHALL NOT log request bodies containing question text or answer text to Sentry, datadog, or any general-purpose APM. Sensitive fields SHALL be redacted via Sentry `beforeSend` hook. Allowed in general logs: request id, user id (hashed), latency, status code, error code. Full bodies SHALL exist only in `audit_logs` and Langfuse traces (both with access control).
**근거:** handoff §16 "log all data-access events" + data segregation 원칙.
**검증 방법:** `sentry.server.config.ts` 내 `beforeSend` redaction 로직 단위 테스트. 의도적 질의 text를 Sentry에 전송하는 테스트에서 captured event payload가 redacted 확인.

---

### Group E: Production Deployment (REQ-LAUNCH-037 ~ 043)

#### REQ-LAUNCH-037 (Ubiquitous)
**요구사항:** The system SHALL provide `vercel.json` declaring: `regions: ["iad1"]` (Phase 6 런치), `functions."app/api/ra/consult/route.ts": {"maxDuration": 60}`, `functions."app/api/admin/ingest/*/route.ts": {"maxDuration": 300}`, and HSTS header per REQ-LAUNCH-034.
**근거:** research.md §7.2.
**검증 방법:** `vercel.json` 파싱, regions 배열 = `["iad1"]`, functions maxDuration 값 일치 확인.

#### REQ-LAUNCH-038 (Ubiquitous)
**요구사항:** The route `app/api/ra/consult/route.ts` SHALL export `export const runtime = 'nodejs'` (not `edge`), due to pgvector query + long SSE stream requirements.
**근거:** research.md §7.1 Edge runtime 제약.
**검증 방법:** 파일 내 `runtime` 상수 값 확인.

#### REQ-LAUNCH-039 (Ubiquitous)
**요구사항:** The system SHALL provide `docs/deployment/env-matrix.md` listing every environment variable across 3 environments (dev / preview / production) with columns: name, required?, example/placeholder, rotation policy. The file SHALL list at minimum: `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, `AUTH_MICROSOFT_ID`, `AUTH_MICROSOFT_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ANTHROPIC_API_KEY`, `ANTHROPIC_API_KEY_EVAL`, `COHERE_API_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`.
**근거:** research.md §7.4 + FOUNDATION REQ-FND-007.
**검증 방법:** markdown table 파싱, 16개 env 변수 포함 + 각 환경별 컬럼 존재 확인.

#### REQ-LAUNCH-040 (Ubiquitous) [v0.2.0 H9 확장]
**요구사항:** The system SHALL provide `scripts/preflight.sh` executing this exact ordered pipeline:

**Core build/test gates (1-9):**
1. `pnpm biome check`
2. `pnpm typecheck`
3. `pnpm test:unit`
4. `pnpm test:integration`
5. `pnpm test:e2e --project=chromium` (smoke)
6. `pnpm eval:ci`
7. `pnpm audit --audit-level=high`
8. `gitleaks detect --no-git`
9. `pnpm build`

**Phase 5 ENTERPRISE CI gates (10-17, v0.2.0 H9 추가):** ENTERPRISE-001의 13 automation gates 중 preflight 재실행 대상 8개를 여기 편입하여 Phase 6 런치 시점 regression 방지:
10. `pnpm tokens:check` — design tokens symmetry (ENTERPRISE REQ-ENTERPRISE-044 light/dark 토큰 매핑 검증)
11. `pnpm modules:check` — module boundaries (ENTERPRISE audit/analytics 모듈 분리 정책, REQ-ENTERPRISE-066~073)
12. `pnpm contrast:check` — WCAG 2.1 AA color contrast (ENTERPRISE REQ-ENTERPRISE-062)
13. `pnpm i18n:check` — ko/en dictionary key symmetry (ENTERPRISE REQ-ENTERPRISE-047)
14. `pnpm i18n:hardcoded-check` — Korean unicode block hardcoded string detection (ENTERPRISE risk R4)
15. `pnpm a11y` — axe-core static check (ENTERPRISE REQ-ENTERPRISE-056~065)
16. `pnpm rbac:check` — all Route Handlers wrapped with `withPermission` (ENTERPRISE REQ-ENTERPRISE-024)
17. `pnpm audit:check` — all POST/PATCH/DELETE/PUT handlers have writeAudit call-site + no PII keys (ENTERPRISE REQ-ENTERPRISE-032/033)

Any step failure SHALL abort with non-zero exit code and print the failing step name. Steps 10-17이 ENTERPRISE Phase 5 완료 시점과 Phase 6 런치 시점 사이의 환경/의존성 drift를 잡아낸다 — Phase 5에서 통과했더라도 Phase 6 런치 직전에 regression이 발생하면 preflight이 block한다.

**남은 Phase 5 gates (ENTERPRISE 13 중 5개는 별도 실행):** `pnpm test:e2e`(Step 5로 대체), `pnpm test:a11y`(Step 15 axe-core와 중복), `pnpm eval:ci`(Step 6), `pnpm storybook:build`(런치 빌드 의존성), `pnpm test:visual`(Phase 6 범위 외, Post-launch). 이 5개는 preflight 편입 대신 CI 별도 job에서 실행(H9 스코프).

**근거:** handoff §18 CI/CD + research.md §9 + cross-spec-audit H9 (ENTERPRISE 13 CI gates가 LAUNCH preflight에서 재실행되지 않으면 Phase 5→6 전환 window에서 regression 가능성).
**검증 방법:** shell script 실행 권한 + 의도적 failure 주입 시 해당 step에서 abort 확인. 17개 step 전원 green으로 성공 시 exit 0. ENTERPRISE 13 gates 전원이 preflight 또는 CI job 중 어느 한 곳에 매핑되어 있는지 cross-reference 검증(ENTERPRISE spec.md §577-586 gate list vs 이 REQ의 step list).

#### REQ-LAUNCH-041 (Conditional)
**요구사항:** WHEN a production deployment is triggered via `vercel --prod` or Vercel Git integration production branch push, THEN GitHub environment `production` rule SHALL require manual approval from at least 1 designated reviewer (QA lead OR Compliance lead OR Product owner) before the deployment proceeds.
**근거:** research.md §9.2 Deployment Gate + Launch Readiness Gate §11.2.
**검증 방법:** GitHub repo Settings → Environments → production → Required reviewers 설정 스크린샷 + `.github/CODEOWNERS` 검증.

#### REQ-LAUNCH-042 (Ubiquitous)
**요구사항:** The `docs/runbook.md` SHALL include an operational rollback procedure with exact commands: (1) `vercel rollback` from Vercel CLI with previous deployment URL, (2) Drizzle migration down for the last migration via `pnpm drizzle-kit down --steps=1` if schema rollback required, (3) Feature flag kill switch via Vercel Flags API, (4) estimated rollback time ≤ 5 minutes.
**근거:** handoff §18 Rollback + research.md §9.3.
**검증 방법:** runbook.md 파싱, 4개 subsection 존재 + 각 명령 코드블록 확인.

#### REQ-LAUNCH-043 (Conditional)
**요구사항:** WHEN a production deployment completes, THEN the post-deploy smoke script SHALL verify within 60 seconds: (1) `curl -sI https://regula.{domain}/` returns HTTP 200 + `x-robots-tag: noindex, nofollow`, (2) `curl -sI https://regula.{domain}/login` returns HTTP 200 without noindex, (3) `curl https://regula.{domain}/api/health` returns `{status: "ok", git_sha: "<matching deployed SHA>"}`.
**근거:** Non-Obvious Constraint #7 (noindex 검증) + 배포 성공 증명.
**검증 방법:** `scripts/post-deploy-smoke.sh` 실행 결과 exit 0 확인, 각 assertion 로그 출력.

---

### Group F: Documentation (REQ-LAUNCH-044 ~ 048)

#### REQ-LAUNCH-044 (Ubiquitous)
**요구사항:** The system SHALL extend `DEVELOPMENT.md` (established by FOUNDATION REQ-FND-060) to contain **exactly 8 sections in this order**: (1) Prerequisites, (2) Setup, (3) Development workflow, (4) Testing, (5) Deployment, (6) Troubleshooting, (7) Architecture overview, (8) Compliance overview. Each new section (6-8) SHALL be ≥ 30 lines of prose + code examples.
**근거:** FOUNDATION REQ-FND-060 5 섹션 기반 + research.md §10.1.
**검증 방법:** markdown H2 heading 추출, 8개 제목 정확 일치 확인 + 각 section line count 검증.

#### REQ-LAUNCH-045 (Ubiquitous)
**요구사항:** The system SHALL provide `README.md` (at repo root) targeted at external users and RA leads, containing: product introduction (≤ 200 words), screenshot or demo GIF reference, top 5 features (bullets), supported regulatory corpora list (FDA, EU MDR, MFDS, NMPA, PMDA, internal SOP), minimum 1 link to `DEVELOPMENT.md`.
**근거:** research.md §10.2.
**검증 방법:** README.md 파싱, 5개 기능 bullet + corpora 목록 + DEVELOPMENT.md 링크 존재 확인.

#### REQ-LAUNCH-046 (Ubiquitous)
**요구사항:** The system SHALL provide `docs/architecture.md` containing at least one mermaid system diagram (`graph TD` or `graph LR`) illustrating data flow from user query → Next.js Route Handler → LLM classifier (Haiku) → retrieval (pgvector + FTS) → re-ranker → Sonnet → post-processing → streaming response → audit log, plus one mermaid `sequenceDiagram` for expert review gating flow.
**근거:** research.md §10.2 + handoff §11.1 backend pipeline.
**검증 방법:** markdown 내 ```mermaid 코드 펜스 ≥ 2개 + `graph` 또는 `sequenceDiagram` 키워드 포함 확인.

#### REQ-LAUNCH-047 (Ubiquitous)
**요구사항:** The system SHALL provide `docs/runbook.md` covering: (1) On-call schedule link/placeholder, (2) Incident response 4 severity levels (SEV-1 regulatory/security incident, SEV-2 full outage, SEV-3 partial degradation, SEV-4 minor), (3) Paging targets per severity, (4) Common failure modes (Anthropic outage, Neon connection exhaustion, ingest queue backlog) with remediation, (5) Rollback procedure (REQ-LAUNCH-042 reference), (6) Post-mortem template link.
**근거:** research.md §10.2 + handoff §18 Monitoring.
**검증 방법:** markdown H2 6 section 존재 확인.

#### REQ-LAUNCH-048 (Ubiquitous)
**요구사항:** The system SHALL provide `docs/compliance.md` summarizing 21 CFR Part 11 adherence with at least: (1) audit_logs schema (link to FOUNDATION spec), (2) append-only enforcement (trigger + role separation + REQ-LAUNCH-030 test reference), (3) 7-year retention (REQ-LAUNCH-031 test reference), (4) electronic signatures status (Post-launch, per FOUNDATION v0.3.0 decision), (5) data residency policy (US-only at launch, EU region config prepared for Post-launch), (6) access control (RBAC per ENTERPRISE Phase 5), (7) zero-data-retention mode (REQ-LAUNCH-035 reference).
**근거:** research.md §10.2 + handoff §16 + Non-Obvious Constraint #4.
**검증 방법:** markdown H2 7 section 존재 + 각 section 내 관련 REQ ID 교차 참조 확인.

---

## 비-기능 요구사항 재확인 (Non-Functional Carry-Over)

Phase 6은 신규 NFR을 도입하지 않고, 이전 Phase에서 수립한 NFR을 **런치 시점 기준으로 재검증**한다. 아래 표는 어느 REQ가 어느 NFR를 검증하는지 매핑한다.

| NFR 범주 | 목표값 | 출처 Phase | Phase 6 재검증 REQ |
|---|---|---|---|
| LCP | ≤ 2.0s | handoff §15 | REQ-LAUNCH-027 |
| INP | ≤ 200ms | handoff §15 | Playwright a11y spec에서 Web Vitals 측정 (REQ-LAUNCH-021 확장) |
| CLS | ≤ 0.05 | handoff §15 | 위와 동일 |
| First answer token | ≤ 1.5s | handoff §15 | REQ-LAUNCH-024, 026 |
| Citation coverage | 100% | Non-Obvious #1 | REQ-LAUNCH-006, 009 |
| Expert review recall | 100% on trap/halluc. | Non-Obvious #3 | REQ-LAUNCH-008, 009 |
| Hallucination rate | ≤ 2% | research §3.2 | REQ-LAUNCH-007, 009 |
| Confidence Brier | ≤ 0.15 | research §3.3 | REQ-LAUNCH-010 |
| Audit append-only | UPDATE/DELETE/TRUNCATE fail | FOUNDATION REQ-FND-044* | REQ-LAUNCH-030 |
| Audit retention | 7 years | handoff §16 | REQ-LAUNCH-031 |
| WCAG 2.1 AA | 0 violation on 6 routes | handoff §17 | REQ-LAUNCH-021 |
| OWASP Top 10 | all mitigated/N/A | handoff §16 | REQ-LAUNCH-029, 032, 033, 034, 036 |
| ZDR mode | enabled | handoff §16 | REQ-LAUNCH-035 |
| noindex on app shell | enforced | Non-Obvious #7 | REQ-LAUNCH-015, 043 |
| Serif 타이포 | applied 5 contexts | Non-Obvious #5 | REQ-LAUNCH-021 (axe custom check extension) |
| 한영 이중 폰트 | both loaded | Non-Obvious #6 | REQ-LAUNCH-020 |

---

## Non-Obvious Constraints 매트릭스 (Phase 6 재검증)

CLAUDE.md 명시 7개 Non-Obvious Constraints는 Phase 6에서 **전부 자동 테스트로 재검증**된다.

| # | 제약 | Phase 6 검증 REQ | 검증 방식 |
|---|---|---|---|
| 1 | Citation 100% 강제 | REQ-LAUNCH-006, 009 | eval scorer + CI gate |
| 2 | Multi-phase streaming | REQ-LAUNCH-016 | E2E SSE event 7종 수신 검증 |
| 3 | Expert review auto-flagging | REQ-LAUNCH-008, 018 | eval scorer + E2E |
| 4 | Audit logging | REQ-LAUNCH-030, 031 | integration test (정적 + 동적) |
| 5 | Serif/sans 타이포 | REQ-LAUNCH-021 확장 | axe custom check: computed font-family includes Source Serif 4 |
| 6 | Korean + English 이중 | REQ-LAUNCH-020 | E2E document.fonts.check() |
| 7 | noindex 전역 | REQ-LAUNCH-015, 043 | E2E + post-deploy smoke |

---

## Launch Readiness Checklist

Phase 6 완료 = **6개 범주 25 항목 100% 통과** = production deploy 승인 조건. 각 항목은 위 REQ-LAUNCH-NNN 또는 이전 Phase 산출물로 뒷받침된다.

### Category 1: Functional Readiness (5 items)

- [ ] LR-F-01: 5개 core E2E flow (auth, consultation, citation-click, expert-review, project-switch) 모두 green on Chromium + Firefox (REQ-LAUNCH-015~019)
- [ ] LR-F-02: Webkit E2E pass rate ≥ 95% (REQ-LAUNCH-022)
- [ ] LR-F-03: i18n spec ko↔en 전환 green + Noto Serif KR/Pretendard 폰트 로드 확인 (REQ-LAUNCH-020)
- [ ] LR-F-04: Expert review flow (UI 표시 + ticket 생성 + 리드 큐 표시) green (REQ-LAUNCH-018)
- [ ] LR-F-05: Citation 클릭 → DocViewer 딥링크(`#source={id}&offset={N}`) 작동 (REQ-LAUNCH-017)

### Category 2: Quality Readiness (5 items)

- [ ] LR-Q-01: Unit test coverage ≥ 80% (handoff §17 + FOUNDATION Phase 1 테스트 인프라 계승)
- [ ] LR-Q-02: Integration test 100% green (MSW-backed API route tests)
- [ ] LR-Q-03: Playwright a11y spec 0 violation at WCAG 2.1 AA on 6 routes (REQ-LAUNCH-021)
- [ ] LR-Q-04: Biome check 0 error (FOUNDATION 계승)
- [ ] LR-Q-05: TypeScript strict mode typecheck 0 error (FOUNDATION REQ-FND-009 계승)

### Category 3: LLM Readiness (5 items)

- [ ] LR-L-01: Eval 55 scenario citation coverage = 100% (REQ-LAUNCH-006, 009)
- [ ] LR-L-02: Eval hallucination rate ≤ 2% (REQ-LAUNCH-007, 009)
- [ ] LR-L-03: Eval expert-review gating recall = 100% on trap/hallucination (REQ-LAUNCH-008)
- [ ] LR-L-04: Confidence calibration Brier ≤ 0.15 (REQ-LAUNCH-010)
- [ ] LR-L-05: `tests/eval/datasets/REVIEWED.md`에 RA 리드 서명 존재, 30일 이내 (REQ-LAUNCH-005)

### Category 4: Performance Readiness (4 items)

- [ ] LR-P-01: LCP ≤ 2.0s in staging load test sampling (REQ-LAUNCH-027)
- [ ] LR-P-02: First token P95 ≤ 1.5s @ 50 VU steady (REQ-LAUNCH-024, 026)
- [ ] LR-P-03: Full response P95 ≤ 8s @ 50 VU steady (REQ-LAUNCH-024)
- [ ] LR-P-04: Error rate `http_req_failed` < 1% during load test (REQ-LAUNCH-024, 026)

### Category 5: Security Readiness (4 items)

- [ ] LR-S-01: OWASP Top 10 2025 all 10 categories status = `mitigated` or `n/a` (REQ-LAUNCH-029)
- [ ] LR-S-02: `pnpm audit` 0 High + 0 Critical (REQ-LAUNCH-032)
- [ ] LR-S-03: gitleaks 0 detection + `.gitleaks.toml` allowlist 적용 (REQ-LAUNCH-033)
- [ ] LR-S-04: Audit immutability + retention test green (REQ-LAUNCH-030, 031)

### Category 6: Operational Readiness (2 items)

- [ ] LR-O-01: runbook.md 6 section 작성 완료 + on-call 교대 설정 + Sentry/Langfuse 알림 라우팅 확인 (REQ-LAUNCH-047)
- [ ] LR-O-02: Mozilla Observatory 외부 스캔 등급 ≥ A + 스크린샷 첨부 (REQ-LAUNCH-034)

### Go/No-Go 결정권자

- **Go** 승인에 필요: QA lead + Compliance lead + Product owner 3인 만장일치
- **No-Go**: 1인이라도 거부하면 차기 이터레이션으로 연기 (해당 LR-* 항목 red 해소 후 재승인)

---

## 리스크 레지스터 (Phase 6 집중)

| ID | 리스크 | 영향 | 확률 | 대응 | 관련 REQ |
|---|---|---|---|---|---|
| R-P6-01 | Eval 데이터셋 정답 품질 부정확 → 사일런트 regression | High | Med | RA 리드 검수 + 6개월 재검수 주기 + REVIEWED.md 서명 필수 | REQ-LAUNCH-005 |
| R-P6-02 | Load test에서 Anthropic API rate limit hit | Med | High | 전용 load test API key + MSW mock mode + `ANTHROPIC_API_KEY_EVAL` 분리 | REQ-LAUNCH-012, 025, 026 |
| R-P6-03 | Vercel Edge runtime의 pgvector 비호환으로 consult 경로 장애 | Med | Low | `consult/route.ts`에 `runtime = 'nodejs'` 강제 | REQ-LAUNCH-038 |
| R-P6-04 | Neon prod DB migration 순서 오류로 downtime | High | Low | Neon branch dry-run → 성공 시 prod apply + rollback 절차 runbook 명시 | REQ-LAUNCH-042 |
| R-P6-05 | Playwright webkit flakiness | Low | Med | webkit 실패 warning only 정책, Chromium+Firefox 필수 pass | REQ-LAUNCH-022 |
| R-P6-06 | 시크릿 commit 누락 | Critical | Low | gitleaks CI + pre-commit hook + `.gitleaks.toml` allowlist | REQ-LAUNCH-033 |
| R-P6-07 | 배포 후 citation coverage 실측 < 98% (운영 환경 regression) | High | Med | Langfuse 대시보드 상시 모니터링 + 자동 alert + runbook SEV-1 처리 | REQ-LAUNCH-047 |
| R-P6-08 | DB provider (Neon) 확정 지연 → Phase 6 착수 블록 | High | Med | Phase 5 closing 2주 전 Neon 계약 체결 | Technical Decision #4 |
| R-P6-09 | Anthropic ZDR 모드 설정 누락 | Critical | Low | REQ-LAUNCH-035 + enterprise dashboard 스크린샷 증빙 | REQ-LAUNCH-035 |
| R-P6-10 | 런치 후 OWASP A04(Insecure Design) 이슈 발견 (threat model 부실) | Med | Low | `docs/security/threat-model.md` 작성 + Phase 6 내 `regula-architect` 리뷰 | REQ-LAUNCH-029 |

---

## Phase 6 완료 조건 요약

본 SPEC은 다음 4가지 최종 조건이 모두 성립할 때만 **status = ready-to-launch**로 전환된다:

1. **48개 REQ-LAUNCH 전부 green** (CI + integration + E2E)
2. **Launch Readiness Checklist 25항목 전부 [x]** (6 categories)
3. **Non-Obvious Constraints 7항목 자동 검증 모두 pass**
4. **Go 결정권자 3인 만장일치 승인** (QA lead + Compliance lead + Product owner)

위 조건 중 하나라도 미충족 시, Phase 6은 추가 이터레이션(SPEC v0.2.0+)으로 진행되며 production deploy는 블록된다.

---

## 수용 기준 (Definition of Done)

- [ ] 48개 REQ-LAUNCH 모두 정의 + 각각 testable verification 명시
- [ ] 6개 technical decision 명시 + 탈락안 + 근거 + 재평가 조건
- [ ] launch_readiness_checklist 25 항목 6 category 구성
- [ ] Non-Obvious Constraints 7 항목 전원 재검증 매핑 테이블
- [ ] Out of Scope 12+ 항목 명시 + 이관 위치 + 사유
- [ ] 5개 이전 Phase (FOUNDATION/CHAT/STRUCTURED/BREADTH/ENTERPRISE) 전원 `depends_on` 참조
- [ ] research.md에 데이터셋 구성 전략 + 도구 비교 + 리스크 포함

---

## Pending Cross-Audit Findings (v0.2.0)

cross-spec-audit.md(2026-04-22)의 High findings 중 본 iteration에서 해소되지 않고 후속 Wave 또는 Phase 6 kickoff에서 추적할 항목.

| ID | 요약 | 추적 상태 |
|---|---|---|
| H1 | ENTERPRISE "E2E 전체 스위트" defer가 LAUNCH REQ-LAUNCH-015~021 7 core flows만 커버 | Phase 6 kickoff에서 추가 spec files 확장 여부 결정 (history/templates/knowledge-base/updates/dashboard/onboarding flows) 또는 ENTERPRISE spec의 "전체" 문구 narrow로 조정 |
| H2 | VPAT 공식 문서 LAUNCH REQ 부재 (ENTERPRISE가 Phase 6 이월) | Phase 6 kickoff에서 VPAT draft 작성 REQ 추가 여부 결정 |
| H3 | Feature flag 시스템 LAUNCH REQ 부재 (rollback runbook 참조만 존재) | Phase 6 kickoff에서 Vercel Flags vendor selection + 최소 1개 flag(expert review rollout) 도입 여부 결정 |
| H8 | first-token P95 ≤ 1.5s SLO가 Phase 4 multi-corpus + rerank + Haiku classify 누적 시 무효화 가능성 — REQ-LAUNCH-024 실측 기반 상향 조정 필요 | Phase 6 load test 실측 후 REQ-LAUNCH-024 SLO 재설정 (예: 2.5-3.0s) 또는 retrieval slice 재최적화 |
| M5 | single-corpus 650 chunks 벤치마크가 Phase 4 5000+ chunks 환경에 불충분 | H8와 함께 load test 실측 기반 재평가 |
| M6 | In-memory rate limit (CHAT REQ-CHAT-007)이 50 VU load test에서 per-function-instance scope로 masked 가능성 | REQ-LAUNCH-023 caveat 추가 또는 Post-launch Redis 전환 |
| M8 | ENTERPRISE a11y 단일 browser vs LAUNCH 3 browser matrix alignment | Phase 6 kickoff에서 browser matrix 정렬 |

기타 Medium/Low findings는 Phase 6 kickoff 또는 Post-launch에서 개별 결정.

---

## 부록 A: 이전 Phase 의존성 상세 매핑

Phase 6의 각 REQ-LAUNCH는 특정 이전 Phase 산출물이 **정상 동작 중**임을 전제로 한다. 아래 표는 의존성 역추적에 필요한 연결 지도이다.

### A.1 FOUNDATION → LAUNCH 의존성

| FOUNDATION REQ | 기능 | LAUNCH에서 의존하는 REQ |
|---|---|---|
| REQ-FND-005 | Playwright devDependency | REQ-LAUNCH-013 (추가 `@axe-core/playwright` 확장) |
| REQ-FND-007 | `.env.example` 필수 env | REQ-LAUNCH-039 (env matrix 전부 포함) |
| REQ-FND-009 | `pnpm typecheck` green | REQ-LAUNCH-040 preflight step 2 |
| REQ-FND-010 | `pnpm build` green | REQ-LAUNCH-040 preflight step 9 |
| REQ-FND-010a | `lib/env.ts` zod fail-fast | REQ-LAUNCH-039 (ANTHROPIC_API_KEY_EVAL 등 추가 변수 zod schema 확장 필요) |
| REQ-FND-014 | `(app)` noindex metadata | REQ-LAUNCH-015, 043 (런치 시 실제 응답 검증) |
| REQ-FND-018 | `/login` noindex override | REQ-LAUNCH-015, 043 |
| REQ-FND-019 | Sidebar 8 한국어 라벨 | REQ-LAUNCH-020 (i18n 전환 검증) |
| REQ-FND-023 | `--font-serif` 순서 | REQ-LAUNCH-021 (axe custom: computed font-family Source Serif 4 포함) |
| REQ-FND-024 | `--font-sans` Pretendard 포함 | REQ-LAUNCH-020 (document.fonts.check()) |
| REQ-FND-044~044c | audit_logs INSERT-only 트리거 | REQ-LAUNCH-030 (UPDATE/DELETE/TRUNCATE fail 검증) |
| REQ-FND-060 | DEVELOPMENT.md 5 섹션 | REQ-LAUNCH-044 (8 섹션으로 확장) |

### A.2 CHAT (Phase 2) → LAUNCH 의존성

- CHAT Phase 2에서 구현된 `lib/rag/citation-parser.ts` (또는 동등 경로): REQ-LAUNCH-006 이 scorer에서 import
- CHAT Phase 2 `/api/ra/consult` SSE 핸들러: REQ-LAUNCH-016, 023, 026 의 대상 엔드포인트
- CHAT Phase 2 `useStreamingAnswer` 훅이 emit하는 SSE event type 7종: REQ-LAUNCH-016 이 검증
- CHAT Phase 2 confidence 계산 로직: REQ-LAUNCH-010 calibration 측정 대상
- CHAT Phase 2 `expert_review_required` event emit 조건 (confidence < 0.70 등): REQ-LAUNCH-008, 018 의 전제

### A.3 STRUCTURED (Phase 3) → LAUNCH 의존성

- STRUCTURED Phase 3의 `message_blocks` 6 block_type(`prose|checklist|comparison|timeline|sources|related`) 렌더링: REQ-LAUNCH-016 에서 E2E 검증
- STRUCTURED Phase 3의 `RightContextPanel` 및 `DocViewer` 컴포넌트: REQ-LAUNCH-017 citation-click spec 의 대상
- STRUCTURED Phase 3의 `Suggested follow-ups` (related block): eval scenario 중 multi-turn 시나리오에서 간접 검증

### A.4 BREADTH (Phase 4) → LAUNCH 의존성

- BREADTH Phase 4의 5 규제 corpora 적재(FDA/EU MDR/MFDS/NMPA/PMDA): REQ-LAUNCH-003 55 시나리오 실행의 전제 (corpora 미적재 시 eval 자동 fail)
- BREADTH Phase 4의 `History`/`Templates`/`Knowledge Base`/`Updates`/`Dashboard` 페이지: REQ-LAUNCH-021 a11y spec 의 대상 routes
- BREADTH Phase 4의 프로젝트 전환 기능: REQ-LAUNCH-019 project-switch spec 의 대상

### A.5 ENTERPRISE (Phase 5) → LAUNCH 의존성

- ENTERPRISE Phase 5의 Expert review workflow API + 리드 큐 UI: REQ-LAUNCH-018 의 대상
- ENTERPRISE Phase 5의 RBAC 세분화 + org/project ACL: REQ-LAUNCH-029 (OWASP A01) 매핑의 근거
- ENTERPRISE Phase 5의 Sentry/PostHog/Langfuse 통합: REQ-LAUNCH-011 Langfuse 업로드, REQ-LAUNCH-036 Sentry redaction, REQ-LAUNCH-047 runbook 알림 라우팅의 전제
- ENTERPRISE Phase 5의 a11y 감사 결과: REQ-LAUNCH-021 에서 재검증 (0 violation 유지)
- ENTERPRISE Phase 5의 i18n 런타임 스위처: REQ-LAUNCH-020 의 대상

### A.6 의존성 실패 시나리오

만약 이전 Phase의 산출물이 **퇴행**(regression)한 상태에서 Phase 6이 시작되면, 본 SPEC은 다음 행동을 규정한다:

1. **탐지**: preflight.sh(REQ-LAUNCH-040) 실행 중 typecheck 또는 build 또는 integration test가 failure → 이전 Phase 회귀 의심
2. **격리**: 해당 Phase 의 spec.md를 `status: needs-regression-fix`로 수동 전환 후 별도 fix SPEC 발행
3. **복구**: fix SPEC 완료 → 해당 Phase spec.md `status: ready-for-launch-revalidation`으로 복원 → Phase 6 재시작
4. **Phase 6은 이전 Phase 수정을 하지 않는다**: 본 SPEC의 Out of Scope 원칙에 따라, 본 Phase에서 FOUNDATION/CHAT/STRUCTURED/BREADTH/ENTERPRISE의 REQ는 수정하지 않는다

---

## 부록 B: Eval Scenario 상세 예시

REQ-LAUNCH-004 명시한 필드 구조의 실제 예시. 실제 `tests/eval/datasets/*.yaml` 작성 시 이 템플릿을 준수한다.

### B.1 Lookup 카테고리 (정답 존재, 고 confidence 기대)

```yaml
# tests/eval/datasets/fda.yaml (발췌)
tests:
  - id: FDA-001
    category: lookup
    description: "21 CFR 820.30 design controls 핵심 요구사항"
    input: "21 CFR 820.30 design controls의 핵심 요구사항 5가지를 알려주세요."
    locale: ko
    expected:
      must_include_citations:
        - source_id: fda-21cfr-820
          section: "820.30(a)"
        - source_id: fda-21cfr-820
          section: "820.30(d)"
      must_not_include:
        - "§820.99"     # 존재하지 않는 섹션
        - "fabricated"
      confidence_min: 0.80
      expert_review_required: false
      block_types_expected: [prose, checklist, sources]
      faithfulness_min: 0.90
    rubric: |
      The answer must correctly list at least 5 distinct items
      from 820.30 subsections (a)-(j), each with a citation.
```

### B.2 Comparison 카테고리 (ComparisonTable 블록 기대)

```yaml
  - id: CMP-001
    category: comparison
    description: "FDA 510(k) vs EU MDR Class IIb 기술문서"
    input: "Compare the technical documentation requirements for FDA 510(k) vs EU MDR Class IIb."
    locale: en
    expected:
      must_include_citations:
        - source_id: fda-510k-guidance
          section: "*"
        - source_id: eu-mdr-2017-745
          section: "Annex II"
      must_not_include:
        - "identical"   # false equivalence
      confidence_min: 0.75
      expert_review_required: false
      block_types_expected: [prose, comparison, sources]
      comparison_rows_min: 5    # custom scorer extension
```

### B.3 Trap 카테고리 (false premise, 저 confidence + expert review 기대)

```yaml
  - id: TRAP-001
    category: trap
    description: "21 CFR Part 11이 EU MDR에 적용되는지"
    input: "21 CFR Part 11이 EU MDR 규정에도 동일하게 적용되나요?"
    locale: ko
    expected:
      must_not_include:
        - "동일하게 적용"   # false premise를 수용하면 실패
        - "identical application"
      must_include_keywords:    # 정정 응답 요구
        - "21 CFR Part 11"
        - "FDA"
        - "EU MDR"
        - "별도"    # distinction
      confidence_min: 0.30      # 하한
      confidence_max: 0.65      # 상한 (저 confidence 필수)
      expert_review_required: true
      block_types_expected: [prose, sources]
```

### B.4 Hallucination 카테고리 (존재하지 않는 문서)

```yaml
  - id: HAL-001
    category: hallucination
    description: "존재하지 않는 FDA 가이던스 질의"
    input: "FDA guidance Q-Sub 2029의 핵심 내용을 요약해주세요."
    locale: ko
    expected:
      must_not_include:
        - "Q-Sub 2029"    # 존재하지 않는 문서 인용 시 실패
      must_include_keywords:
        - "해당 문서"
        - "찾을 수 없"
      confidence_min: 0.0
      confidence_max: 0.50
      expert_review_required: true
      block_types_expected: [prose]
```

### B.5 Korean 카테고리 (한국어 citation + 한국어 UI 렌더)

```yaml
  - id: KOR-001
    category: korean
    description: "의료기기법 제6조 요약"
    input: "의료기기법 제6조의 내용을 요약해주세요."
    locale: ko
    expected:
      must_include_citations:
        - source_id: mfds-medical-device-act
          section: "제6조"
      confidence_min: 0.80
      expert_review_required: false
      block_types_expected: [prose, sources]
      font_check:    # custom scorer: serif/sans Korean
        requires_korean_font_loaded: true
```

---

## 부록 C: CI 파이프라인 구성

본 SPEC REQ 들이 참조하는 GitHub Actions 파일의 상위 구조. 상세 YAML은 `.github/workflows/`에 구현된다.

### C.1 ci.yml (PR 및 main push 트리거)

```yaml
name: CI
on: [pull_request, push]
jobs:
  lint:           # REQ-LAUNCH-040 step 1
    runs-on: ubuntu-latest
    steps: [pnpm install --frozen-lockfile, pnpm biome check]
  typecheck:      # REQ-LAUNCH-040 step 2 + FOUNDATION REQ-FND-009
    runs-on: ubuntu-latest
    steps: [pnpm typecheck]
  unit:           # REQ-LAUNCH-040 step 3 + LR-Q-01
    runs-on: ubuntu-latest
    steps: [pnpm test:unit --coverage]
    outputs: { coverage-pct: ${{ steps.coverage.outputs.pct }} }
  integration:    # REQ-LAUNCH-030, 031 + REQ-LAUNCH-040 step 4
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
    steps: [pnpm test:integration]
  e2e:            # REQ-LAUNCH-022 + LR-F-01, LR-F-02
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]
    runs-on: ubuntu-latest
    steps:
      - run: pnpm playwright test --project=${{ matrix.browser }}
  eval:           # REQ-LAUNCH-009, 012 + LR-L-01..04
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY_EVAL }}
    steps: [pnpm eval:ci]
  build:          # REQ-LAUNCH-040 step 9 + FOUNDATION REQ-FND-010
    needs: [lint, typecheck, unit, integration]
    runs-on: ubuntu-latest
    steps: [pnpm build]
```

### C.2 security.yml (별도 트리거, push + scheduled weekly)

```yaml
name: Security
on:
  push: { branches: [main] }
  schedule: [{ cron: '0 3 * * 1' }]   # 매주 월요일 03:00 UTC
jobs:
  audit:          # REQ-LAUNCH-032
    runs-on: ubuntu-latest
    steps: [pnpm install --frozen-lockfile, pnpm audit --audit-level=high]
  gitleaks:       # REQ-LAUNCH-033
    runs-on: ubuntu-latest
    steps:
      - uses: gitleaks/gitleaks-action@v2
        with: { config-path: .gitleaks.toml }
```

### C.3 load.yml (manual_dispatch + pre-release 트리거)

```yaml
name: Load Test
on: workflow_dispatch
jobs:
  k6:             # REQ-LAUNCH-026
    runs-on: ubuntu-latest
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY_LOAD }}
      BASE_URL: https://regula-staging.{domain}
    steps:
      - uses: grafana/setup-k6-action@v1
      - run: k6 run tests/load/k6.js --out json=tests/load/reports/$(date +%s).json
```

---

## 부록 D: Data Flow Diagram (텍스트 스케치)

REQ-LAUNCH-046 에서 `docs/architecture.md`에 작성될 mermaid 다이어그램의 기반 내용. 실제 mermaid 코드는 Phase 6 구현 시 작성.

### D.1 End-to-End Query Flow

```
[User Browser]
     |
     | POST /api/ra/consult (SSE, Next.js Route Handler, runtime=nodejs)
     v
[Middleware (Auth.js session check)]
     |
     v
[Route Handler]
     |  (1) Classify intent (Haiku)
     |  (2) Rewrite query for retrieval
     v
[Retrieval Layer]
     |  - pgvector hybrid search (Neon)
     |  - FTS (Postgres tsvector)
     |  - Cohere Rerank
     v
[Prompt Assembly + Sonnet 4.5 stream]
     |  (SSE events: meta → trace → prose_delta → confidence → sources → checklist|comparison|timeline → related → expert_review_required? → done)
     v
[Post-processing]
     |  - Citation parser (citation-parser.ts)
     |  - Confidence calibration
     |  - Expert-review gating (score < 0.70 OR policy keyword)
     v
[Persist + Audit]
     |  - messages, message_sources, message_blocks inserts
     |  - audit_logs INSERT (append-only trigger)
     |  - Langfuse trace emit
     v
[Client (useStreamingAnswer hook)]
     |
     v
[UI render: Composer -> AnswerBlock -> DocViewer on citation click]
```

### D.2 Expert Review Gating Flow

```
[Sonnet response] -> [confidence < 0.70 ?] -> [policy-blocked keyword ?] -> [emit expert_review_required]
                                                                                      |
                                                                                      v
[Client renders badge + button] -> [user clicks] -> [POST /api/ra/expert-review] -> [insert expert_review_tickets]
                                                                                      |
                                                                                      v
                                                                    [RA lead queue /dashboard] -> [lead resolves] -> [audit log]
```

---

Version: 0.1.0
Last Updated: 2026-04-22
Author: manager-spec
Phase: 6 (Quality & Launch)
Status: draft (awaiting plan-auditor review → iteration 2)
