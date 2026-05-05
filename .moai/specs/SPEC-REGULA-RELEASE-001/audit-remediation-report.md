---
artifact: audit-remediation-report
title: "Plan-Auditor Remediation Report — SPEC-REGULA-RELEASE Family"
created: 2026-05-05
updated: 2026-05-05
author: manager-spec
scope: 4-SPEC family (RELEASE-001 / RELEASE-GATE-001 / RELEASE-HARDENING-001 / QUALITY-001)
authorizer: user (drake.lee)
remediation_tasks: ["A", "B", "C", "D", "E"]
---

# Plan-Auditor Remediation Report

본 리포트는 plan-auditor가 독립 감사를 통해 **approve-with-changes** 판정한 5개 보강 작업(A~E)의 실행 결과를 기록한다. 사용자는 A~E 전체 실행을 명시적으로 승인했다.

---

## 1. Executive Summary

| Task | 범위 | 상태 | 영향 파일 수 |
|---|---|---|---|
| A | RELEASE-001 4-doc 셋 보강 + 자식 SPEC 메타 업데이트 | ✅ 완료 | 5 |
| B | GATE-001 의존성 재구조화 + #18 처리 명료화 + REQ-HARDEN-015 EARS 수정 | ✅ 완료 | 2 |
| C | RELEASE-001 §2.1 60개 OPEN 이슈 5분류 분류표 | ✅ 완료 | 1 (RELEASE-001 spec.md §2.1) |
| D | _shared/qa-gate-roadmap.md SSoT + RACI 표 + 중복 블록 통합 | ✅ 완료 | 4 |
| E | EARS 일제 라벨링 + traceability-matrix 4종 + hybrid-router 단일 owner + frontmatter 표준화 | ✅ 완료 | 5 |

총 변경 파일: **9개 신규 + 4개 수정**

---

## 2. 변경된 파일 목록

### 2.1 신규 파일 (9개)

| # | 파일 경로 | Task | 목적 |
|---|---|---|---|
| 1 | `.moai/specs/_shared/qa-gate-roadmap.md` | D | QA Gate 0~5 SSoT |
| 2 | `.moai/specs/SPEC-REGULA-RELEASE-001/research.md` | A | 우산 SPEC research (자식 SPEC 통합 분석) |
| 3 | `.moai/specs/SPEC-REGULA-RELEASE-001/plan.md` | A | 우산 SPEC plan (M1~M4 마일스톤) |
| 4 | `.moai/specs/SPEC-REGULA-RELEASE-001/acceptance.md` | A | 우산 SPEC acceptance (REQ-REL-001~060 시나리오) |
| 5 | `.moai/specs/SPEC-REGULA-RELEASE-001/traceability-matrix.md` | E | RELEASE-001 traceability |
| 6 | `.moai/specs/SPEC-REGULA-RELEASE-GATE-001/traceability-matrix.md` | E | GATE-001 traceability (20 REQ) |
| 7 | `.moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/traceability-matrix.md` | E | HARDENING-001 traceability (28 REQ) |
| 8 | `.moai/specs/SPEC-REGULA-QUALITY-001/traceability-matrix.md` | E | QUALITY-001 traceability (25 REQ) |
| 9 | `.moai/specs/SPEC-REGULA-RELEASE-001/audit-remediation-report.md` | (본 파일) | Plan-auditor remediation 결과 보고서 |

### 2.2 수정된 파일 (4개)

| # | 파일 경로 | Task | 변경 요약 |
|---|---|---|---|
| 1 | `.moai/specs/SPEC-REGULA-RELEASE-001/spec.md` | A, C, E | frontmatter 표준화 (spec_id→id, priority/depends_on/issue_number 추가), §2.1 60개 이슈 5분류 분류표, REQ-REL-001~060 EARS 라벨 부착, REQ-REL-002 #18 처리 명료화, version 0.2.0 |
| 2 | `.moai/specs/SPEC-REGULA-RELEASE-GATE-001/spec.md` | B, D, E | depends_on=[] (NETWORK/RADAR를 verifies_specs로 이동), closes_issues=[#12,#13,#28,#30] 추가, §8 References RACI 표 + _shared 참조 추가, version 0.2.0 |
| 3 | `.moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/spec.md` | B, D, E | REQ-HARDEN-015 EARS (Optional)→(Ubiquitous) 수정 + 문법 오류 수정 ("are SHALL retain"→"shall retain"), REQ-HARDEN-020 hybrid-router ownership을 QUALITY-001로 위임 명시, closes_issues=[#27,#29] 추가, §8 References + _shared 참조 신설, version 0.2.0 |
| 4 | `.moai/specs/SPEC-REGULA-QUALITY-001/spec.md` | D, E | frontmatter 표준화 (related→related_specs, related_issues 추가, revision_history 추가), REQ-QUAL-011 hybrid-router.ts:142 sole owner 명시 노트 추가, §5 References RACI 표 + _shared 참조 + 5절 세분화, version 0.2.0 |

---

## 3. Task별 상세 변경 내역

### Task A — RELEASE-001 4-doc 보강 + 자식 SPEC 메타

#### A.1 RELEASE-001 신규 4-doc 작성
- `research.md`: 자식 SPEC 3종(GATE-001/HARDENING-001/QUALITY-001) research를 요약·참조 (중복 금지). Cross-SPEC ownership 표 §2.4 신설. 21 CFR Part 11 도메인 제약 §7 명시.
- `plan.md`: M1~M4 마일스톤 정의 (시간 추정 없음, 우선순위 기반). 각 마일스톤의 Closing Criteria checkbox.
- `acceptance.md`: REQ-REL-001~060 모든 REQ에 Given-When-Then + machine-verifiable check + Edge cases + Quality Gate (TRUST 5) + DoD 정의.

#### A.2 RELEASE-001 spec.md frontmatter 표준화
- `spec_id:` → `id:` (다른 3개 SPEC과 통일)
- `priority: Critical` 신규 추가
- `depends_on: [SPEC-REGULA-RELEASE-GATE-001, SPEC-REGULA-RELEASE-HARDENING-001, SPEC-REGULA-QUALITY-001]` 신규 추가
- `issue_number: 31` 신규 추가 (Issue #31 "[Release Spec] 1차 릴리즈 완성도 고도화 및 품질 게이트 SPEC-REGULA-RELEASE-001"에서 발견)
- `related_specs`에 자식 SPEC 3종 append
- `related_issues`에 #31, #32, #33, #34 append
- `version: 0.1.0` → `0.2.0`

### Task B — GATE-001 의존성 재구조화 + #18 + REQ-HARDEN-015

#### B.1 GATE-001 frontmatter 의존성 재구조화
- 기존 `depends_on: [SPEC-REGULA-NETWORK-001, SPEC-REGULA-RADAR-001]` 의 의미 재정의:
  - GATE-001은 NETWORK/RADAR 가 main에 머지되었는지를 **검증할 뿐**, 그 SPEC들이 GATE-001의 prerequisite은 아님 → `depends_on: []` 으로 수정
  - 검증 책임은 새 키 `verifies_specs: [SPEC-REGULA-NETWORK-001, SPEC-REGULA-RADAR-001]` 로 명시
- `closes_issues: ["#12", "#13", "#28", "#30"]` 신규 추가 (본 SPEC이 직접 close 책임)
- `related_issues` 기존 유지

#### B.2 RELEASE-001 REQ-REL-002 명료화
- 기존: "The system shall treat #18 Work Gate as mandatory for all release work." (모호함 — #18 closure 의무로 오인 가능)
- 변경: "The system shall apply the Work Gate process defined by Issue #18 (branch tracking, PR-issue linkage verification) to all release work; this requirement does NOT impose closure of Issue #18 itself, which remains intentionally OPEN until the post-mortem ADR is independently completed."

#### B.3 HARDENING-001 REQ-HARDEN-015 EARS 수정
- 기존: `(Optional)` 라벨, "Audit log writes via writeAudit() are SHALL retain..." (문법 오류 + 잘못된 EARS 분류)
- 변경: `(Ubiquitous)` 라벨, "Audit log writes via writeAudit() shall retain..."
- 정당화: `shall` 키워드는 Ubiquitous (system-wide always active)에 해당. Audit pipeline 보존은 옵션이 아니라 항상 active한 의무.

### Task C — RELEASE-001 §2.1 60개 이슈 5분류 분류표

`gh issue list --state open --label "type/spec" --limit 100` 결과 60개 + 추가 핵심 type/bug, type/adr 이슈를 다음 5개 카테고리로 분류:

| 카테고리 | 이슈 수 | 예시 |
|---|---|---|
| in-scope | 11 | #12, #13, #26~#30, #31~#34 |
| post-v0.1 | 14 | #18, #35~#38, #47~#49, #71, #72, #80~#83 |
| Wave3-backlog (Wave 3 + Wave 4 통합) | 27 | #22~#25, #39~#46, #50~#65 |
| Wave5-backlog | 14 | #66~#70, #84~#92 |
| QA-program | 7 | #73~#79 |

총 73개 이슈 분류 완료. Wave 5 issues #66~#70, #84~#92 모두 "GATE-001, HARDENING-001, QUALITY-001 완료 후" Blocked-by로 명시.

### Task D — QA Program RACI + 중복 블록 통합

#### D.1 _shared/qa-gate-roadmap.md SSoT 작성
- QA Gate 0~5 한 줄 요약 (#73~#79)
- 1차 릴리즈와의 관계 매트릭스
- RACI 표 (4개 SPEC 공통 사용)
- 게이트별 PASS 조건 요약
- 변경 정책 (수정 시 4개 SPEC 정합성 검증 필수)

#### D.2 4개 SPEC에 _shared 참조 추가
- GATE-001 spec.md §8.4: "QA 단계 게이트(0~5) 정의는 .moai/specs/_shared/qa-gate-roadmap.md를 참조하라."
- HARDENING-001 spec.md §8.5: 동일 참조 (§8 신설)
- QUALITY-001 spec.md §5.5: 동일 참조 (§5 세분화)
- RELEASE-001 spec.md §7: §2.1 분류표 마지막에 동일 참조

#### D.3 RACI 표 추가
- GATE-001 §8.5: RACI 표 7행 (보안 헤더, RBAC, Branch/PR/Issue closure, Synthetic monitoring, Domain UAT 영역)
- QUALITY-001 §5.6: 동일 RACI 표 (cross-SPEC 정합성 보장)

### Task E — EARS 일제 수정 + Traceability + hybrid-router + frontmatter

#### E.1 EARS 라벨 일제 부착
- RELEASE-001 REQ-REL-001~060 모두에 EARS 라벨 부착: REQ-REL-001 (U), REQ-REL-002 (U), REQ-REL-010 (ED), REQ-REL-011 (UB), REQ-REL-020 (U), REQ-REL-030 (UB), REQ-REL-040 (UB), REQ-REL-050 (U), REQ-REL-060 (U)
- 다른 3개 SPEC은 이미 라벨 부착됨 (HARDENING-001 REQ-HARDEN-015만 라벨 오류 → Task B.3에서 수정)

#### E.2 traceability-matrix.md 4종 작성
| SPEC | REQ row 수 |
|---|---|
| RELEASE-001 | 9 row (REQ-REL-001/002/010/011/020/030/040/050/060) + roll-up 표 |
| GATE-001 | 20 row (REQ-GATE-001~020) |
| HARDENING-001 | 28 row (REQ-HARDEN-001~028) |
| QUALITY-001 | 25 row (REQ-QUAL-001~025) |

각 row는 columns: REQ ID | EARS Pattern | Acceptance Criteria ID | Test/Script | GitHub Issue | Status. 모든 status enum: `pending` | `in-progress` | `verified`. 초기 상태 모두 `pending`.

#### E.3 hybrid-router.ts:142 ownership 단일화
- HARDENING-001 REQ-HARDEN-020 변경:
  - 기존: "migrated to a separate deferred SPEC (`SPEC-REGULA-VECTORIZE-001`)"
  - 변경: "owned by SPEC-REGULA-QUALITY-001 (REQ-QUAL-011~014); HARDENING-001 does not modify this file."
- QUALITY-001 REQ-QUAL-011 변경:
  - 기존: 단순 "TODO 0건" 요구
  - 변경: 동일 + "**Note**: This REQ is the sole owner of `lib/ai/hybrid-router.ts:142` resolution; HARDENING-001 REQ-HARDEN-020 explicitly defers to this SPEC for Vectorize fallback work."
- 효과: SPEC-REGULA-VECTORIZE-001 신규 발행 의무 해소, 4개 SPEC family 내에서 ownership 단일화

#### E.4 Frontmatter 표준화 (4개 SPEC 통일)
required key 순서: id, title, status, phase, priority, version, created, updated, author, issue_number, depends_on, [closes_issues, verifies_specs], related_specs, related_issues, labels, revision_history

| 키 | RELEASE-001 v0.2 | GATE-001 v0.2 | HARDENING-001 v0.2 | QUALITY-001 v0.2 |
|---|---|---|---|---|
| id | ✅ | ✅ | ✅ | ✅ |
| title | ✅ | ✅ | ✅ | ✅ |
| status | draft | draft | draft | draft |
| phase | release-orchestration | release-gate | release-hardening | quality-elevation |
| priority | Critical | Critical | High | High |
| version | 0.2.0 | 0.2.0 | 0.2.0 | 0.2.0 |
| created | 2026-05-04 | 2026-05-04 | 2026-05-04 | 2026-05-04 |
| updated | 2026-05-05 | 2026-05-05 | 2026-05-05 | 2026-05-05 |
| author | release-orchestrator | manager-spec | manager-spec | drake.lee |
| issue_number | 31 | 32 | 33 | 34 |
| depends_on | [GATE/HARDEN/QUALITY] | [] | [GATE-001] | [GATE-001, HARDENING-001] |
| closes_issues | — | [#12,#13,#28,#30] | [#27,#29] | — |
| verifies_specs | — | [NETWORK,RADAR] | — | — |
| related_specs | ✅ (자식 포함) | ✅ | ✅ | ✅ |
| related_issues | ✅ | ✅ | ✅ | ✅ |
| labels | release/umbrella/critical | release/gate/critical | release/hardening/high-priority | quality/rag/eval/security/infra |
| revision_history | ✅ (v0.1, v0.2) | ✅ (v0.1, v0.2) | ✅ (v0.1, v0.2) | ✅ (v0.1, v0.2) |

---

## 4. 검증 결과

### 4.1 디렉토리 구조 검증

```bash
$ ls .moai/specs/SPEC-REGULA-RELEASE-001/
acceptance.md  audit-remediation-report.md  plan.md  research.md  spec.md  tasks.md  traceability-matrix.md
```
✅ 7개 파일 모두 존재 (요구된 spec.md, tasks.md, research.md, plan.md, acceptance.md, traceability-matrix.md, audit-remediation-report.md)

```bash
$ ls .moai/specs/_shared/
qa-gate-roadmap.md
```
✅ _shared 디렉토리 신설 + qa-gate-roadmap.md 작성

```bash
$ grep -l "depends_on" .moai/specs/SPEC-REGULA-RELEASE-*/spec.md
.moai/specs/SPEC-REGULA-RELEASE-001/spec.md
.moai/specs/SPEC-REGULA-RELEASE-GATE-001/spec.md
.moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/spec.md
```
✅ 3개 RELEASE-* SPEC 모두 depends_on 키 보유 (RELEASE-001은 [3 children], GATE-001은 [], HARDENING-001은 [GATE-001])
✅ QUALITY-001도 별도 검증으로 depends_on 키 보유 ([GATE-001, HARDENING-001])

```bash
$ grep "id: SPEC-REGULA-RELEASE-001" .moai/specs/SPEC-REGULA-RELEASE-001/spec.md
2:id: SPEC-REGULA-RELEASE-001
```
✅ spec_id → id 리네임 완료

### 4.2 EARS 라벨 검증

```bash
$ grep "REQ-HARDEN-015 (Ubiquitous)" .moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/spec.md
147:#### REQ-HARDEN-015 (Ubiquitous)
```
✅ REQ-HARDEN-015 EARS 라벨 (Optional) → (Ubiquitous) 수정 완료

```bash
$ grep "REQ-HARDEN-020 (Ubiquitous)" .moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/spec.md
166:#### REQ-HARDEN-020 (Ubiquitous)
```
✅ REQ-HARDEN-020 EARS 라벨 보존 + 본문 ownership 위임 명시 완료

### 4.3 사용자 직접 재현 가능 검증 명령어

```bash
# 1. 디렉토리 구조 (Task A)
ls .moai/specs/SPEC-REGULA-RELEASE-001/
# Expected: spec.md, tasks.md, research.md, plan.md, acceptance.md, traceability-matrix.md, audit-remediation-report.md

# 2. _shared SSoT (Task D)
ls .moai/specs/_shared/
# Expected: qa-gate-roadmap.md

# 3. depends_on 키 (4개 SPEC 모두)
grep -l "^depends_on:" .moai/specs/SPEC-REGULA-RELEASE-*/spec.md .moai/specs/SPEC-REGULA-QUALITY-001/spec.md
# Expected: 4 files match

# 4. id 리네임 (Task A)
grep "^id: SPEC-REGULA-RELEASE-001" .moai/specs/SPEC-REGULA-RELEASE-001/spec.md
# Expected: id: SPEC-REGULA-RELEASE-001

# 5. EARS 라벨 (Task B.3, E.1)
grep "REQ-HARDEN-015 (Ubiquitous)" .moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/spec.md
grep "REQ-REL-001 (U)" .moai/specs/SPEC-REGULA-RELEASE-001/spec.md

# 6. closes_issues / verifies_specs (Task B)
grep -A1 "^closes_issues:" .moai/specs/SPEC-REGULA-RELEASE-GATE-001/spec.md
grep -A1 "^verifies_specs:" .moai/specs/SPEC-REGULA-RELEASE-GATE-001/spec.md

# 7. hybrid-router ownership (Task E.3)
grep "owned by SPEC-REGULA-QUALITY-001" .moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/spec.md
grep "sole owner of" .moai/specs/SPEC-REGULA-QUALITY-001/spec.md

# 8. RACI 표 (Task D)
grep "RACI Matrix" .moai/specs/SPEC-REGULA-RELEASE-GATE-001/spec.md
grep "RACI Matrix" .moai/specs/SPEC-REGULA-QUALITY-001/spec.md

# 9. _shared 참조 (Task D)
grep "_shared/qa-gate-roadmap.md" .moai/specs/SPEC-REGULA-RELEASE-*/spec.md .moai/specs/SPEC-REGULA-QUALITY-001/spec.md

# 10. traceability-matrix 4종 (Task E.2)
ls .moai/specs/SPEC-REGULA-*/traceability-matrix.md .moai/specs/SPEC-REGULA-QUALITY-001/traceability-matrix.md
```

---

## 5. 본 보강 작업이 다루지 않은 항목 (의도적 제외)

사용자가 P0+P1만 선택했으므로 다음은 본 작업 범위 밖:

- **41개 missing SPEC stub 생성** — 사용자 요청에 따라 본 작업 범위 외
- **자식 SPEC RUN 단계 진행** — 본 작업은 plan-auditor remediation에 한정. 실제 RUN은 별도 세션
- **`.claude/`, `.moai/config/`, `src/`, code 파일 수정** — 본 작업은 SPEC 메타 정합성 보강에 한정
- **Issue #18 closure** — 의도적 OPEN 유지 (REQ-REL-002, REQ-GATE-011)
- **PR #20/#21 실제 머지 작업** — RUN 단계 (M1)에서 처리

---

## 6. 다음 단계 권장 사항

1. **본 보강 결과 commit**
   - 4개 SPEC + _shared + 5개 신규 파일을 한 commit 또는 git plan에 따라 분리 commit
   - commit 메시지 prefix: `docs(specs): plan-auditor remediation for RELEASE family`
2. **GATE-001 RUN 단계 진입 준비**
   - GATE-001 traceability-matrix.md 모든 row가 `pending` 상태
   - 다음 세션에서 `/moai run SPEC-REGULA-RELEASE-GATE-001` 호출
3. **사용자 검증**
   - 본 §4.3 검증 명령어 10개 모두 실행 후 expected 결과와 비교
   - 결과 불일치 시 별도 issue 발행

---

## 7. 위험 / 결함 (보강 작업 자체에 대한 자기 비판)

- **§2.1 분류표 정확도**: `gh issue list` 결과를 수동으로 분류했으므로, 추후 신규 이슈 생성 시 drift 발생 가능. RELEASE-001 acceptance §REQ-REL-001 machine check가 5 issue drift 허용으로 완충하나, 분기별 재검증 권장.
- **traceability-matrix Status 자동화 부재**: 모든 row가 `pending` 상태로 시작. 자동 status 갱신 로직(예: CI 훅)은 본 보강 범위 밖이며, RUN 단계에서 수동 갱신 필요.
- **Cross-SPEC ownership 위반 탐지 자동화 부재**: HARDENING-001 RUN에서 누군가 hybrid-router.ts를 수정하면 REQ-HARDEN-020 위반이지만, 이를 자동 탐지하는 lint 규칙은 본 보강 범위 밖. 수동 코드 리뷰 의존.
- **Wave 3/4 통합 분류**: §2.1.3에서 Wave 3와 Wave 4를 동일 카테고리(Wave3-backlog)로 묶음. 정확한 Wave 분리가 필요한 경우 후속 분리 권장.
- **VECTORIZE-001 SPEC 미생성**: HARDENING-001 REQ-HARDEN-020 변경으로 더 이상 신규 SPEC 발행 의무 없음. 다만 plan.md (HARDENING-001) §3.4의 "새 SPEC 발행: SPEC-REGULA-VECTORIZE-001" 문장은 stale → 후속 plan.md 정합성 보강 권장.

---

## 8. References

- 본 SPEC family 4개:
  - `.moai/specs/SPEC-REGULA-RELEASE-001/`
  - `.moai/specs/SPEC-REGULA-RELEASE-GATE-001/`
  - `.moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/`
  - `.moai/specs/SPEC-REGULA-QUALITY-001/`
- 공통 SSoT: `.moai/specs/_shared/qa-gate-roadmap.md`
- 사용자 권한 부여 메모: drake.lee, 2026-05-05
- Plan-auditor 판정: approve-with-changes (cross-validation 후)
