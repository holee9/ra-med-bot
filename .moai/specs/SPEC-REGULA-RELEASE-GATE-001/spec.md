---
id: SPEC-REGULA-RELEASE-GATE-001
title: "Regula Release Gate — PR/CI/Branch 정합성 확보"
status: draft
phase: "release-gate"
priority: Critical
version: 0.2.0
created: 2026-05-04
updated: 2026-05-05
author: manager-spec
issue_number: 32
depends_on: []
closes_issues:
  - "#12"
  - "#13"
  - "#28"
  - "#30"
verifies_specs:
  - SPEC-REGULA-NETWORK-001
  - SPEC-REGULA-RADAR-001
related_specs:
  - SPEC-REGULA-RELEASE-001
  - SPEC-REGULA-RELEASE-HARDENING-001
  - SPEC-REGULA-QUALITY-001
related_issues:
  - "#12"
  - "#13"
  - "#18"
  - "#28"
  - "#30"
  - "#32"
related_prs:
  - "#20"
  - "#21"
labels:
  - release
  - gate
  - critical
revision_history:
  - version: 0.2.0
    date: 2026-05-05
    author: manager-spec (plan-auditor remediation)
    notes: "Plan-auditor 보강 — depends_on을 verifies_specs로 분리 (GATE-001은 NETWORK/RADAR가 main 머지되었는지를 검증할 뿐, 그 SPEC이 본 SPEC의 prerequisite은 아님). closes_issues 추가 (#12, #13, #28, #30). frontmatter 표준화 (skill 제거, related_specs/labels 추가). EARS 라벨 부착, traceability-matrix.md 신규 작성, _shared/qa-gate-roadmap.md 참조 도입."
  - version: 0.1.0
    date: 2026-05-04
    author: manager-spec
    notes: "Initial draft — v1.0.0 RC 선언 전 P0 release blocker 정합성 확보. PR #21 CI fix, PR #20 E2E 완주, Issue #12/#13 closure, branch 정리, session-memo 동기화."
---

# SPEC-REGULA-RELEASE-GATE-001 — Regula Release Gate

## 1. 목적과 배경 (Purpose and Context)

본 SPEC은 Regula의 **v1.0.0 RC 선언 전 반드시 완료되어야 하는 release blocker(P0)** 작업을 단일 단위로 정의한다. 현재 release readiness는 **7.2/10**으로, "기능 측면에서는 v1.0 도달이 가능하지만 PR/CI/Issue/Branch 정합성이 깨져 있어 RC 선언 불가" 상태이다.

본 SPEC은 새로운 기능을 추가하지 않는다. 오직 다음 5개 축에서 **현재 부정합 상태를 해소**하여 v1.0.0 RC를 선언할 수 있는 토대를 마련하는 것이 목표이다:

1. **PR CI 실패 해소** — PR #21의 4개 파일 (biome format / lint) 실패 수정
2. **E2E 완주** — PR #20의 Playwright 3-browser (chromium/firefox/webkit) PENDING 해소
3. **Issue closure** — 구현 완료된 Issue #12 (Radar), #13 (External Enrichment) 정식 closure
4. **Branch 거버넌스** — `feature/SPEC-REGULA-NETWORK-001` merge, `.worktrees/` 정리, `main` clean 확인
5. **Session State 동기화** — `.moai/state/session-memo.md` 정합성 회복

이 SPEC이 완료되어야 별도 release SPEC (SPEC-REGULA-RELEASE-001 등)이 진행될 수 있다. 즉, 본 SPEC은 **"릴리스 게이트의 게이트(gate of the release gate)"** 역할을 한다.

### 1.1 검증된 현재 상태 (Verified Current State, 2026-05-04 기준)

상세는 `research.md`를 참조한다.

- **PR #21 CI 실패 (Issue #30):**
  - `app/api/ra/profile/route.ts` — biome format failure
  - `lib/audit.ts` — `noExplicitAny` lint error
  - `lib/auth/department.ts` — biome format failure
  - `tests/unit/auth/department.test.ts` — `forEach` lint error
- **PR #20 상태:**
  - CI Gates / Security / Eval: **PASS**
  - Playwright E2E (chromium / firefox / webkit): **PENDING**
- **Open Issues blocking release:**
  - Issue #12 OPEN — "[Phase 10] Regulatory Radar" (구현 완료, 커밋 `9b7adda`, 미 closure)
  - Issue #13 OPEN — "[Phase 11] External Public Data Enrichment" (구현 완료, 커밋 `11bd6fa`, 미 closure)
  - Issue #18 OPEN — Post-mortem ADR (의도적으로 OPEN 유지, scope 제외)
- **Git state:**
  - Current branch: `feature/SPEC-REGULA-NETWORK-001`
  - `.moai/state/session-memo.md` modified (M, uncommitted)
  - `.worktrees/` untracked directory
  - PR #20, PR #21 모두 OPEN/UNSTABLE

---

## 2. Goals and Non-Goals

### 2.1 Goals

| ID | Goal | Verifiable |
|---|---|---|
| G1 | PR #21 CI green 달성 (4개 파일 lint/format 해소) | `gh pr checks 21` → all green |
| G2 | PR #20 Playwright 3-browser E2E green 달성 | `gh pr checks 20` → all green |
| G3 | Issue #12, #13 정식 closure with closure note | `gh issue view 12/13` → state CLOSED |
| G4 | `feature/SPEC-REGULA-NETWORK-001` 브랜치 main 머지 후 정리 | `git branch -a` → 해당 브랜치 부재 |
| G5 | `.worktrees/` 정리 및 `.gitignore` 정합성 확인 | `git status` → untracked clean |
| G6 | `.moai/state/session-memo.md` commit (정합성 회복) | `git status` → clean working tree |
| G7 | v1.0.0 RC 선언 가능 상태 확인 (체크리스트 5/5 PASS) | acceptance.md checklist 100% |

### 2.2 Non-Goals (Out of Scope)

- 신기능 추가 — 본 SPEC은 코드 logic 변경 금지 (lint/format 수정만 허용)
- v1.0.0 RC 자체 선언 (별도 SPEC)
- 새로운 SPEC 생성, 기존 SPEC scope 확장
- Issue #18 (post-mortem ADR) closure — 의도적으로 OPEN 유지
- Production 배포, semver tag 부여
- Performance tuning, 신규 monitoring 지표 추가

---

## 3. Requirements (EARS Format)

### Group A: PR CI Fix (REQ-GATE-001 ~ 005)

본 그룹은 **PR #21**의 CI 실패를 해소한다. 모든 수정은 lint/format 수준이며, 비즈니스 로직 변경 금지.

| REQ ID | Pattern | Statement |
|---|---|---|
| REQ-GATE-001 | Ubiquitous | The system shall pass `biome format` on `app/api/ra/profile/route.ts` without modifying its runtime behavior. |
| REQ-GATE-002 | Ubiquitous | The system shall pass `biome format` on `lib/auth/department.ts` without modifying its public API surface. |
| REQ-GATE-003 | Event-Driven | When `biome lint` runs against `lib/audit.ts`, the system shall report zero `noExplicitAny` violations by replacing `any` with a precise type or `unknown` plus explicit narrowing. |
| REQ-GATE-004 | Event-Driven | When `biome lint` runs against `tests/unit/auth/department.test.ts`, the system shall report zero `forEach` rule violations by converting array iteration to `for...of` per project lint policy. |
| REQ-GATE-005 | State-Driven | While PR #21 is open, the system shall maintain all CI checks (Gates, Security, Eval, Format, Lint) in green status before merge eligibility is asserted. |

### Group B: E2E Completion (REQ-GATE-006 ~ 008)

본 그룹은 **PR #20**의 Playwright 3-browser PENDING을 해소한다.

| REQ ID | Pattern | Statement |
|---|---|---|
| REQ-GATE-006 | Event-Driven | When PR #20 CI pipeline executes, the system shall run the Playwright E2E suite against chromium, firefox, and webkit browsers in parallel and report all three results within the CI run. |
| REQ-GATE-007 | Unwanted | If any of the three browser E2E runs returns a non-green status (failure, timeout, or skipped without an authorized skip annotation), the system shall block PR #20 merge and surface the failing scenario on the PR check summary. |
| REQ-GATE-008 | State-Driven | While PR #20 is in unstable state, the system shall expose the latest E2E artifact (HTML report, screenshots, traces) as a CI artifact downloadable from the PR run page. |

### Group C: Issue Closure (REQ-GATE-009 ~ 012)

본 그룹은 구현이 완료되었으나 closure가 누락된 GitHub Issue를 정식 closure한다.

| REQ ID | Pattern | Statement |
|---|---|---|
| REQ-GATE-009 | Event-Driven | When the SPEC corresponding to Issue #12 (SPEC-REGULA-RADAR-001) is verified as merged into main and its acceptance criteria are met, the system shall close Issue #12 with a closure comment referencing implementation commit `9b7adda` and the SPEC ID. |
| REQ-GATE-010 | Event-Driven | When the SPEC corresponding to Issue #13 (SPEC-REGULA-NETWORK-001 v2.0) is verified as merged into main and its acceptance criteria are met, the system shall close Issue #13 with a closure comment referencing implementation commit `11bd6fa` and the SPEC ID. |
| REQ-GATE-011 | Ubiquitous | The system shall preserve Issue #18 (post-mortem ADR) in OPEN state until the post-mortem ADR is independently completed; this SPEC shall not close Issue #18. |
| REQ-GATE-012 | Unwanted | If a closure comment cannot identify a single implementation commit (e.g., the SPEC was implemented across multiple unmerged branches), the system shall not close the issue and shall surface a blocker report instead. |

### Group D: Branch Governance (REQ-GATE-013 ~ 018)

본 그룹은 브랜치 / worktree / main clean 상태를 회복한다.

| REQ ID | Pattern | Statement |
|---|---|---|
| REQ-GATE-013 | Event-Driven | When PR #20 and PR #21 both report green CI, the system shall merge `feature/SPEC-REGULA-NETWORK-001` into `main` via the standard PR merge workflow (squash or merge commit per repository policy). |
| REQ-GATE-014 | Event-Driven | When `feature/SPEC-REGULA-NETWORK-001` has been merged into main, the system shall delete the local and remote feature branch references. |
| REQ-GATE-015 | State-Driven | While the project root contains an untracked `.worktrees/` directory, the system shall either (a) ensure `.worktrees/` is listed in `.gitignore`, or (b) run `git worktree prune` and remove orphan directories so that `git status` reports a clean working tree. |
| REQ-GATE-016 | Ubiquitous | The system shall verify, after merge and cleanup, that `git status` on `main` reports a clean working tree with no untracked or modified files. |
| REQ-GATE-017 | Ubiquitous | The system shall verify, after merge, that `main` has linear or otherwise policy-compliant history with no orphaned merge commits referencing deleted branches. |
| REQ-GATE-018 | Unwanted | If the merge into main triggers conflicts, the system shall pause and surface a conflict report rather than performing a forced or automated conflict resolution. |

### Group E: Session State (REQ-GATE-019 ~ 020)

본 그룹은 `.moai/state/session-memo.md` 정합성을 회복한다.

| REQ ID | Pattern | Statement |
|---|---|---|
| REQ-GATE-019 | Event-Driven | When all branch governance requirements (REQ-GATE-013 ~ 018) have been satisfied, the system shall update `.moai/state/session-memo.md` with the final release-gate status (PR/CI/Issue/Branch checklist) and commit the file to main. |
| REQ-GATE-020 | Ubiquitous | The system shall ensure `.moai/state/session-memo.md` reflects the canonical handoff state at the moment SPEC-REGULA-RELEASE-GATE-001 is marked complete, so subsequent sessions can resume v1.0.0 RC declaration without re-discovering current state. |

---

## 4. Acceptance Criteria

상세 Given-When-Then 시나리오는 `acceptance.md`를 참조 (별도 작성 시). 본 섹션은 machine-verifiable acceptance summary를 정의한다.

### 4.1 PR / CI

- [ ] `gh pr checks 21` 결과 모든 체크 green
- [ ] `gh pr checks 20` 결과 모든 체크 green (chromium, firefox, webkit 포함)
- [ ] `biome ci` 명령어가 4개 수정 파일에 대해 zero violation 보고

### 4.2 Issue

- [ ] `gh issue view 12 --json state -q .state` → `CLOSED`
- [ ] `gh issue view 13 --json state -q .state` → `CLOSED`
- [ ] `gh issue view 18 --json state -q .state` → `OPEN` (의도적)
- [ ] Issue #12, #13 closure comment에 commit hash (`9b7adda`, `11bd6fa`) 명시

### 4.3 Branch

- [ ] `git branch --list 'feature/SPEC-REGULA-NETWORK-001'` 결과 empty
- [ ] `git ls-remote --heads origin 'feature/SPEC-REGULA-NETWORK-001'` 결과 empty
- [ ] `git status` → clean working tree on `main`
- [ ] `.worktrees/`는 `.gitignore`에 등록되었거나 삭제됨

### 4.4 Session State

- [ ] `.moai/state/session-memo.md`가 main에 commit되어 있음
- [ ] session-memo 내용에 본 SPEC 완료 상태가 명시됨

### 4.5 RC Readiness

- [ ] 위 4개 영역 (PR / CI / Issue / Branch / Session) 모두 PASS
- [ ] v1.0.0 RC 선언을 위한 별도 SPEC이 본 SPEC을 `depends_on`으로 참조 가능한 상태

---

## 5. Out of Scope (Exclusions)

본 SPEC은 다음 작업을 명시적으로 제외한다:

- **신기능 추가** — 어떠한 비즈니스 로직, API endpoint, UI 컴포넌트, DB 스키마 변경도 금지
- **신규 SPEC 생성** — 본 SPEC 진행 중 새로운 SPEC 작성 금지
- **v1.0.0 RC tag 부여** — 별도 SPEC (예: SPEC-REGULA-RELEASE-001 후속)에서 처리
- **Production 배포** — Cloudflare deploy, DB migration 실행 등 배포 작업 일체
- **Performance tuning** — biome rule 변경, ESLint config 변경 등 lint 정책 변경
- **Issue #18 closure** — post-mortem ADR 미완성, 의도적으로 OPEN 유지
- **새로운 monitoring / observability 추가**
- **테스트 커버리지 확장** — 기존 테스트 깨지지 않게만 유지하면 됨

---

## 6. Technical Approach (요약)

상세 milestone과 작업 순서는 `plan.md` (별도 작성 시) 참조. 본 섹션은 high-level approach만 기술한다.

| Priority | Step | Output |
|---|---|---|
| P0-1 | PR #21 CI fix (biome format/lint 4 files) | PR #21 green |
| P0-2 | PR #20 E2E 재실행 / 환경 점검 | PR #20 green (3 browsers) |
| P0-3 | PR #20, PR #21 main merge | feature 브랜치 정리 가능 상태 |
| P0-4 | Issue #12, #13 closure with commit reference | Issue 정합성 회복 |
| P0-5 | `feature/SPEC-REGULA-NETWORK-001` 삭제, `.worktrees/` 정리 | branch governance 회복 |
| P0-6 | `.moai/state/session-memo.md` 갱신 및 commit | session state 정합성 회복 |
| P0-7 | acceptance criteria 4.1 ~ 4.5 전체 통과 확인 | RC readiness 확보 |

순서 의존성:
- P0-1, P0-2는 병렬 가능 (다른 PR)
- P0-3은 P0-1 + P0-2 완료 이후
- P0-4는 P0-3 이후 (merge된 commit이 main에 존재해야 closure note 정합)
- P0-5, P0-6은 P0-3 이후
- P0-7은 마지막

---

## 7. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `lib/audit.ts`의 `any` 제거 시 타입 추론 실패 | High (lint fix가 runtime 영향) | `unknown` + 타입 가드 패턴 사용, runtime behavior 변경 없음을 unit test로 검증 |
| Playwright E2E가 환경 문제로 PENDING 지속 | Medium (PR #20 merge 불가) | CI 환경 (Linux runner, browser binary version) 점검 후 재실행, 실패 시 timeout/retry 정책 재검토 |
| `feature/SPEC-REGULA-NETWORK-001` merge 시 conflict | Medium | REQ-GATE-018에 따라 강제 자동화 금지, conflict 발생 시 수동 검토 |
| `.worktrees/`에 미커밋 작업 존재 | Low | prune 전 `git worktree list` 확인, 의심 worktree는 별도 backup branch로 보존 후 정리 |
| Issue #12/#13 closure note 작성 시 SPEC ID/commit hash 오기재 | Low | REQ-GATE-012에 따라 단일 구현 commit 식별 불가 시 closure 보류 |

---

## 8. References

### 8.1 GitHub Artifacts

- Issue #28: PR/CI/Branch governance discrepancy report (SPEC trigger)
- Issue #30: PR #21 CI failure detail (4 files, lint/format)
- Issue #12: Phase 10 Regulatory Radar (구현 완료, 미 closure)
- Issue #13: Phase 11 External Public Data Enrichment (구현 완료, 미 closure)
- Issue #18: Double-implementation post-mortem ADR (OPEN 유지)
- PR #20: 3-browser E2E PENDING
- PR #21: biome format/lint 실패

### 8.2 관련 SPEC

- SPEC-REGULA-NETWORK-001 (verifies — main 머지 검증 대상)
- SPEC-REGULA-RADAR-001 (verifies — main 머지 검증 대상)
- SPEC-REGULA-RELEASE-001 (umbrella)
- SPEC-REGULA-RELEASE-HARDENING-001 (downstream)
- SPEC-REGULA-QUALITY-001 (downstream)

### 8.3 구현 커밋 / Branch

- 구현 커밋: `9b7adda` (Radar), `11bd6fa` (External Enrichment)
- 현재 branch: `feature/SPEC-REGULA-NETWORK-001`

### 8.4 QA 단계 게이트 정의

QA 단계 게이트(0~5) 정의는 `.moai/specs/_shared/qa-gate-roadmap.md`를 참조하라.

### 8.5 RACI Matrix (Cross-SPEC 책임 분담)

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

---

## 9. HISTORY

- 2026-05-04 v0.1.0 — Initial draft. v1.0.0 RC 전제 조건으로서 PR/CI/Issue/Branch/Session 5축 정합성 확보 정의. 20 EARS REQ (5 group). Non-goals 명시 (신기능 금지, Issue #18 OPEN 유지). GitHub tracking issue: #32.
