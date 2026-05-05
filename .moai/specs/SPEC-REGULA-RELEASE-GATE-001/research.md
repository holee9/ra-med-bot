---
id: SPEC-REGULA-RELEASE-GATE-001
artifact: research
created: 2026-05-04
updated: 2026-05-04
author: manager-spec
phase: release-gate
priority: Critical
skill: regula
related_spec: .moai/specs/SPEC-REGULA-RELEASE-GATE-001/spec.md
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
---

# Research — SPEC-REGULA-RELEASE-GATE-001

본 research.md는 v1.0.0 RC 선언을 위한 release blocker(P0) 작업의 **검증된 현재 상태**를 기록한다. SPEC 본문 (`spec.md`)의 Goals / Requirements / Acceptance가 본 문서의 **검증된 사실**에 1:1 매핑된다.

---

## 1. Release Readiness 진단 결과 (2026-05-04 기준)

전체 7.2/10. 기능 측면 v1.0 도달 가능, 그러나 governance 정합성 결여로 **RC 선언 불가**.

| 영역 | 점수 | 상태 | Blocker |
|---|---|---|---|
| 기능 완성도 | 8.5/10 | OK | — |
| CI / PR | 5.5/10 | UNSTABLE | PR #20, #21 모두 OPEN |
| Issue 정합성 | 6.0/10 | UNSTABLE | #12, #13 미 closure |
| Branch 거버넌스 | 6.0/10 | UNSTABLE | feature 브랜치 미머지, .worktrees/ 미정리 |
| Session State | 7.0/10 | UNSTABLE | session-memo.md uncommitted |
| **종합** | **7.2/10** | **UNSTABLE** | RC 선언 불가 |

---

## 2. PR #21 CI 실패 분석 (Issue #30 기반)

### 2.1 실패 파일 목록

| 파일 | 검사기 | 위반 룰 | 수정 방향 |
|---|---|---|---|
| `app/api/ra/profile/route.ts` | biome | format | 자동 포맷팅 적용 (`biome format --write`) |
| `lib/auth/department.ts` | biome | format | 자동 포맷팅 적용 |
| `lib/audit.ts` | biome lint | `noExplicitAny` | `any` → `unknown` + 타입 가드, 또는 정확한 타입 부여 |
| `tests/unit/auth/department.test.ts` | biome lint | `forEach` 룰 | `Array.prototype.forEach` → `for...of` 변환 |

### 2.2 수정 시 주의점

- **runtime 행위 변경 금지**: lib/audit.ts의 `any` 제거가 가장 위험. `unknown`으로 좁힌 후 타입 가드를 통과한 분기에서만 기존 로직과 동일하게 동작해야 함. 기존 unit test (있다면) 유지로 검증.
- **public API surface 보존**: `lib/auth/department.ts`는 단순 포맷이지만, export shape이 변경되지 않도록 diff 검토 필수.
- **테스트 의도 보존**: `tests/unit/auth/department.test.ts`의 `forEach` → `for...of` 변환 시 테스트 시나리오, assertion 순서, 종료 조건 동일성 보장.

### 2.3 lint policy 검토 — 변경 금지 영역

본 SPEC scope는 **코드 수정**이지 **lint config 수정**이 아니다. 즉 `biome.json`의 룰 활성화/비활성화는 본 SPEC에서 제외 (Out of Scope).

---

## 3. PR #20 E2E PENDING 분석

### 3.1 현재 CI 상태

| Check | 상태 |
|---|---|
| Gates | PASS |
| Security | PASS |
| Eval | PASS |
| Playwright E2E (chromium) | PENDING |
| Playwright E2E (firefox) | PENDING |
| Playwright E2E (webkit) | PENDING |

### 3.2 PENDING 원인 후보

(verification 필요, 본 research 단계에서 확정하지 않음)

- CI runner 환경에서 browser binary 미설치 또는 outdated
- 특정 테스트 시나리오 timeout
- 인증 세션 셋업 누락 (recent commit `ae48d12`에서 citation-click 테스트는 이미 skip 처리됨, 다른 테스트도 유사 영향 가능)
- Worker 동시성 / shared resource 충돌

### 3.3 검증 절차

1. PR #20의 가장 최근 CI 로그를 `gh run view`로 확인
2. PENDING이 단순 timeout인지, 실패인지, 미실행인지 분류
3. 미실행이면 CI workflow trigger 재검토 (브랜치 protection 또는 manual approve 필요한지)
4. 실패면 artifact (screenshot, trace) 다운로드 후 시나리오 분석

---

## 4. Issue #12, #13 미 closure 원인

### 4.1 Issue #12 — Phase 10 Regulatory Radar

- **구현 commit**: `9b7adda` (verified)
- **관련 SPEC**: SPEC-REGULA-RADAR-001
- **commit이 main에 머지 여부**: 본 research 시점 verification 필요. 만약 머지 안 됐다면 Issue closure 자체가 부적절 → REQ-GATE-013 (PR merge) 선행 필요.
- **closure 누락 원인 추정**: 구현 PR merge 시 `Closes #12` 또는 `Fixes #12` keyword가 commit message나 PR body에 누락됨

### 4.2 Issue #13 — Phase 11 External Public Data Enrichment

- **구현 commit**: `11bd6fa` (verified)
- **관련 SPEC**: SPEC-REGULA-NETWORK-001 v2.0 (현재 status: completed)
- **closure 누락 원인 추정**: 동일 패턴, PR merge 시 keyword 누락

### 4.3 Issue #18 — Post-mortem ADR

- **상태**: OPEN, 의도적 유지
- **이유**: post-mortem ADR 문서가 아직 작성되지 않음, scope이 본 SPEC과 분리됨
- **본 SPEC에서의 처리**: REQ-GATE-011에 따라 close 금지

---

## 5. Branch / Worktree 거버넌스 진단

### 5.1 현재 git state (verified)

```
Current branch: feature/SPEC-REGULA-NETWORK-001
M  .moai/state/session-memo.md
?? .worktrees/
```

### 5.2 분석

- **현재 브랜치**: `feature/SPEC-REGULA-NETWORK-001`은 SPEC-REGULA-NETWORK-001 v2.0 (completed) 구현 브랜치이나, 본 research 시점까지 main 머지 여부 미확정. PR #20 또는 #21 둘 중 하나가 이 브랜치 PR일 가능성 높음.
- **`.moai/state/session-memo.md` modified**: 작업 진행 상황을 기록한 session memo가 working tree에만 존재하고 commit되지 않음. SPEC 완료 시점에 final state로 commit 필요.
- **`.worktrees/` untracked**: MoAI worktree 또는 git worktree 잔여물. `.gitignore`에 등록되었어야 하지만 untracked 상태로 남아 있음 → 처리 필요.

### 5.3 처리 방향

- `.worktrees/`는 일반적으로 ephemeral / local-only directory. `.gitignore`에 등록하는 것이 표준.
- 단, 현재 untracked인 이유가 단순 누락인지 의도적인지 확인 필요.
- prune 전 `git worktree list`로 active worktree 확인하여 작업 진행 중인 worktree가 있는지 검증.

### 5.4 main clean 검증 절차

1. PR #20, #21 머지 후 `main` 체크아웃
2. `git pull --ff-only origin main`으로 최신 동기화
3. `git status` → 완전 clean 확인
4. `git log --oneline --graph -20`으로 최근 history 정합성 확인
5. `git branch -a | grep SPEC-REGULA-NETWORK-001` → 결과 empty 확인

---

## 6. Session Memo 정합성

### 6.1 `.moai/state/session-memo.md` 현재 상태

- working tree: modified (uncommitted)
- 본 research 시점에 정확한 diff는 검증되지 않음 (수정 시 read 권고)
- 본 SPEC의 acceptance criteria 4.4에 따라 **본 SPEC 완료 시점에** final state로 commit 필요

### 6.2 어떤 정보가 기록되어야 하는가

session-memo.md는 다음을 포함해야 함:

- 본 SPEC 완료 일자
- PR #20, #21 머지 결과 (merge commit hash)
- Issue #12, #13 closure 결과 (timestamp)
- 다음 단계로 인계되는 정보 (예: v1.0.0 RC 선언 가능 상태, 후속 SPEC 참조)

### 6.3 session-memo와 SPEC의 관계

- SPEC = WHAT to do (요구사항)
- session-memo = current state (현재 작업 상황)
- 둘은 보완 관계. SPEC 완료 시점에 session-memo가 최신 상태로 commit 되어야 다음 세션이 이 SPEC 결과를 바탕으로 작업 가능

---

## 7. 의존 SPEC 검증

### 7.1 SPEC-REGULA-NETWORK-001 (v2.0, status: completed)

- 구현 commit: `11bd6fa`
- Issue #13과 1:1 매핑
- 본 SPEC의 REQ-GATE-010 (Issue #13 closure) 수행을 위해 main 머지 필수

### 7.2 SPEC-REGULA-RADAR-001

- 구현 commit: `9b7adda`
- Issue #12와 1:1 매핑
- 본 SPEC의 REQ-GATE-009 (Issue #12 closure) 수행을 위해 main 머지 필수

### 7.3 SPEC-REGULA-RELEASE-001 (v0.1.0, draft)

- 본 SPEC과 별개. v1.0.0 RC 선언을 다루는 별도 SPEC.
- 본 SPEC이 완료되어야 SPEC-REGULA-RELEASE-001이 진행 가능 (선후 관계).
- 단, 본 SPEC이 직접 `depends_on`으로 참조하지는 않음 (반대 방향).

---

## 8. 검증 명령어 모음 (Acceptance Reproducibility)

본 SPEC의 acceptance criteria가 machine-verifiable이 되도록 명령어를 정리한다.

```bash
# PR CI status
gh pr checks 20 --json name,bucket,state | jq '.'
gh pr checks 21 --json name,bucket,state | jq '.'

# Issue state
gh issue view 12 --json state -q .state
gh issue view 13 --json state -q .state
gh issue view 18 --json state -q .state

# Branch existence
git branch --list 'feature/SPEC-REGULA-NETWORK-001'
git ls-remote --heads origin 'feature/SPEC-REGULA-NETWORK-001'

# Worktree state
git worktree list
git status

# Lint check (수동 재현)
pnpm biome ci app/api/ra/profile/route.ts lib/audit.ts lib/auth/department.ts tests/unit/auth/department.test.ts
```

---

## 9. Open Questions (해결되어야 할 불확실성)

1. PR #20과 PR #21 각각의 base/head 브랜치 — 두 PR이 동일 feature 브랜치 PR인지, 별개 브랜치 PR인지 verification 필요. 만약 동일 브랜치라면 한쪽 머지가 다른 쪽에 영향.
2. `.worktrees/`가 `.gitignore`에 이미 있는지 verification 필요. 있는데도 untracked로 잡힌다면 git index 갱신 문제.
3. `lib/audit.ts`의 `any` 사용 위치 — runtime 안전성 검증을 위해 정확한 라인과 사용 패턴 확인 필요.
4. PR #20 E2E PENDING의 정확한 원인 — log를 확인하기 전까지 확정 불가.
5. Issue #12/#13 구현 commit이 실제로 main에 도달한 시점 — `git log main --oneline | grep -E '9b7adda|11bd6fa'`로 verification 필요.

이 Open Questions들은 RUN 단계 시작 시 가장 먼저 해소되어야 하며, 해소되지 않으면 acceptance criteria가 verifiable 상태가 되지 않을 수 있다.

---

## 10. 결론

본 SPEC은 **신기능 추가가 아닌 정합성 회복**이 목표이다. 모든 작업은 이미 완료된 구현물에 대한 governance 정리에 해당하며, 코드 수정 범위는 lint/format에 한정된다.

작업 우선순위는 명확하다:

1. **PR CI green** (P0-1, P0-2) — 머지 가능 상태 만들기
2. **PR merge** (P0-3) — 구현물을 main에 반영
3. **Issue closure** (P0-4) — main에 도달한 구현물에 대해 정식 closure
4. **Branch / worktree 정리** (P0-5) — governance 정합 회복
5. **Session memo commit** (P0-6) — 다음 세션 인수인계 준비

모든 단계가 완료되면 별도 release SPEC이 본 SPEC을 prerequisite로 참조하여 v1.0.0 RC 선언으로 진행할 수 있다.
