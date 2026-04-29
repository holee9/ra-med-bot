---
document_id: MASTER-ROADMAP-REGULA
version: 1.0.0
created: 2026-04-22
author: manager-strategy
supersedes: handoff README §20 (확장·구체화)
scope: Phase 0 (Pre-Phase-2 Remediation) ~ Phase 6 (Launch)
related_documents:
  - .moai/specs/SPEC-REGULA-FOUNDATION-001/spec.md (v0.3.0)
  - .moai/specs/SPEC-REGULA-CHAT-001/spec.md (v0.1.0)
  - .moai/specs/SPEC-REGULA-STRUCTURED-001/spec.md (v0.1.0)
  - .moai/specs/SPEC-REGULA-BREADTH-001/spec.md (v0.1.0)
  - .moai/specs/SPEC-REGULA-ENTERPRISE-001/spec.md (v0.1.0)
  - .moai/specs/SPEC-REGULA-LAUNCH-001/spec.md (v0.1.0)
  - .moai/plans/harness-gap-audit.md
  - .claude/skills/regula/SKILL.md
  - RA-bot-design/design_handoff_regula/README.md (§20)
---

# Master Roadmap — Regula

본 문서는 Regula 프로젝트의 **실행 전략**을 정의한다. 개별 Phase의 상세 요구사항은 해당 SPEC 문서를 참조하라. 본 Roadmap은 (1) Phase 간 의존성, (2) Non-Obvious Constraints의 단계적 완결, (3) 팀 재구성 전략, (4) cross-Phase 위험 관리, (5) Decision Points 이월 추적, (6) Launch readiness 집계 — 즉 **프로젝트 레벨의 메타-전략**만 담당한다.

handoff README §20의 6-Phase Roadmap을 **대체하지 않고 확장·구체화**한다. handoff는 요약 로드맵이고, 본 문서는 SPEC 6건 + 하네스 감사 1건을 합성한 실행 가능한 플랜이다.

---

## 1. Executive Summary

### 1.1 규모 집계

| 지표 | 값 |
|---|---|
| 총 Phase 수 | **7** (신설 Phase 0 + 기존 Phase 1~6) |
| SPEC 문서 수 | 6 (FOUNDATION, CHAT, STRUCTURED, BREADTH, ENTERPRISE, LAUNCH) |
| 총 REQ 수 | **349** (FOUNDATION 74 + CHAT 60 + STRUCTURED 37 + BREADTH 57 + ENTERPRISE 73 + LAUNCH 48) |
| 총 SPEC lines (대략) | ~7,800 |
| 총 테이블 수 (Drizzle) | 13 (FOUNDATION)에서 Phase 5 RBAC migration까지 안정 |
| Phase 1 완료 REQ | 74 (FOUNDATION v0.3.0 audit-002 PASS) |

### 1.2 하네스 Critical 차단 항목

plan-auditor (`harness-gap-audit.md`)가 `.claude/agents/regula/` + `.claude/skills/regula*/`에 대해 REQUIRES_EXPANSION 판정. **Critical 4건**이 Phase 2 진입 및 Phase 5 실행을 구조적으로 차단.

| ID | 항목 | 영향 Phase | 원인 |
|---|---|---|---|
| C1 | Phase 5 Security + Observability 오너십 붕괴 | Phase 5 차단 | compliance-qa가 implementation + verification 이중 오너 |
| C2 | §7.11 Onboarding 오너 제로 | Phase 4 차단 | 어떤 agent/skill도 OnboardingModal.tsx 산출 선언 없음 |
| C3 | §11.10 Ingestion write-side 오너 제로 | Phase 2 차단 | rag-pipeline은 retrieval(read)만 소유, FDA 코퍼스 populate 무주공산 |
| C4 | Agent `skills:` frontmatter 미연결 | 전 Phase 차단 | 도메인 스킬 7종이 agent context에 실제 주입되지 않음 |

### 1.3 실행 모델

- **방식:** 에이전트 팀 + Phase별 재구성 (`regula/SKILL.md` 기반)
- **Phase 경계:** `TeamCreate` → Phase 수행 → `TeamDelete` → 다음 Phase 팀 신설
- **산출물 전달:** `_workspace/phase-N/` 중간 산출물 + 프로젝트 루트 최종 코드
- **기본 모델:** `model: opus` (reasoning-heavy agents `effort: xhigh` 권고)
- **워크트리 전략:** Implementation teammate는 `isolation: worktree`, read-only teammate는 `permissionMode: plan`

### 1.4 최종 목표

production-ready Regula 챗봇으로서 다음을 **동시에** 충족:

1. handoff §20 Phase 6 launch readiness checklist 25항목 전원 통과
2. 21 CFR Part 11 compliant (append-only audit, 7-year retention, TRUNCATE/role bypass 봉쇄)
3. WCAG 2.1 AA compliant (axe-core 0 violations)
4. 한/영 이중언어 first-class (next-intl 런타임, 규제 용어 glossary)
5. 7개 Non-Obvious Constraints 전면 완결 (citation 100% coverage, SSE 3-phase, expert-review 게이팅, audit 완전성, Serif 타이포, i18n, noindex)
6. P95 latency: first token ≤ 1.5s, LCP ≤ 2.0s, hybrid search ≤ 500ms

---

## 2. Phase 0 — Pre-Phase-2 Remediation (신설)

### 2.1 목적

`harness-gap-audit.md`의 Critical 4건(C1~C4)을 구조적으로 해소한다. Phase 2 진입 차단 해제가 최우선 목적이며, Phase 5에 대한 선행 정비도 포함한다. **Phase 0은 SPEC이 아니라 하네스 메타-작업**이다 — `.moai/specs/` 아래 SPEC 문서 생성 없음.

### 2.2 Critical 해소 작업

| ID | 작업 | 산출물 경로 | 우선순위 | Phase 2 차단? |
|---|------|-----------|--------|------|
| C1-a | `regula-security-audit` agent 신규 생성 | `.claude/agents/regula/regula-security-audit.md` | High | Phase 5 차단 (Phase 2는 아님) |
| C1-b | `regula-observability` agent 신규 생성 | `.claude/agents/regula/regula-observability.md` | High | Phase 5 차단 |
| C1-c | `regula/SKILL.md` Phase 5 task 재배분 (Langfuse 이중 오너 해소) | 기존 파일 수정 | High | Phase 5 차단 |
| C2 | §7.11 Onboarding 오너 지정 | `regula-frontend.md` 역할 확장 + Phase 4 task 추가 | High | Phase 4 차단 |
| C3 | `regula-corpus-ingestion` agent 신규 생성 | `.claude/agents/regula/regula-corpus-ingestion.md` | **Critical** | **Phase 2 차단** |
| C4 | 6 agent frontmatter `skills:` YAML 배열 추가 | 6개 agent 파일 frontmatter patch | **Critical** | **Phase 2 차단** |

### 2.3 High finding 병행 해소 (선택적, Phase 0에 포함 권장)

| ID | 작업 | 산출물 | 우선순위 |
|---|------|-------|--------|
| H1 | Phase 4 team에 design-system 추가 | `regula/SKILL.md` Phase 4 팀 구성 수정 | High |
| H2 | Phase 5 team에 frontend 추가 | `regula/SKILL.md` Phase 5 팀 구성 수정 | High |
| H3 | `§9.6` 키보드 shortcuts 오너 지정 (`regula-frontend` 확장) | `regula-frontend.md` core roles 추가 | High |
| H7 | GitHub Actions CI 오너 지정 (`regula-architect` 확장 또는 새 agent) | `regula-architect.md` 또는 new `regula-devops` | High |

### 2.4 Phase 0 승인 게이트

다음 3 조건 **모두** 만족 시 Phase 0 종료 및 Phase 2 진입 허용:

1. `harness-gap-audit.md` Critical 0건 (plan-auditor 재감사)
2. `regula/SKILL.md` Phase × Team 매트릭스가 본 Roadmap §7에 기술된 권고와 일치
3. plan-auditor PROCEED_TO_PHASE_2 verdict 명시 발행

### 2.5 Phase 0 실행 담당

- **주 실행자:** `harness` 스킬 (메타-스킬) 또는 `manager-project` + `builder-agent` + `builder-skill` 조합
- **검증자:** `plan-auditor` 재감사 사이클

---

## 3. Phase 1 — Foundation

### 3.1 상태

- **SPEC ID:** `SPEC-REGULA-FOUNDATION-001`
- **버전:** `v0.3.0` (audit-002 PASS, PROCEED_TO_PHASE_1 verdict 확보)
- **REQ 개수:** 74 (REQ-FND-001 ~ 060 + 13개 suffixed)
- **상태:** draft (SPEC 승인 완료, RUN 단계 대기)

### 3.2 핵심 산출물 (Top 5)

1. 13-table Drizzle schema including `source_sections` (citation deep-link anchor)
2. `audit_logs` append-only Postgres trigger (UPDATE/DELETE/TRUNCATE + `app_role` REVOKE + migrations role 분리)
3. Source Serif 4 우선 폰트 스택 + Noto Serif KR + Pretendard (`tokens.css` + `@theme` via `app/globals.css`)
4. Auth.js v5 SSO skeleton (Microsoft Entra ID + Google OIDC, `database` session strategy)
5. `lib/env.ts` Zod fail-fast env 검증 + `middleware.ts` auth-wall (matcher whitelist)

### 3.3 다음 실행 트리거

```
/moai run SPEC-REGULA-FOUNDATION-001
```

단, Phase 0의 C4(skills frontmatter) 패치 **이후** 실행해야 regula-foundation-team teammate가 regula-audit-compliance, regula-design-tokens, regula-handoff-reader 스킬을 실제 context에 load한다.

### 3.4 Team (`regula-foundation-team`)

현재 구성(`regula/SKILL.md`): architect, design-system, backend, compliance-qa. Phase 0 권고 적용 후: **+corpus-ingestion (schema DDL 조율)**, 선택적으로 +observability (env wiring 선행).

---

## 4. Phase 2~6 개요

각 Phase에 대해 (a) SPEC 참조, (b) 핵심 산출물 Top 5, (c) 팀 구성, (d) 선결 조건, (e) 완료 게이트, (f) 완결되는 Non-Obvious Constraint, (g) 이월 Decision Points를 정리한다.

### 4.1 Phase 2 — Chat Core

- **SPEC:** `SPEC-REGULA-CHAT-001` v0.1.0
- **REQ 개수:** 60 (REQ-CHAT-001 ~ 060, 7 그룹 A~G)
- **handoff 섹션:** §7.4, §8.1~8.4, §9.1~9.2, §10.3, §11.1, §11.5, §15

#### 4.1.1 핵심 산출물 Top 5

1. `/api/ra/consult/route.ts` SSE Route Handler (3-phase order validator)
2. `lib/ai/consult.ts` RAG generator (Vercel AI SDK + Anthropic prompt caching)
3. `lib/ai/citation-enforce.ts` (htmlparser2 기반 post-processing, meta-sentence whitelist, 20% 위반율 상한)
4. `components/chat/{Composer,Thinking,AnswerBlock,Citation,SourceCard,DocViewer}.tsx`
5. FDA corpus seed (650 chunks, 21 CFR 807/820/814) + `writeAudit` 3 call-sites (llm.call / source.access / expert_review.flag)

#### 4.1.2 Team (`regula-chat-team`)

현재: frontend, rag-pipeline, backend, compliance-qa.  
**권고 추가:** `regula-corpus-ingestion` (FDA 코퍼스 ingest는 Phase 2 RAG의 precondition — 하네스 감사 C3).

#### 4.1.3 선결 조건

1. Phase 0 완료 (C3 + C4 해소)
2. Phase 1 완료 (`/moai run SPEC-REGULA-FOUNDATION-001` 성공, compliance-qa의 8-step audit regression PASS)
3. `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` 사용자 제공

#### 4.1.4 완료 게이트

- REQ-CHAT-001 ~ 060 전부 구현
- Citation invariant 검증: `data-source` ↔ `message_sources.cite_index` 동일 집합 (REQ-CHAT-023)
- Audit trio: 1 consult 요청 → audit_logs에 `llm.call` 1 + `source.access` N + `expert_review.flag` ≤1 (REQ-CHAT-053~055)
- First token P95 ≤ 1.5s (REQ-CHAT-057)
- FOUNDATION SPEC 파일 **미수정** (git diff 0 lines)

#### 4.1.5 이 Phase에서 완결되는 Non-Obvious Constraint

- **#1 Citation 강제** — post-processing enforcement 도입
- **#2 SSE 3-phase 스트리밍** — 12 event types 정의 + 8종 방출 (prose 단계까지)
- **#4 Audit 기록** — 3 call-sites wiring (스키마는 Phase 1에서 완결)

#### 4.1.6 이월 Decision Points

| Decision | 이월처 | 사유 |
|---|---|---|
| P3-1 Structured block 생성 방식 (tool_use vs 별도 Haiku call) | Phase 3 Kickoff | Phase 2에서 결정 무의미 |
| P5-1 Reranker 도입 (Cohere vs cross-encoder) | Phase 5 Kickoff | MVP에서 하이브리드로 충분 |
| P5-2 Langfuse SaaS vs self-host | Phase 5 Kickoff | 관측성 전용 Phase |

---

### 4.2 Phase 3 — Structured Outputs

- **SPEC:** `SPEC-REGULA-STRUCTURED-001` v0.1.0
- **REQ 개수:** 37 (REQ-STRUCT 계열, 5 그룹 A~E)
- **handoff 섹션:** §7.4, §8.3, §8.5~8.7, §8.10, §9.1, §11.1

#### 4.2.1 핵심 산출물 Top 5

1. `lib/ai/structured-blocks.ts` prose 완료 후 Haiku follow-up LLM call 파이프라인
2. `lib/ai/structured-schema.ts` Zod 6-block shared schema (Phase 4 History read 재사용)
3. 4종 SSE event emission: `checklist`/`comparison`/`timeline`/`related`
4. `components/chat/{Checklist,ComparisonTable,Timeline,Callout,SuggestionPill,RightContextPanel}.tsx`
5. `PATCH /api/ra/messages/[messageId]/blocks/[blockId]` (checklist 완료 상태 persist)

#### 4.2.2 Team (`regula-structured-team`)

현재: frontend, rag-pipeline, compliance-qa. **변경 권고 없음.**

#### 4.2.3 선결 조건

- Phase 2 완료 (SSE transport, `useStreamingAnswer` 훅, prose streaming, citation enforcement)

#### 4.2.4 완료 게이트

- `message_blocks` 6 block_type 전부 실제로 INSERT
- SSE event 순서 invariant 유지 (prose `done` 이후에만 structured event 발행)
- AnswerBlock §8.3 14-step composite 구조 완성
- RightContextPanel 실데이터 연결 (현재 프로젝트 placeholder는 Phase 4)

#### 4.2.5 이 Phase에서 완결되는 Non-Obvious Constraint

- **#2 SSE 스트리밍** — 4개 추가 event 방출로 12 type union 100% 활성

---

### 4.3 Phase 4 — Breadth

- **SPEC:** `SPEC-REGULA-BREADTH-001` v0.1.0
- **REQ 개수:** 57 (REQ-BREADTH 계열, 7 그룹 A~G)
- **handoff 섹션:** §7.3, §7.5~7.9, §7.11, §9.4, §10.1~10.2, §11.2~11.7, §11.9, §15, §16, §20

#### 4.3.1 핵심 산출물 Top 5

1. 8 Views 완결 — Home 확장 + History + Templates + Knowledge Base + Regulatory Updates + Dashboard + Projects + **Onboarding Modal (§7.11)**
2. 10 API endpoints (`/api/ra/conversations`, `/templates`, `/sources`, `/updates`, `/dashboard`, `/projects` + [id] variants)
3. 5 신규 RAG retrievers (EU MDR / MFDS / NMPA / PMDA / Internal SOP) + `lib/ai/router.ts` (intent classifier + project target_markets 필터) + `lib/ai/merge.ts` (Cohere Rerank)
4. Project Context Switching (Zustand `currentProjectId`, `persist` middleware, page reload 없이 대화/Composer 보존)
5. 9개 신규 audit action enum 추가 및 Route Handler writeAudit wiring

#### 4.3.2 Team (`regula-breadth-team`)

현재: frontend, backend, compliance-qa.  
**권고 추가:**
- `design-system` (하네스 감사 H1 해소 — 6 신규 view의 토큰 drift 방지)
- `regula-corpus-ingestion` (EU MDR / MFDS / NMPA / PMDA / Internal SOP 5개 코퍼스 populate)

#### 4.3.3 선결 조건

- Phase 3 완료 (`message_blocks` 6 block_type + SSE 12 event)
- Phase 0 C2 해소 (§7.11 Onboarding 오너 지정)
- Cohere API 키 (reranker용, 선택적 — Phase 5로 연기 가능)

#### 4.3.4 완료 게이트

- 8 views 접속 가능 + 반응형 1100/900/<900 3단 breakpoint 준수
- `currentProjectId` 전환 시 대화·Composer 상태 보존 (Zustand persist `partialize` 적용)
- 10개 API 전부 writeAudit 호출 (정적 grep으로 검증)
- OnboardingModal `localStorage regula_onboarded=1` 첫 방문만 표시
- TanStack Virtual History 1000+ 항목 smooth scroll

#### 4.3.5 이 Phase에서 완결되는 Non-Obvious Constraint

- **#6 ko/en 이중언어** — UI 한국어 기본값 고정 (런타임 스위처는 Phase 5)

#### 4.3.6 이월 Decision Points

| Decision | 이월처 | 사유 |
|---|---|---|
| i18n library 선정 | Phase 5 (next-intl 확정) | Phase 4는 hardcoded Korean |

---

### 4.4 Phase 5 — Enterprise Hardening

- **SPEC:** `SPEC-REGULA-ENTERPRISE-001` v0.1.0
- **REQ 개수:** 73 (REQ-ENTERPRISE-001 ~ 073, 7 그룹 A~G)
- **handoff 섹션:** §6, §9.3, §9.5, §9.7, §11.8, §14, §16, §18

#### 4.4.1 핵심 산출물 Top 5

1. Expert Review 전체 — `/api/ra/expert-review` POST/GET/PATCH + `app/(app)/expert-review/page.tsx` 큐 + 자동 게이팅 SSE emit + 게이팅 우회 금지 enforcement
2. RBAC (admin/ra-lead/ra-member/viewer 4-role × organization/project scope 2-tier) — `lib/auth/with-permission.ts` 모든 Write Route Handler 래핑
3. Audit 완전성 — enum 4종 확장 + `scripts/qa/audit-completeness.ts` (ts-morph 정적 분석) + CI gate
4. Dark mode runtime + i18n runtime (next-intl, ko/en dictionary, Topbar LocaleToggle, 규제 용어 glossary)
5. 관측성 4-way — Sentry + PostHog (EU region) + Langfuse (LLM trace) + Vercel Analytics, audit_logs와 엄격 분리

#### 4.4.2 Team (`regula-enterprise-team`)

현재: backend, rag-pipeline, design-system, compliance-qa.  
**권고 추가:**
- `frontend` (하네스 감사 H2 해소 — ExpertReviewCallout + LocaleToggle + ThemeToggle UI)
- `regula-security-audit` (하네스 감사 C1 해소 — CSP/HSTS/CSRF/SSRF implementation)
- `regula-observability` (하네스 감사 C1 해소 — Sentry/Langfuse wiring, compliance-qa와 분리)
- `regula-corpus-ingestion` (`POST /api/admin/update-monitor/run` crawler)

#### 4.4.3 선결 조건

- Phase 4 완료 (8 views + 10 APIs + 5 corpora)
- Phase 0 C1 해소 (security-audit + observability agents)
- 4개 관측성 벤더 키 확보 (`SENTRY_DSN`, `POSTHOG_KEY`, `LANGFUSE_*`, Vercel Analytics 내장)

#### 4.4.4 완료 게이트

- 73 REQ-ENTERPRISE 전부 구현
- axe-core 0 violations (CI gate)
- audit-completeness 정적 분석 0 violations (모든 Write Handler writeAudit 존재 + PII 금지 키 부재)
- i18n-completeness 정적 분석 0 violations (ko 키 == en 키)
- Dark mode FOUT 없음 (inline script 선주입)
- Expert-review 자동 게이팅: confidence < 0.7 OR 정책 키워드 시 100% 트리거

#### 4.4.5 이 Phase에서 완결되는 Non-Obvious Constraint

- **#3 Expert-review 자동 게이팅** — SPEC의 "게이팅 우회 금지" 원칙을 코드 레벨 enforcement
- **#4 Audit 완전성** — 정적 분석 CI gate로 회귀 방지
- **#6 i18n 런타임** — next-intl + 규제 용어 glossary 완결

---

### 4.5 Phase 6 — Quality & Launch

- **SPEC:** `SPEC-REGULA-LAUNCH-001` v0.1.0
- **REQ 개수:** 48 (REQ-LAUNCH-001 ~ 048, 6 그룹 A~F)
- **handoff 섹션:** §15, §16, §17, §18, §20
- **기술 결정 6개 locked:** promptfoo, k6, Vercel, Neon (권장), GitHub Actions, Vercel Env

#### 4.5.1 핵심 산출물 Top 5

1. LLM Eval harness — promptfoo 55+ 규제 질의 regression (FDA 15 + EU MDR 15 + MFDS 10 + NMPA 5 + PMDA 5 + internal SOP 5), 4 scorers
2. Playwright E2E — 7 spec × 3 browser matrix (auth / consultation / expert-review / project-switch / citation-click / i18n / a11y)
3. Load testing — k6 steady 50 VU + spike 100 VU, first token P95 ≤ 1.5s threshold
4. Security review — OWASP Top 10 2025 매핑, gitleaks, pnpm audit, CSP Mozilla Observatory ≥ A
5. Production deploy — Vercel + Neon, env matrix, rollback runbook, `docs/runbook.md` + `docs/compliance.md` + `CHANGELOG.md`

#### 4.5.2 Team (`regula-quality-team`)

현재: compliance-qa (lead) + architect + backend.  
**권고 추가:**
- `rag-pipeline` (LLM eval iteration에서 prompt 변경 발생)
- `regula-security-audit` (하네스 감사 C1 해소 + pen-test plan 작성)
- 선택적 `expert-devops` 또는 `regula-devops` (하네스 감사 H7 해소 — GitHub Actions CI 저작)
- 선택적 `regula-performance` (하네스 감사 H6 해소 — k6 load suite 저작)

#### 4.5.3 선결 조건

- Phase 5 완료 (전 기능, RBAC, 감사, 관측성, a11y)
- Staging 환경 프로비저닝 (Neon prod branch + Vercel production project)

#### 4.5.4 완료 게이트 (launch_readiness_checklist LR-001 ~ LR-025)

- LR 전 25 항목 PASS
- 7개 Non-Obvious Constraints 전부 Phase 6 eval/E2E에서 재검증
- `pnpm eval:ci` / `pnpm e2e` / `pnpm load:staging` / `pnpm audit:check` 전부 green
- Production deploy gate manual approval 수신
- `CHANGELOG.md` Phase 1-6 이력 완비

#### 4.5.5 이 Phase에서 완결되는 Non-Obvious Constraint

- 모든 7개 제약을 **eval 레벨로 검증** (구현은 이전 Phase, Phase 6는 회귀 방지)
- 특히 Citation coverage 100% (eval scorer), Audit immutability (integration test), WCAG AA (Playwright axe)

---

## 5. Phase 간 의존성 그래프

```
Phase 0 (Remediation — 하네스 구조 정비)
    └── Phase 1 (Foundation, SPEC v0.3.0 승인 완료)
            └── Phase 2 (Chat Core) — FOUNDATION schema/audit/env 의존
                    ├── Phase 3 (Structured) — CHAT의 SSE transport + useStreamingAnswer 의존
                    │     └── Phase 4 (Breadth) — STRUCTURED의 message_blocks 6 block_type + structured-schema.ts 의존
                    │             └── Phase 5 (Enterprise) — 전원 의존 (auth, audit, expert_review, theme, locale)
                    │                     └── Phase 6 (Launch) — 전원 의존 (전 기능 eval + E2E + load + security)
                    └── Phase 4도 CHAT의 message_sources + cite_index 직접 의존
```

### 5.1 의존성 세부 (REQ 레벨)

- **Phase 2 ← Phase 1:** REQ-FND-035~039 (schema), REQ-FND-044/046/047 (audit), REQ-FND-010a/051~053 (auth + env), REQ-FND-044a~c (source_sections)
- **Phase 3 ← Phase 2:** types/streaming.ts (12 event), useStreamingAnswer, lib/ai/consult.ts generator
- **Phase 4 ← Phase 3:** structured-schema.ts (read-only import for History 렌더)
- **Phase 5 ← 전원:** auth callbacks + audit enum 확장 + theme/locale pgEnum + expert_review 테이블 + Callout 컴포넌트 + confidence 계산 파이프라인
- **Phase 6 ← 전원:** 전체 API 표면 + 전체 UI + 5 corpora RAG 흐름 + 전체 감사 장치

### 5.2 금지된 역방향 변경

- Phase 2~6은 FOUNDATION SPEC의 REQ-FND를 **수정·삭제하지 않는다** — 세 가지 확장 인터페이스만:
  1. Schema 확장: 마이그레이션 번호 `0002_*` 이상 추가만 허용
  2. Env 확장: `lib/env.ts` zod schema에 키 추가만 허용 (기존 키 삭제 금지)
  3. 기존 placeholder 페이지 교체: Phase N에서 FOUNDATION placeholder의 의도를 유지한 채 완성형으로 교체 가능

---

## 6. Non-Obvious Constraints 완결 매트릭스

CLAUDE.md의 7개 Non-Obvious Product Constraints가 각 Phase에서 어떤 단계로 진행되는지 추적한다. `#1 citation`, `#4 audit`, `#3 expert-review`는 여러 Phase에 걸친 누적 완결 패턴을 가진다.

| # | Constraint | FOUNDATION | CHAT | STRUCTURED | BREADTH | ENTERPRISE | LAUNCH |
|---|------------|:--:|:--:|:--:|:--:|:--:|:--:|
| 1 | Citation 강제 | 스키마 확보 (cite_index NOT NULL + UNIQUE) | **후처리 enforcement 구현** (htmlparser2, meta-whitelist, 20% 상한) | 구조화 블록 비적용 | — | 감시 (audit-completeness CI) | **100% eval scorer** (promptfoo citation-coverage) |
| 2 | SSE 다단계 | — | **3-phase order validator + 8 event emit** | **4 additional event emit** (checklist/comparison/timeline/related) | — | — | E2E 검증 (7 spec × 3 browsers) |
| 3 | Expert-review 게이팅 | 스키마 확보 (expert_reviews + expert_review_required 컬럼) | `expert_review_required` event 자동 발행 (confidence < 0.7 OR citation coverage < 80%) | — | History 목록에 플래그만 표시 | **워크플로우 완결** (API POST/GET/PATCH + 큐 페이지 + 정책 키워드 + 게이팅 우회 금지) | E2E (저 confidence → 큐 등록 → resolve) |
| 4 | Audit 기록 (21 CFR Part 11) | **Day 1 완결** (append-only trigger + TRUNCATE 봉쇄 + role 분리 + REVOKE) | 3 call-sites wiring (llm.call / source.access / expert_review.flag) | message_blocks INSERT 추적 | 10개 신규 API writeAudit | **정적 분석 CI gate** (audit-completeness ts-morph, 모든 Write Handler 검증 + PII 금지) | 감사 immutability integration test |
| 5 | Serif/Sans 타이포 대비 | **확정** (Source Serif 4 우선, Noto Serif KR 중치 fallback, Pretendard first-class) | UI 적용 (section-label serif, Citation mono, AnswerBlock prose) | 적용 (Checklist / Comparison / Timeline 헤더 serif) | 적용 (Dashboard stat values serif, Knowledge Base 헤딩) | 다크 모드에서 serif 대비 유지 + i18n KR 폰트 분기 | 접근성 재검증 (색 대비 AA) |
| 6 | ko/en 이중언어 | 기반 (locale pgEnum, `<html lang="ko">`, Pretendard, Noto Serif KR) | API `locale` 파라미터 routing + prompt 한-영 변형 | — | UI 한국어 하드코딩 (런타임 스위처 없음) | **next-intl 런타임 완결** (LocaleToggle, 대화 보존, 규제 glossary) | E2E ko↔en 전환 spec |
| 7 | noindex 전역 | **설정 완결** (robots.txt + root metadata + /login override + 금지 meta whitelist) | — | — | — | 유지 (추가 page noindex 상속) | prod `/` 응답에 `noindex, nofollow` 확인 |

### 6.1 완결 분포 통계

- FOUNDATION 단독 완결: #5, #7
- CHAT 주도 완결: #1 (enforcement), #2 (80%)
- STRUCTURED 주도 완결: #2 (100%)
- ENTERPRISE 주도 완결: #3, #4 (CI gate), #6
- LAUNCH: 전 항목 재검증 (구현 없음, eval 및 E2E 회귀)

---

## 7. 실행 전략 — 에이전트 팀 재구성 모델

`regula/SKILL.md`의 Phase × Team 매트릭스를 하네스 감사 findings에 근거하여 보강 권고한다. **본 Roadmap은 `regula/SKILL.md`를 직접 수정하지 않으며, 실제 수정은 Phase 0 작업에서 수행한다.**

### 7.1 Phase별 Team 구성 권고 (diff)

| Phase | 현재 Team (`regula/SKILL.md`) | 권고 Team (Phase 0에서 적용) | 근거 finding |
|------|---------------------------|---------------------------|------------|
| Phase 0 (신설) | (없음) | `builder-agent`, `builder-skill`, `manager-project`, `plan-auditor` (재감사) | Phase 0 자체 |
| Phase 1 Foundation | architect, design-system, backend, compliance-qa | 기본 유지. **+corpus-ingestion (schema DDL 조율)**, 선택적 +observability (env wiring 선행) | 감사 코퍼스 스키마 준비 |
| Phase 2 Chat Core | frontend, rag-pipeline, backend, compliance-qa | **+regula-corpus-ingestion (FDA 코퍼스 population)** | C3 Critical |
| Phase 3 Structured | frontend, rag-pipeline, compliance-qa | 변경 없음 | — |
| Phase 4 Breadth | frontend, backend, compliance-qa | **+design-system** (6 신규 view 토큰 drift 방지), **+regula-corpus-ingestion** (5 신규 코퍼스 populate) | H1 High + Phase 2 CI |
| Phase 5 Enterprise | backend, rag-pipeline, design-system, compliance-qa | **+frontend** (ExpertReviewCallout + LocaleToggle + ThemeToggle), **+regula-security-audit (신설)**, **+regula-observability (신설)**, **+regula-corpus-ingestion** (update-monitor cron) | H2 + C1 Critical |
| Phase 6 Quality | compliance-qa (lead) + architect + backend | **+rag-pipeline** (eval 반복 시 prompt 수정), **+regula-security-audit** (pen-test plan + OWASP 재검증), 선택적 **+regula-devops** (GitHub Actions CI), 선택적 **+regula-performance** (k6) | H6 + H7 + C1 |

### 7.2 팀 통신 규칙 (공통)

- 팀 내 실시간 조율: `SendMessage`
- 작업 진행 상황: `TaskUpdate`
- 산출물 전달: 파일 기반 (`_workspace/phase-N/*.md` 또는 프로젝트 소스 파일)
- Critical 이슈: `SendMessage` + 리더(오케스트레이터) 즉시 보고
- Implementation teammate (write): `isolation: "worktree"`, `background: false`
- Read-only teammate (verify/research): `permissionMode: "plan"`, `background: true`

### 7.3 중복 소유권 해소 (하네스 감사 C1)

Phase 5에서 다음 이중 오너십을 해소한다:

| 작업 | 현재 (`regula/SKILL.md`:170) | 재배분 |
|------|---------------------------|-------|
| Sentry SDK 설정 | compliance-qa | `regula-observability` (신설) |
| Langfuse trace wrapper | rag-pipeline + compliance-qa (이중) | `regula-observability` owns wrapper, rag-pipeline only invokes |
| CSP / HSTS / X-Frame middleware | compliance-qa (검증 only) | `regula-security-audit` (신설, implementation) |
| Audit 완전성 정적 분석 | compliance-qa | compliance-qa (유지, 검증 only) |

---

## 8. Phase별 Success Criteria 집계

각 Phase 승인 게이트의 **정량 기준**을 집계한다 (SPEC acceptance criteria 중 측정 가능한 항목만).

| Phase | 정량 기준 | 검증 방법 |
|------|---------|---------|
| 0 | harness-gap-audit Critical 0건, PROCEED_TO_PHASE_2 verdict | plan-auditor 재감사 |
| 1 | 19개 DoD 전부 충족, audit regression 8-step PASS, 13 tables + 7 pgEnum + 2 trigger 적용 | compliance-qa |
| 2 | 60 REQ-CHAT 구현, citation invariant 100%, first token P95 ≤ 1.5s, audit trio 확인 | Vitest + 통합 벤치마크 |
| 3 | 37 REQ-STRUCT 구현, 6 block_type INSERT, 4 추가 event emit, SSE order invariant 유지 | Vitest + 통합 |
| 4 | 57 REQ-BREADTH 구현, 8 views, 10 APIs (전부 writeAudit), 5 corpora retriever, project switch 보존 | Vitest + 수동 |
| 5 | 73 REQ-ENTERPRISE, axe-core 0, audit-completeness 0, i18n-completeness 0, RBAC 전 Handler 래핑, 자동 게이팅 100% | CI gate + 통합 |
| 6 | 48 REQ-LAUNCH + LR-001 ~ LR-025 전부 PASS, eval regression green, E2E 3-browser green, k6 threshold PASS | promptfoo + Playwright + k6 + Mozilla Observatory |

### 8.1 전역 품질 지표 (Phase 5 이후 지속 추적)

| 지표 | 목표 | 측정 주기 |
|-----|-----|---------|
| Citation coverage | ≥ 95% (sentences with `<sup class="cite">`) | Phase 6 eval + continuous CI |
| Audit log completeness | 100% Write Handler | Phase 5 CI gate (정적), continuous |
| WCAG 2.1 AA violations | 0 | Phase 5~6 CI gate, continuous |
| First token P95 latency | ≤ 1.5s | Phase 2 bench, Phase 6 k6 |
| LCP | ≤ 2.0s | Phase 6 Vercel Analytics |
| Hybrid search P95 | ≤ 500ms | Phase 2 bench, Phase 5 Langfuse |

---

## 9. Risk Register (Cross-Phase)

각 SPEC의 risks 섹션을 통합하여 **여러 Phase에 걸친 누적 위험**을 식별한다. 단일 Phase에 국한된 위험은 생략하고 cross-Phase 전파 가능성 있는 것만 등재.

| ID | Risk | 최초 관측 Phase | 영향 Phase | 완화 전략 | 담당 Phase |
|----|------|-------------|----------|---------|---------|
| R-X1 | Citation coverage 회귀 (post-processing 허점) | Phase 2 | 2 / 5 / 6 | Phase 2 20% 위반율 상한 + Phase 5 audit-completeness 확장 + Phase 6 promptfoo citation scorer | 2, 5, 6 |
| R-X2 | 성능 regression (first token 1.5s SLO 초과) | Phase 2 | 2 / 3 (follow-up call 추가) / 4 (router 추가) / 6 (load test) | Top-K=8 chunk 제한 + prompt caching + k6 baseline + 각 Phase 자체 벤치 | 2, 3, 4, 6 |
| R-X3 | DB schema drift (13 tables 기반 변조) | Phase 1 | 2 / 3 / 4 / 5 / 6 | Phase 2+는 `0002_*` migration만 허용 + FOUNDATION 미수정 원칙 + Drizzle introspection CI | 전 Phase |
| R-X4 | RBAC 광범위 침투 영향 (Phase 5 Handler 래핑이 기존 flow 손상) | Phase 4 (API 10개 추가) | 5 | 기존 Handler에 `withPermission` default='allow' 선배치 후 Phase 5에서 세밀화 + 단위 테스트 | 5 |
| R-X5 | i18n 늦은 도입 비용 (Phase 4 하드코딩 → Phase 5 전량 추출) | Phase 4 | 5 | Phase 4에서 모든 문자열을 `t('...')` 헬퍼로 래핑만 해도 추출 용이, Phase 5 next-intl 교체 | 5 |
| R-X6 | SSO provider 테스트 지연 (Microsoft Entra / Google 앱 등록 외부 의존) | Phase 1 | 1 / 6 (prod 등록) | `.env.example` 문서화 + `DEVELOPMENT.md` Setup 가이드 + Phase 6 env-matrix.md | 1, 6 |
| R-X7 | pgvector 확장 권한 이슈 (Supabase free tier 지역차) | Phase 1 | 1 / 6 | REQ-FND-059a remediation 메시지 + Neon 권장 (LAUNCH TD-4) | 1, 6 |
| R-X8 | Auth.js v5 beta API 변경 | Phase 1 | 1 / 5 (RBAC integration) | 버전 고정 + Phase 5에서 stable 전환 재평가 | 1, 5 |
| R-X9 | Tailwind v4 alpha/beta → `@theme` 문법 변동 | Phase 1 | 1 / 4 / 5 (다크 모드) | v4 stable 릴리스 추적 + `tailwind.config.ts` darkMode='class' 유지 (REQ-FND-029a) | 1, 4, 5 |
| R-X10 | Audit schema 확장 차단 (append-only 특성상 migration 제약) | Phase 1 | 5 (enum 확장) | `AuditAction` TypeScript union 확장은 DB schema 무관 + `meta_json` jsonb 유연 | 5 |
| R-X11 | Expert-review 오탐 과다 (confidence 0.7 threshold 낮음) | Phase 2 | 2 / 5 / 6 | Phase 2는 threshold만, Phase 5 Langfuse eval로 조정, Phase 6 promptfoo gating scorer 회귀 | 2, 5, 6 |
| R-X12 | Korean 질문 + English corpus mismatch | Phase 2 | 2 / 4 (5 corpora 확장) | Phase 2 query-rewrite 한-영 혼합 + Phase 4 router가 locale-aware retrieval 보정 | 2, 4 |
| R-X13 | Observability 벤더 월 비용 초과 ($500+ threshold) | Phase 5 | 5 / 6 | Phase 5 TD-5 재평가 조건 명시 + 비용 기반 통합 플랫폼 고려 | 5, 6 |
| R-X14 | 4개 corpora 증분 ingest 실패 (EU MDR/MFDS/NMPA/PMDA) | Phase 4 | 4 / 5 (update-monitor/run) | regula-corpus-ingestion이 checksum dedup + idempotent upsert + retry | 4, 5 |
| R-X15 | Launch env-matrix 누락 (prod에서 dev 키 사용 등) | Phase 6 | 6 | `docs/deployment/env-matrix.md` 체크리스트 + pre-flight script env validation | 6 |

---

## 10. Decision Points 이월 추적

각 Phase가 다음 Phase로 이월한 기술 결정 사항. `locked`는 해당 Phase에서 확정 완료, `pending`은 향후 확정 예정.

| Decision | 최초 제기 Phase | 확정 Phase | 선택 | 상태 |
|---------|-------------|---------|-----|-----|
| Vector DB | Phase 1 | Phase 1 | pgvector (Postgres extension) | locked |
| Queue / Worker | Phase 1 | Phase 1 | Inngest | locked |
| `message_blocks` 통합 vs `checklist_items` 별도 | Phase 1 | Phase 1 | 단일 테이블 (block_type enum 6값) + `source_sections` 별도 | locked |
| `/api/ra/projects` · `/sources` Zod 스키마 | Phase 1 | Phase 4 | Phase 4 BREADTH에서 정의 | locked (Phase 4) |
| 21 CFR Part 11 전자 서명 | Phase 1 | Post-launch | 본 Phase 미포함 | deferred |
| audit_logs 변경 차단 범위 | Phase 1 | Phase 1 | UPDATE + DELETE + TRUNCATE + REVOKE + role 분리 | locked |
| LLM Orchestration | Phase 1 (deferred) | Phase 2 | **Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`) | locked |
| Anthropic Prompt Caching | Phase 2 | Phase 2 | 활성화 (system prompt + chunks에 cache_control) | locked |
| Retrieval 방식 | Phase 2 | Phase 2 | pgvector cosine + Postgres FTS BM25 하이브리드 (0.6/0.4) | locked |
| Reranker | Phase 2 (deferred) | Phase 5 (후보) | Cohere Rerank v3 (후보, Phase 5 Kickoff 확정) | pending |
| Embedding Provider | Phase 2 | Phase 2 | OpenAI `text-embedding-3-small` (1536 dim) | locked |
| Structured block 생성 방식 | Phase 2 (deferred) | Phase 3 | prose 완료 후 Haiku follow-up call | locked |
| Zod schema 위치 | Phase 3 | Phase 3 | `lib/ai/structured-schema.ts` 서버/클라이언트 공유 | locked |
| i18n library | Phase 4 (hardcoded) | Phase 5 | **next-intl** | locked |
| RBAC 모델 | Phase 5 | Phase 5 | Role + Organization/Project scope 2-tier | locked |
| Notification 채널 | Phase 5 | Phase 5 | In-app polling 5s; email Post-launch | locked (with post-launch deferral) |
| Theme persistence | Phase 5 | Phase 5 | localStorage + users.theme_pref DB 양방향 | locked |
| Observability 구성 | Phase 5 | Phase 5 | Sentry + PostHog + Langfuse + Vercel Analytics (4-way) | locked |
| Expert review notification trigger | Phase 5 | Phase 5 | 애플리케이션 레이어 (Route Handler) | locked |
| LLM Eval 도구 | Phase 6 | Phase 6 | promptfoo (OSS) | locked |
| Load testing 도구 | Phase 6 | Phase 6 | k6 | locked |
| Hosting | Phase 6 | Phase 6 | Vercel (Edge + Node Runtime 혼용) | locked |
| DB hosting | Phase 1 (deferred) | Phase 6 | Neon (권장, Supabase alternative) | pending → locked at Phase 6 LAUNCH SPEC |
| Email notification 채널 | Phase 5 | Post-launch | 미결정 | deferred |
| Pen-test 실행 | Phase 6 | Post-launch 3개월 이내 | 본 SPEC은 계획만 | deferred |
| EU region (fra1) activation | Phase 6 | Post-launch | 본 SPEC은 config 준비만 | deferred |

---

## 11. Launch Readiness 집계

Phase 6 LAUNCH SPEC의 `launch_readiness_checklist` LR-001 ~ LR-025 25항목이 최종 게이트다. 다만 이를 통과하기 위해 **이전 Phase들의 출력물**이 누적되어야 한다. 아래는 Phase별 릴리스 기여 재집계.

### 11.1 Phase별 릴리스 기여

| Phase | 릴리스 게이트 기여 |
|------|----------------|
| Phase 0 | 하네스 Critical 0건 확인, PROCEED_TO_PHASE_2 verdict |
| Phase 1 | 13 tables migration 적용 + pgvector 확장 + 7 pgEnum + 2 audit trigger + `app_role` REVOKE + migrations_role 분리 + audit 8-step regression PASS |
| Phase 2 | Citation coverage baseline 확립 (Vitest + enforce test) + SSE 3-phase invariant 검증 + audit trio wiring + FDA corpus populated (650 chunks) + first token P95 ≤ 1.5s bench |
| Phase 3 | 6 block_type INSERT + 4 additional SSE event + SSE order invariant |
| Phase 4 | 8 views live + 10 APIs + 5 corpora retrievers + project switch 보존 + Onboarding modal + 9 신규 audit action wiring |
| Phase 5 | RBAC 모든 Handler 래핑 + audit-completeness CI gate 0 violations + i18n-completeness 0 violations + Sentry/Langfuse/PostHog wired + dark mode runtime + ExpertReview UI 완결 + axe-core 0 violations |
| Phase 6 | LR-001 ~ LR-025 전원 PASS |

### 11.2 launch_readiness_checklist 카테고리 추정

LAUNCH SPEC 본문 참조. 6 범주 × 평균 ~4항목 = 25항목 추정:

| 범주 | 추정 항목 수 | 대표 항목 |
|-----|-----------|--------|
| Functional | 5 | 전 기능 end-to-end 경로 검증 |
| Quality | 5 | 테스트 커버리지, E2E 3-browser, axe-core 0 |
| LLM | 4 | promptfoo regression green, citation coverage ≥ 95%, confidence calibration |
| Performance | 4 | first token P95 ≤ 1.5s, LCP ≤ 2.0s, k6 50/100 VU thresholds |
| Security | 4 | OWASP Top 10, Mozilla Observatory A, gitleaks clean, pnpm audit 0 high |
| Operational | 3 | runbook, env-matrix, rollback 시뮬레이션 |

---

## 12. 추적 지표 (Dashboard)

Phase 진행 관리 및 연속 추적 지표. Phase 5 이후 Dashboard view에 표시 권장.

### 12.1 Phase 진행 지표 (매 Phase 종료 시 측정)

- Phase N SPEC 완료율: (구현된 REQ 수 / 총 REQ 수) × 100
- Phase N compliance-qa verdict: PASS / FAIL / REQUIRES_REWORK

### 12.2 Code Quality (연속 측정, Phase 5 이후 CI)

- Test coverage (Vitest): Phase 2 ≥ 70%, Phase 5 ≥ 85%, Phase 6 ≥ 90%
- axe-core violations (Playwright): 0 enforced after Phase 5
- audit-completeness violations (ts-morph 정적): 0 enforced after Phase 5
- i18n-completeness violations: 0 enforced after Phase 5
- TypeScript strict errors: 0 (Phase 1 이후)
- Biome lint: 0 warnings / 0 errors

### 12.3 LLM Quality (Phase 6 이후 continuous)

- Citation coverage: ≥ 95% (promptfoo eval)
- Hallucination rate: ≤ 5% (promptfoo scorer)
- Confidence calibration error: ≤ 0.1
- Expert-review gating hit rate (저 confidence 질의): ≥ 95%

### 12.4 Performance (Phase 6 이후 continuous)

- First token P95: ≤ 1.5s (k6 + Vercel Analytics)
- Full response P95: ≤ 8.0s
- LCP: ≤ 2.0s (Vercel Analytics)
- INP: ≤ 200ms
- CLS: ≤ 0.05
- DB query P95 (hybrid search): ≤ 500ms (Langfuse + pg_stat_statements)

### 12.5 Compliance (continuous, 5-year retention)

- Audit log write rate (llm.call / day)
- Audit log immutability violations: 0 (integration test)
- Data residency drift: 0 (EU 고객 질의의 OpenAI region)
- Secrets rotation cadence adherence: quarterly

---

## 13. 문서 네비게이션

본 master-roadmap이 참조 및 연동되는 문서 목록.

### 13.1 SPEC 상세 문서

- `.moai/specs/SPEC-REGULA-FOUNDATION-001/spec.md` — Phase 1 상세 (v0.3.0, 74 REQ)
- `.moai/specs/SPEC-REGULA-CHAT-001/spec.md` — Phase 2 상세 (v0.1.0, 60 REQ)
- `.moai/specs/SPEC-REGULA-STRUCTURED-001/spec.md` — Phase 3 상세 (v0.1.0, 37 REQ)
- `.moai/specs/SPEC-REGULA-BREADTH-001/spec.md` — Phase 4 상세 (v0.1.0, 57 REQ)
- `.moai/specs/SPEC-REGULA-ENTERPRISE-001/spec.md` — Phase 5 상세 (v0.1.0, 73 REQ)
- `.moai/specs/SPEC-REGULA-LAUNCH-001/spec.md` — Phase 6 상세 (v0.1.0, 48 REQ)

### 13.2 하네스 감사 문서

- `.moai/plans/harness-gap-audit.md` — plan-auditor Critical 4건 + High 7건 + Medium 6건 + Low 3건
- `.moai/plans/cross-spec-audit.md` — (병렬 작성 중, 본 Roadmap 작성 시 미완성) — 향후 본 문서에 누적 Critical/High 반영 필요

### 13.3 프로젝트 메타 문서

- `.moai/project/product.md` — 제품 비전, 7개 Non-Obvious Constraints, 3 대표 시나리오
- `.moai/project/structure.md` — 디렉토리 전략, Route Groups, 8 Views 배치
- `.moai/project/tech.md` — 기술 스택, SSE 계약, 13-table 데이터 모델 요약

### 13.4 오케스트레이터 / 에이전트 / 스킬

- `.claude/skills/regula/SKILL.md` — Phase × Team 매트릭스 마스터
- `.claude/agents/regula/regula-*.md` × 6 (Phase 0에서 `skills:` frontmatter 패치 필요)
- `.claude/skills/regula-*/SKILL.md` × 7 (도메인 스킬)

### 13.5 핸드오프 원본

- `RA-bot-design/design_handoff_regula/README.md` §20 Implementation Roadmap — 본 문서가 확장·구체화하는 원본
- `RA-bot-design/design_handoff_regula/design_files/styles/tokens.css` — Phase 1 토큰 매핑 원본
- `RA-bot-design/design_handoff_regula/screenshots/*.png` — 8개 참조 화면

### 13.6 프로젝트 컨텍스트 / CLAUDE.md

- `CLAUDE.md` — Non-Obvious Product Constraints 7항목 원본

---

## 14. 즉시 조치 항목 (Action Items)

본 Roadmap 승인 직후 취해야 할 조치. 우선순위는 **Phase 진행 차단 여부** 기준.

| AI ID | 조치 | 우선순위 | 담당 | Phase 진입 차단 |
|-------|------|--------|-----|---------------|
| AI-001 | Phase 0 remediation 승인 — `harness` 스킬 또는 `builder-agent` + `builder-skill` 배포 | **Critical** | 사용자 + MoAI 오케스트레이터 | **Phase 2 차단** |
| AI-002 | `regula-corpus-ingestion` 신규 agent 정의 — chunking, embedding, FDA 크롤러, `update-monitor/run` | **Critical** | builder-agent | **Phase 2 차단 (C3)** |
| AI-003 | `regula-security-audit` 신규 agent 정의 — OWASP, CSP/HSTS/CSRF/SSRF implementation + secrets rotation | High | builder-agent | Phase 5 차단 (C1) |
| AI-004 | `regula-observability` 신규 agent 정의 — Sentry/Langfuse/PostHog wrapper + alert rules | High | builder-agent | Phase 5 차단 (C1) |
| AI-005 | 6 regula-* agent 파일 frontmatter에 `skills:` YAML 배열 추가 | **Critical** | builder-skill 또는 수동 | **전 Phase 차단 (C4)** |
| AI-006 | `regula/SKILL.md` Phase × Team 매트릭스 업데이트 — 본 Roadmap §7.1 권고 반영 (Phase 2/4/5/6) | **Critical** | 수동 편집 | **Phase 2~6 영향** |
| AI-007 | cross-spec-audit.md 완성 후 본 Roadmap 및 SPEC 반영 — Critical/High findings 적용 | High | plan-auditor 완료 후 manager-spec | Phase 2 진입 전 권장 |
| AI-008 | Phase 2 진입 여부 사용자 결정 — 두 분기: (a) Phase 0 먼저 실행 → Phase 1 run → Phase 2, (b) Phase 1 run만 먼저 (하네스 준비 불완전 상태 감수) | **Critical (결정 필요)** | 사용자 AskUserQuestion 응답 | **Phase 2 차단** |
| AI-009 | `§7.11` Onboarding 오너 지정 — `regula-frontend.md` core roles 확장 + Phase 4 task 추가 | High | 수동 편집 | Phase 4 차단 (C2) |
| AI-010 | 하네스 감사 High 7건 (H1~H7) 해소 계획 확정 — Phase 0 포함/제외 결정 | Medium | 사용자 결정 | Phase 4/5/6 영향 |
| AI-011 | 외부 의존성 프로비저닝 체크리스트 작성 — Postgres 16 + pgvector 0.7+, Microsoft Entra ID, Google OIDC, Anthropic/OpenAI/Cohere API keys, Sentry/PostHog/Langfuse 벤더 | Medium | 사용자 / DevOps | Phase 1/5/6 지연 리스크 |
| AI-012 | `DEVELOPMENT.md` Phase 0 섹션 추가 — "하네스 준비 단계" 설명 (Phase 6에서 8 섹션으로 확장 시 통합) | Low | manager-docs | — |

### 14.1 권장 실행 순서

```
[AI-008 사용자 결정] → [AI-001 Phase 0 실행]
  ├── [AI-002/003/004 신규 agent 3종 생성]
  ├── [AI-005 6 agent frontmatter 패치]
  ├── [AI-006 regula/SKILL.md 업데이트]
  └── [AI-009 Onboarding 오너 지정]
→ [plan-auditor 재감사, Critical 0건 확인]
→ [AI-007 cross-spec-audit 반영]
→ [/moai run SPEC-REGULA-FOUNDATION-001]   (Phase 1 실행)
→ [Phase 2 CHAT 진입]
→ ... Phase 6 LAUNCH까지 순차 진행
```

### 14.2 주의사항

- AI-005 (skills frontmatter)는 **가장 간단하지만 가장 중요한 패치**다. 6 파일 YAML frontmatter에 `skills:` 배열 추가만 하면 되며, 실패하면 이후 전 Phase에서 도메인 스킬이 context에 실제 주입되지 않아 **citation / audit / expert-review / i18n 제약이 silent drop**된다.
- AI-002 (corpus-ingestion)는 Phase 2 첫 consult 요청이 빈 코퍼스에 대해 실행되면 *모든* 답변이 "해당 질문에 대한 공식 출처를 찾을 수 없습니다"로 수렴하여 Phase 2 전체가 demo 불가능 상태가 된다.
- AI-003/004 (security-audit + observability)는 Phase 5에서 뒤늦게 발견 시 **compliance-qa의 audit 결과에 implementer가 없는 상태**가 되어 Phase 5 완료가 지연된다.
- 본 Roadmap은 **시간 예측(예: "2주", "1개월")을 사용하지 않는다**. Priority (Critical/High/Medium/Low) 및 실행 순서(Phase 의존성)만 명시하며, 실제 기간은 사용자가 팀 규모·우선순위·병행 작업 여부에 따라 결정한다.

---

## 문서 유지보수 정책

- 본 Roadmap은 **Phase 진행에 따라 cumulative revision** 한다:
  - 각 Phase 완료 시 §8 Success Criteria, §9 Risk Register, §10 Decision Points, §11 Launch Readiness 업데이트
  - SPEC 버전 변경 시 §4 해당 Phase 소개 섹션 버전 갱신
  - `regula/SKILL.md` 변경 시 §7 Team 권고 재검토
- 본 Roadmap은 handoff README §20을 **대체하지 않는다** — 원본 §20은 그대로 유지하고, 본 문서가 확장 해석을 제공한다.
- 본 Roadmap은 개별 SPEC의 REQ 상세를 **중복 기술하지 않는다** — SPEC ID + handoff 섹션 번호 + REQ 그룹만 참조한다.
- Cross-spec-audit.md 완성 시 §10 Decision Points 및 §9 Risk Register에 반영.
- Phase 2~6 실행 중 발견되는 새 Decision Points는 §10에 즉시 추가 (이월 추적).

---

*End of Master Roadmap — Regula v1.0.0*
