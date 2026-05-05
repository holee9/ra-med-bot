---
id: SPEC-REGULA-RELEASE-001
artifact: research
title: "Research — First Release Readiness 통합 분석"
created: 2026-05-05
updated: 2026-05-05
author: manager-spec
phase: release-orchestration
priority: Critical
related_spec: .moai/specs/SPEC-REGULA-RELEASE-001/spec.md
related_specs:
  - SPEC-REGULA-RELEASE-GATE-001
  - SPEC-REGULA-RELEASE-HARDENING-001
  - SPEC-REGULA-QUALITY-001
related_issues:
  - "#12"
  - "#13"
  - "#18"
  - "#26"
  - "#27"
  - "#28"
  - "#29"
  - "#30"
  - "#32"
  - "#33"
  - "#34"
related_prs:
  - "#20"
  - "#21"
---

# Research — SPEC-REGULA-RELEASE-001 First Release Readiness 통합 분석

본 문서는 Regula 1차 릴리즈(`v1.0.0 RC`)의 **현재 검증된 상태**와 **3개 자식 SPEC(GATE-001/HARDENING-001/QUALITY-001) 통합 정합성**을 기록한다. 본 SPEC은 우산(umbrella) SPEC으로, 자식 SPEC의 research.md를 **요약·참조**하며 중복 기술하지 않는다.

조사 일자: 2026-05-04 ~ 2026-05-05
조사자: manager-spec
조사 범위: D:/workspace-github/ra-med-bot
누적 검증 기여: GATE-001 research.md (P0), HARDENING-001 research.md (P1), QUALITY-001 research.md (P2)

---

## 1. 1차 릴리즈 현재 진단 (Snapshot)

### 1.1 Release Readiness Score (검증 일자 2026-05-04)

전체 7.2/10 — 기능 완성도는 v1.0 도달 가능, 그러나 governance 정합성 결여로 RC 선언 불가.

| 영역 | 점수 | 상태 | 주요 Blocker |
|---|---|---|---|
| 기능 완성도 | 8.5/10 | OK | — |
| CI / PR | 5.5/10 | UNSTABLE | PR #20, #21 모두 OPEN |
| Issue 정합성 | 6.0/10 | UNSTABLE | #12, #13 미 closure |
| Branch 거버넌스 | 6.0/10 | UNSTABLE | feature 브랜치 미머지, `.worktrees/` 미정리 |
| Session State | 7.0/10 | UNSTABLE | `session-memo.md` uncommitted |
| **종합** | **7.2/10** | **UNSTABLE** | **RC 선언 불가** |

(상세 분석은 `.moai/specs/SPEC-REGULA-RELEASE-GATE-001/research.md` §1 참조)

### 1.2 PR 상태 (2026-05-04 기준)

- **PR #20** (Phase 11 External Public Data Enrichment 관련 추정):
  - CI Gates / Security / Eval: PASS
  - Playwright E2E (chromium / firefox / webkit): **PENDING**
  - 머지 차단 사유: E2E 3-browser 미완주
- **PR #21** (관련 4개 파일 lint/format 실패):
  - biome format: `app/api/ra/profile/route.ts`, `lib/auth/department.ts` 실패
  - biome lint: `lib/audit.ts` (`noExplicitAny`), `tests/unit/auth/department.test.ts` (`forEach`) 실패
  - 머지 차단 사유: CI Gates 실패 (Issue #30)

(상세는 `.moai/specs/SPEC-REGULA-RELEASE-GATE-001/research.md` §2~§3)

### 1.3 OPEN Issues — 1차 릴리즈 직접 관련 (11종)

| # | 카테고리 | 상태 | 본 SPEC 처리 |
|---|---|---|---|
| #12 | type/spec (Phase 10 Radar) | OPEN, 구현 완료 | GATE-001이 closure 책임 |
| #13 | type/spec (Phase 11 External) | OPEN, 구현 완료 | GATE-001이 closure 책임 |
| #18 | type/adr (post-mortem) | OPEN (의도적 유지) | 본 SPEC closure 금지 (REQ-REL-002 명시) |
| #26 | type/bug (build 검증) | OPEN | RELEASE-001 §2 in-scope |
| #27 | type/bug (TODO/placeholder) | OPEN | HARDENING-001 Group D 직접 close |
| #28 | type/adr (branch governance) | OPEN | GATE-001 트리거 issue |
| #29 | type/bug (console 로그 정책) | OPEN | HARDENING-001 Group C 직접 close |
| #30 | type/bug (PR/CI 정합성) | OPEN | GATE-001 직접 close |
| #32 | type/spec (RELEASE-GATE-001) | OPEN | GATE-001 SPEC tracking issue |
| #33 | type/spec (RELEASE-HARDENING-001) | OPEN | HARDENING-001 SPEC tracking issue |
| #34 | type/spec (QUALITY-001) | OPEN | QUALITY-001 SPEC tracking issue |

상세 분류표는 `spec.md` §2.1 참조.

### 1.4 Git State

- Current branch: `feature/SPEC-REGULA-NETWORK-001`
- Modified (uncommitted): `.moai/state/session-memo.md`, `README.md`
- Untracked: `.worktrees/`, `.moai/specs/SPEC-REGULA-QUALITY-001/`, `.moai/specs/SPEC-REGULA-RELEASE-001/`, `.moai/specs/SPEC-REGULA-RELEASE-GATE-001/`, `.moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/`

(상세 분석은 GATE-001 research.md §5)

---

## 2. 3개 자식 SPEC 통합 정합성

본 SPEC은 P0/P1/P2 3개 자식 SPEC을 우산 형태로 묶는다. 각 자식 SPEC의 research.md는 본 문서의 **검증 기반(evidence base)**이다.

### 2.1 P0 — SPEC-REGULA-RELEASE-GATE-001 (Critical, #32)

**범위**: PR/CI/Issue/Branch/Session 5축 정합성 회복. **신기능 추가 0건**.

**핵심 검증 결과** (출처: GATE-001 research.md):
- PR #21 4개 파일 lint/format 위반 (`biome ci` 실행 결과 기준)
- PR #20 3-browser E2E PENDING (CI workflow trigger 또는 timeout 추정)
- Issue #12, #13 구현 commit (`9b7adda`, `11bd6fa`) 식별 완료, closure note 누락 원인은 PR merge 시 `Closes #` keyword 미기재
- `.worktrees/` 처리 정책 미수립 (gitignore vs prune 미결정)
- `session-memo.md` working tree에만 존재, commit 부재

**산출물**: 20개 EARS REQ (Group A~E)

**1차 릴리즈와의 관계**: 본 SPEC이 **선행 prerequisite**. RELEASE-GATE-001 미완 시 RELEASE-001 RC 선언 불가.

→ 상세는 `.moai/specs/SPEC-REGULA-RELEASE-GATE-001/research.md` 참조.

### 2.2 P1 — SPEC-REGULA-RELEASE-HARDENING-001 (High, #33)

**범위**: 사용자 직접 노출 결함 6개 그룹 해소. **기존 구현물의 품질·정직성·테스트 가능성 격상**.

**핵심 검증 결과** (출처: HARDENING-001 research.md):
- H-1 Dashboard Stats stub: `app/api/ra/dashboard/route.ts`가 `stats: {}` 반환 → 모든 카드에 0 표시
- H-2 Knowledge Base hardcoded: `app/(app)/knowledge/page.tsx`에 `sourceGroups` 리터럴 (43라인)
- H-3 Console.* 27건 / 15개 파일 (PII High/Critical 8건 포함)
- H-4 TODO/placeholder 9개 파일 (lib/external/*, lib/ai/hybrid-router.ts 등)
- H-5 citation-click E2E `test.skip(true, ...)` 4개 (인증 fixture 부재)
- H-6 Workflow executor 3종 모두 hardcoded mock 응답

**산출물**: 28개 EARS REQ (Group A~F)

**1차 릴리즈와의 관계**: GATE-001 완료 후 진입. 사용자 가시 결함을 모두 차단.

→ 상세는 `.moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/research.md` 참조.

### 2.3 P2 — SPEC-REGULA-QUALITY-001 (High, #34)

**범위**: RAG 기능 정확성과 평가 신뢰성 완성. **시스템이 "동작은 하지만 데이터가 비어 있는" 상태에서 "실제로 답을 생성하고 평가를 통과하는" 상태로 격상**.

**핵심 검증 결과** (출처: QUALITY-001 research.md):
- Q-1: `source_sections` 시드 부재 — 5개 코퍼스 모두 비어 있음 (`db:seed:corpus` 스크립트 0건)
- Q-2: `pnpm eval:ci` (promptfoo, 55 시나리오) 시드 부재로 통과 불가
- Q-3: `lib/ai/hybrid-router.ts:142` Vectorize TODO 미해결
- Q-4: 관리자 문서 업로드 → ingest → `source_sections` 적재 흐름 검증 미완
- Q-5: 보안 헤더 E2E (CSP/HSTS/X-Frame-Options/X-Content-Type-Options) CI 통과 불확실
- Q-6: `scripts/qa/check-rbac.mjs`의 admin 문서 라우트 4종 커버리지 미확인

**산출물**: 25개 EARS REQ (Group A~F)

**1차 릴리즈와의 관계**: GATE-001 + HARDENING-001 완료 후 진입. RC 선언 직전 마지막 품질 게이트.

→ 상세는 `.moai/specs/SPEC-REGULA-QUALITY-001/research.md` 참조.

### 2.4 Cross-SPEC Ownership 명확화 (중복 방지)

본 SPEC family에서 발생한 ownership 중첩 후보들:

| 항목 | Owner SPEC | 다른 SPEC의 처리 |
|---|---|---|
| `lib/ai/hybrid-router.ts:142` Vectorize 처리 | QUALITY-001 (REQ-QUAL-011~014) | HARDENING-001 REQ-HARDEN-020은 본 항목을 명시적으로 QUALITY-001에 위임. HARDENING-001은 이 파일을 수정하지 않는다. |
| Issue #12 / #13 closure | GATE-001 (REQ-GATE-009~010) | RELEASE-001은 closure 결과를 acceptance에서 검증만 |
| 보안 헤더 E2E | QUALITY-001 (REQ-QUAL-020~023) | RELEASE-001 REQ-REL-050은 결과만 검증 |
| QA Gate 0~5 정의 | `.moai/specs/_shared/qa-gate-roadmap.md` (SSoT) | 4개 SPEC 모두 본 파일 참조 (중복 정의 금지) |
| Issue #18 (post-mortem ADR) | 별도 SPEC 미할당 (의도적) | RELEASE-001/GATE-001 모두 closure 금지 명시 (REQ-REL-002, REQ-GATE-011) |

---

## 3. Branch / Worktree 상태 요약

(상세는 GATE-001 research.md §5)

- 현재 브랜치: `feature/SPEC-REGULA-NETWORK-001` (SPEC-REGULA-NETWORK-001 v2.0 구현 브랜치, main 머지 보류)
- `.worktrees/` 미정리: `.gitignore` 등록 또는 `git worktree prune` 필요
- `.moai/state/session-memo.md` modified, uncommitted: 본 SPEC family 완료 시점에 final state로 commit 필요
- 신규 SPEC 4종 (`.moai/specs/SPEC-REGULA-{QUALITY,RELEASE,RELEASE-GATE,RELEASE-HARDENING}-001/`) 모두 untracked: 본 plan-auditor 보강 작업이 끝나면 같이 commit 필요

---

## 4. QA Program (Issue #73~#79)과의 정합성

QA Gate 0~5 정의는 `.moai/specs/_shared/qa-gate-roadmap.md`로 단일화되었다. 본 SPEC family는 다음과 같이 매핑된다:

- **Gate 0 (#74) — SPEC 준비도**: 본 plan-auditor 보강 작업 자체가 Gate 0 충족
- **Gate 1 (#75) — 구현 중 체크포인트**: HARDENING-001 / QUALITY-001 RUN 단계에서 적용
- **Gate 2 (#76) — PR 수락**: GATE-001이 PR #20/#21에 대해 직접 적용
- **Gate 3~5 (#77~#79)**: 1차 릴리즈 직후 v0.2 운영 단계로 deferred

전체 QA Program 매트릭스 자체(#73)는 본 SPEC family와 별도 트랙으로 관리되며, 1차 릴리즈 RC 선언 이후 활성화된다.

---

## 5. Out-of-Scope 검토 (1차 릴리즈에서 의도적으로 제외)

본 SPEC §2.1 분류표에 자세히 정리되어 있으며, 큰 카테고리는 다음과 같다:

| 카테고리 | 처리 |
|---|---|
| Wave 3~5 backlog (#22~#25, #41~#43, #50~#92 등) | post-v0.1 또는 별도 Wave 트랙 |
| QA Program 운영 트랙 (#73~#79) | 1차 릴리즈 직후 활성화 (현재는 정의만 존재) |
| Source Governance / System Validation (#48, #49, #71, #72) | post-v0.1 |
| Submission Lifecycle / Review Ops (#36, #37) | post-v0.1 |
| Adoption Analytics (#38) | post-v0.1 |
| Knowledge Gap Ops (#35) | post-v0.1 |

---

## 6. Risk Snapshot (자식 SPEC 위험 요약)

| 자식 SPEC | 주요 위험 | 완화 |
|---|---|---|
| GATE-001 | `lib/audit.ts`의 `any` 제거 시 runtime 영향 | `unknown` + 타입 가드 패턴, unit test 회귀 검증 |
| HARDENING-001 | Console 정리 중 PII 누출 가능성 | M2-C 진행 전 Sentry/Langfuse 연결 확인, sample input 회귀 검증 |
| HARDENING-001 | Citation E2E auth fixture에 운영 계정 누출 | dedicated test 계정, GitHub Secrets 격리 |
| QUALITY-001 | 규제 원문 라이선스 모호 | 공개 문서만 사용, 인용 출처 메타데이터 필수 |
| QUALITY-001 | 80% eval 통과율 미달 | 실패 시나리오 분류 (corpus-gap vs model-issue), 시드 보강 |
| QUALITY-001 | Cloudflare 환경 fallback 의도치 않은 활성화 | 통합 테스트에서 env 분기 명시 검증 |

(상세는 각 자식 SPEC research.md §위험 절 참조)

---

## 7. 21 CFR Part 11 도메인 제약 (Constitutional)

Regula는 의료기기 규제 RAG 시스템이며, **21 CFR Part 11 traceability**가 도메인 헌법 수준의 제약이다. 본 SPEC family는 다음을 보장한다:

- **Append-only audit log**: HARDENING-001 REQ-HARDEN-015 (audit 파이프라인 변경 금지)
- **PII safety**: HARDENING-001 Group C (REQ-HARDEN-013, 14) — 로그에 query/answer/document content 직접 기록 금지
- **Mock data 명시**: HARDENING-001 Group F (REQ-HARDEN-027, 028) — `_mock: true` 플래그, audit log `metadata.mock_data` 태깅
- **Citation accuracy**: QUALITY-001 (Group D) — admin 업로드 → 검색 가능 전체 흐름 검증
- **RBAC enforcement**: QUALITY-001 Group F — admin 라우트 RBAC 매트릭스 강제

---

## 8. Open Questions (1차 릴리즈 RC 선언 전 해소 필요)

본 plan-auditor 보강 작업으로도 해소되지 않는 의문점:

1. PR #20과 PR #21의 base/head 브랜치 동일성 — 동일 feature 브랜치라면 한쪽 머지가 다른 쪽에 영향
2. `.worktrees/`가 `.gitignore`에 이미 있는지 verification 필요 (있는데도 untracked면 git index 갱신 문제)
3. PR #20 E2E PENDING의 정확한 원인 — log 확인 전까지 확정 불가
4. QUALITY-001 시드 데이터 라이선스 — 공개 규제 문서 직접 인용에 대한 법무 리뷰 필요 여부
5. CI 환경에서 promptfoo 실행 시 LLM provider/예산 정책

이 Open Questions는 본 SPEC RUN 단계 진입 전 자식 SPEC RUN에서 해소된다.

---

## 9. 참조

- 자식 SPEC research.md (1차 정보):
  - `.moai/specs/SPEC-REGULA-RELEASE-GATE-001/research.md`
  - `.moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/research.md`
  - `.moai/specs/SPEC-REGULA-QUALITY-001/research.md`
- 공통 SSoT:
  - `.moai/specs/_shared/qa-gate-roadmap.md` (QA Gate 0~5 정의)
- GitHub artifacts:
  - PR #20, PR #21
  - Issues #12, #13, #18, #26~#34, #73~#79
- 코드 진입점:
  - `lib/ai/hybrid-router.ts:142` (Vectorize TODO, QUALITY-001 owner)
  - `app/api/ra/dashboard/route.ts` (Dashboard stub, HARDENING-001 owner)
  - `tests/eval/promptfoo.config.yaml` (Eval pipeline, QUALITY-001 owner)
  - `tests/e2e/citation-click.spec.ts` (E2E skip, HARDENING-001 owner)

---

## 10. 결론

본 SPEC은 우산 SPEC으로서 **신규 검증 정보를 생산하지 않는다**. 모든 사실은 3개 자식 SPEC research.md에서 검증되었다. 본 SPEC의 가치는 **3개 SPEC 간 ownership을 명확히 하고, 1차 릴리즈 RC 선언 게이트를 단일 acceptance로 통합**하는 데 있다.

자식 SPEC 진행 순서는 plan.md §2 (M1~M4)에 정의된 대로 GATE-001 → HARDENING-001 → QUALITY-001 → RELEASE-001 RC declaration 으로 고정된다.
