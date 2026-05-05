---
id: SPEC-REGULA-RELEASE-001
artifact: acceptance
title: "Acceptance — First Release Readiness 우산 검증"
created: 2026-05-05
updated: 2026-05-05
author: manager-spec
phase: release-orchestration
priority: Critical
related_spec: .moai/specs/SPEC-REGULA-RELEASE-001/spec.md
---

# Acceptance Criteria — SPEC-REGULA-RELEASE-001 First Release Readiness

본 문서는 RELEASE-001 우산 SPEC의 모든 REQ-REL-* 요구사항에 대해 Given–When–Then 시나리오와 machine-verifiable check를 정의한다. 자식 SPEC(GATE-001 / HARDENING-001 / QUALITY-001)의 acceptance.md가 1차 검증이며, 본 acceptance는 **우산 레벨의 통합 검증**만 수행한다.

EARS 패턴 라벨: U=Ubiquitous, ED=Event-Driven, SD=State-Driven, O=Optional, UB=Unwanted.

---

## Group A — Release Scope Lock

### Scenario REQ-REL-001 (U) — 1차 릴리즈 scope 정의

**Given** SPEC §2.1 분류표에 60개 OPEN type/spec 이슈가 5개 카테고리(in-scope / post-v0.1 / Wave3-backlog / Wave5-backlog / QA-program)로 분류되어 있고
**And** README, roadmap, GitHub issue/PR 메타데이터가 1차 릴리즈 scope에 정합한 상태에서
**When** 사용자가 README.md 또는 roadmap을 조회하면
**Then** Wave 3~5 backlog (#22~#25, #41~#46, #50~#92 등)와 QA Program (#73~#79)이 1차 릴리즈 필수 항목으로 표시되지 않는다
**And** post-v0.1 카테고리는 별도 섹션으로 명시된다

**Machine check**:
- `grep -E "Wave [3-5]|#22|#73" README.md` 결과에 "1차 릴리즈 필수" 같은 강제어가 동반되지 않음
- `.moai/specs/SPEC-REGULA-RELEASE-001/spec.md` §2.1 분류표 row count = 60 (또는 현재 OPEN type/spec 이슈 총수)

---

### Scenario REQ-REL-002 (U) — Issue #18 Work Gate 프로세스 강제, 단 closure는 별개

**Given** 모든 release work 항목이 Issue #18에서 정의한 Work Gate 프로세스(branch tracking, PR-issue linkage verification)를 따르며
**And** Issue #18 자체는 post-mortem ADR 미완성으로 의도적으로 OPEN 유지된 상태에서
**When** 본 SPEC 또는 자식 SPEC의 RUN 단계가 진행되면
**Then** 모든 release PR은 source issue를 본문에 명시한다
**And** stale branch / duplicate implementation branch는 머지 전 검사된다
**And** Issue #18은 본 SPEC family에 의해 close 되지 않는다

**Machine check**:
- `gh issue view 18 --json state -q .state` → `OPEN`
- 모든 1차 릴리즈 관련 PR (#20, #21, 후속)의 body에 source issue 링크 grep 통과

---

## Group B — Mergeability and CI

### Scenario REQ-REL-010 (ED) — Release PR이 open 상태일 때 모든 required check 통과

**Given** PR #20 또는 PR #21 (또는 후속 release PR)가 open 상태이고
**When** PR이 머지 후보로 평가되면
**Then** 다음 check들이 모두 green:
  - CI Gates
  - Security scan (gitleaks, dependency scan)
  - LLM eval (`pnpm eval:ci` ≥ 80%, QUALITY-001 REQ-QUAL-006~007 충족 시)
  - Playwright E2E (chromium / firefox / webkit, GATE-001 REQ-GATE-006 충족 시)

**Machine check**:
- `gh pr checks 20` → all green
- `gh pr checks 21` → all green
- (자식 SPEC GATE-001 acceptance §4.1 위임)

---

### Scenario REQ-REL-011 (UB) — 미머지 PR linked issue 조기 closure 금지

**Given** Issue가 PR과 linked 되어 있으나 PR이 main에 머지되지 않은 상태에서
**When** 누군가 해당 Issue를 close 시도하면
**Then** closure는 수행되지 않거나 closure comment에 "merged commit 또는 verified main evidence" 가 포함되어야 함
**And** #12, #13의 closure comment에는 commit hash (`9b7adda`, `11bd6fa`) 명시
**And** #30 closure 시 PR #20/#21 최종 상태와 issue closure 매핑 기록

**Machine check**:
- `gh issue view 12 --json closedAt,body` → closedAt가 commit `9b7adda`의 main merge 시점 이후
- `gh issue view 13 --json closedAt,body` → closedAt가 commit `11bd6fa`의 main merge 시점 이후
- (자식 SPEC GATE-001 REQ-GATE-009/010/012 위임)

---

## Group C — Build Reproducibility

### Scenario REQ-REL-020 (U) — Bounded build verification

**Given** 로컬 또는 CI 환경에서 빌드를 시도할 때
**When** 사용자가 `pnpm ci:build` 명령을 실행하면
**Then** CI에는 build 성공 evidence (run link)가 존재
**And** 로컬 빌드 instructions에는 timeout, env placeholder 셋, hung process cleanup 절차가 포함됨
**And** 무한 정지된 로컬 빌드는 "inconclusive" 로 분류되며 PASS로 기록되지 않음

**Machine check**:
- 가장 최근 main 푸시의 CI run에서 `ci:build` job 결과 success
- `docs/development/local-build.md` 또는 동등 문서에 timeout 명시 (e.g., "max 10 minutes")
- Issue #26 (build 검증 장시간 정지 방지) 관련 커밋 기록 존재

---

## Group D — Production Placeholder Control

### Scenario REQ-REL-030 (UB) — 사용자 가시 production path에 placeholder 노출 금지

**Given** in-scope production import path (app/, lib/, workers/)에서 사용자에게 노출되는 모든 화면과 API 응답을 검증할 때
**When** 사용자가 1차 릴리즈된 시스템을 사용하면
**Then** 다음이 모두 보장됨:
  - `lib/ai/hybrid-router.ts` Vectorize runtime gap이 명시적 fallback 동작으로 해소되거나 feature flag로 가드됨 (QUALITY-001 REQ-QUAL-011~014 owner)
  - `lib/external/eu-ectd.ts`, `lib/external/fda-estar.ts`는 feature flag로 격리되어 production env에서 default `disabled` (HARDENING-001 REQ-HARDEN-018~019)
  - UI placeholder 텍스트는 일반 input placeholder, skeleton loading, 또는 문서화된 non-release surface에 한정됨
**And** Workflow Beta 페이지는 `_mock: true` 플래그와 disclosure banner를 동반함 (HARDENING-001 Group F)

**Machine check**:
- (자식 SPEC HARDENING-001 acceptance Static check D-S1 위임)
- `git grep -rnE "TODO|FIXME|placeholder" --include="*.ts" app/ lib/ workers/` → 0건 또는 모두 `@MX:TODO` + `@MX:SPEC` 동반

---

## Group E — Runtime Logging and PII Safety

### Scenario REQ-REL-040 (UB) — 운영 로그에 PII / raw query / raw answer 직접 기록 금지

**Given** runtime app/lib/workers code가 실행될 때
**When** 사용자 query, document, answer, source content를 처리하는 함수가 호출되면
**Then** 어떤 코드 경로도 `console.log/warn/error/debug`로 raw 데이터를 출력하지 않음
**And** 모든 운영 이벤트는 구조화 로거(Sentry / Langfuse / 구조화 stdout JSON)로 라우팅됨
**And** audit log는 운영 로그와 분리됨 (audit pipeline 변경 금지, HARDENING-001 REQ-HARDEN-015)

**Machine check**:
- (자식 SPEC HARDENING-001 acceptance Static check C-S1, C-S2, C-S3 위임)
- `git grep -rnE "console\.(log|warn|error|debug)" app/ lib/ workers/ --include="*.ts"` → 0건 또는 모두 `@MX:NOTE: console-allowed`

---

## Group F — Security and Compliance Gate

### Scenario REQ-REL-050 (U) — 1차 릴리즈가 보안·컴플라이언스 체크리스트 통과

**Given** 1차 릴리즈 RC 후보 빌드가 준비된 상태에서
**When** 보안·컴플라이언스 검증을 실행하면
**Then** 다음이 모두 PASS:
  - 21 CFR Part 11 append-only audit 동작 테스트 (`audit_logs` row append-only 검증)
  - Security headers E2E 통과 (chromium project, QUALITY-001 REQ-QUAL-020~023 owner)
  - Dependency scan 및 gitleaks 통과
  - Runbook과 compliance docs가 실제 env / CI / deployment 동작과 일치

**Machine check**:
- `pnpm test:e2e --grep @security-headers` → exit 0 (QUALITY-001 위임)
- `gh run list --workflow=ci.yml --branch=main --limit=1 --json conclusion -q '.[0].conclusion'` → `success`
- `audit_logs` 테이블에 UPDATE/DELETE constraint가 적용되어 있는지 schema 검사

---

## Group G — Release Handoff

### Scenario REQ-REL-060 (U) — Release tagging 전 clean handoff state

**Given** M1, M2, M3 모두 완료된 상태에서
**When** v1.0.0-rc tag 부여 직전에 검증하면
**Then**:
  - `git status --short --branch` 결과 main에서 clean (intentionally ignored / generated 제외)
  - Active PR/branch/issue mapping이 문서화됨 (release notes 또는 session-memo)
  - Release notes가 다음 8개 섹션 모두 포함:
    1. Release Summary
    2. In-Scope Features
    3. Out-of-Scope (Deferred)
    4. Quality Evidence
    5. Audit & Compliance
    6. Known Limitations
    7. Migration / Rollback
    8. Verification Commands

**Machine check**:
- `git status --short --branch` → empty 또는 `.gitignore`-listed 파일만
- `ls docs/releases/v1.0.0-rc.md` → 존재
- Release notes 8개 섹션 모두 grep으로 헤더 확인

---

## Edge Cases

| Case | Expected Behavior |
|---|---|
| 자식 SPEC 미완 상태에서 RC tag 시도 | 본 acceptance scenario REQ-REL-060 PASS 불가 → tag 부여 차단 |
| 자식 SPEC traceability-matrix.md 일부 row가 `pending` 상태 | 본 SPEC acceptance가 자식 acceptance를 위임하므로 위임된 scenario 자동 FAIL |
| Issue #18 우발적 closure 시도 | REQ-REL-002 acceptance에서 `gh issue view 18 --json state` 결과 OPEN 미달 → FAIL |
| 동일 release 작업이 2개 PR에 중복 구현 | Issue #18 Work Gate 프로세스 (REQ-REL-002)에 의해 stale branch 검사 단계에서 차단 |
| Wave 3~5 backlog가 1차 릴리즈에 의도치 않게 포함 | REQ-REL-001 acceptance 분류표 검증 단계에서 카테고리 mismatch 식별 |
| post-RC patch 발견 | 별도 SPEC (예: SPEC-REGULA-RELEASE-002) 발행. 본 SPEC scope 변경 금지 |

---

## Quality Gate Criteria (TRUST 5 통합)

| Gate | Criterion |
|---|---|
| Tested | 자식 SPEC 3종 모두 acceptance.md DoD 100% PASS, traceability-matrix.md `verified` |
| Readable | Release notes가 사용자가 1회 읽고 이해 가능한 수준 (8개 섹션 명시), `docs/releases/v1.0.0-rc.md` lint 통과 |
| Unified | 4개 SPEC frontmatter가 표준 (Task E §4) 준수, 모든 acceptance가 동일 EARS 라벨 표기법 사용 |
| Secured | Group F (REQ-REL-050) 모든 sub-check PASS |
| Trackable | RC tag (`v1.0.0-rc`)가 git에 존재, Issue #31 closure note에 tag 참조 |

---

## Definition of Done (DoD)

본 SPEC family의 종결 조건. 자식 SPEC DoD가 모두 충족된 후 본 DoD를 검증한다.

### 자식 SPEC 의존성 게이트
- [ ] SPEC-REGULA-RELEASE-GATE-001 status: completed (acceptance.md 4.1~4.5 모두 PASS)
- [ ] SPEC-REGULA-RELEASE-HARDENING-001 status: completed (acceptance.md DoD 모든 항목 PASS)
- [ ] SPEC-REGULA-QUALITY-001 status: completed (acceptance.md DoD 모든 항목 PASS)
- [ ] 3개 자식 SPEC traceability-matrix.md의 모든 row가 `verified`

### 본 SPEC 자체 게이트
- [ ] REQ-REL-001 ~ REQ-REL-060 모든 scenario PASS (또는 자식 SPEC 위임 PASS)
- [ ] §2.1 분류표가 `gh issue list --state open --label "type/spec"` 최신 결과와 정합 (drift ≤ 5 issues)
- [ ] `.moai/specs/SPEC-REGULA-RELEASE-001/traceability-matrix.md` 모든 row `verified`

### Release artifact 게이트
- [ ] `docs/releases/v1.0.0-rc.md` 존재, 8개 섹션 모두 작성됨
- [ ] `CHANGELOG.md`에 `v1.0.0-rc` 항목 추가
- [ ] `git tag v1.0.0-rc` 부여, push 완료
- [ ] Issue #31 closure note에 RC tag 링크 명시

### 거버넌스 게이트
- [ ] `git status --short --branch` clean on main
- [ ] `.moai/state/session-memo.md` final state로 main에 commit
- [ ] manager-quality TRUST 5 통합 검증 통과
- [ ] (선택) evaluator-active 4-dimension scoring 통과

---

## Verification Commands (사용자 직접 검증용)

```bash
# 1. 자식 SPEC 3종 status 확인
grep "status:" .moai/specs/SPEC-REGULA-RELEASE-GATE-001/spec.md
grep "status:" .moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/spec.md
grep "status:" .moai/specs/SPEC-REGULA-QUALITY-001/spec.md

# 2. 자식 traceability-matrix 미완 row 확인
grep -E "pending|in-progress" .moai/specs/SPEC-REGULA-RELEASE-*/traceability-matrix.md
grep -E "pending|in-progress" .moai/specs/SPEC-REGULA-QUALITY-001/traceability-matrix.md

# 3. PR / Issue 상태
gh pr list --state open --label "type/spec"
gh issue view 12 --json state
gh issue view 13 --json state
gh issue view 18 --json state  # 의도적 OPEN
gh issue view 31 --json state
gh issue view 32 --json state
gh issue view 33 --json state
gh issue view 34 --json state

# 4. Git state
git status --short --branch
git tag --list "v1.0.0*"

# 5. Release notes
test -f docs/releases/v1.0.0-rc.md && echo "Release notes exist"

# 6. Production placeholder check (HARDENING-001 위임)
git grep -rnE "TODO|FIXME|placeholder" --include="*.ts" app/ lib/ workers/

# 7. Console policy check (HARDENING-001 위임)
git grep -rnE "console\.(log|warn|error|debug)" app/ lib/ workers/ --include="*.ts"

# 8. Eval pipeline (QUALITY-001 위임)
pnpm eval:ci

# 9. Security headers E2E (QUALITY-001 위임)
pnpm test:e2e --grep @security-headers

# 10. RBAC coverage (QUALITY-001 위임)
pnpm ci:rbac
```

---

## References

- 본 SPEC: `.moai/specs/SPEC-REGULA-RELEASE-001/spec.md`
- 자식 SPEC acceptance.md (1차 검증):
  - `.moai/specs/SPEC-REGULA-RELEASE-GATE-001/acceptance.md` (작성 시)
  - `.moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/acceptance.md`
  - `.moai/specs/SPEC-REGULA-QUALITY-001/acceptance.md`
- 공통 SSoT: `.moai/specs/_shared/qa-gate-roadmap.md`
- Plan: `.moai/specs/SPEC-REGULA-RELEASE-001/plan.md`
