---
id: SPEC-REGULA-RELEASE-001
artifact: traceability-matrix
title: "Traceability Matrix — RELEASE-001 우산"
created: 2026-05-05
updated: 2026-05-05
author: manager-spec
status_legend: "pending | in-progress | verified"
---

# Traceability Matrix — SPEC-REGULA-RELEASE-001

본 매트릭스는 RELEASE-001 우산 SPEC의 모든 EARS REQ를 acceptance, test/script, GitHub issue로 연결한다. 자식 SPEC traceability-matrix.md 위임은 "delegated to" 컬럼에 명시된다.

| REQ ID | EARS Pattern | Acceptance Criteria ID | Test/Script | GitHub Issue | Delegated to (자식 SPEC) | Status |
|---|---|---|---|---|---|---|
| REQ-REL-001 | U | acceptance §Group A — REQ-REL-001 | Manual: §2.1 분류표 검증 + `gh issue list --state open --label "type/spec"` drift check | #31 | — | pending |
| REQ-REL-002 | U | acceptance §Group A — REQ-REL-002 | `gh issue view 18 --json state` (must remain OPEN), PR body grep for source issue link | #18, #28 | GATE-001 (REQ-GATE-011) | pending |
| REQ-REL-010 | ED | acceptance §Group B — REQ-REL-010 | `gh pr checks 20`, `gh pr checks 21` | #30 | GATE-001 (REQ-GATE-001~008) | pending |
| REQ-REL-011 | UB | acceptance §Group B — REQ-REL-011 | `gh issue view 12/13 --json closedAt,body`, commit hash grep | #12, #13, #30 | GATE-001 (REQ-GATE-009/010/012) | pending |
| REQ-REL-020 | U | acceptance §Group C — REQ-REL-020 | `gh run list --workflow=ci.yml`, `docs/development/local-build.md` 존재 검증 | #26 | — (본 SPEC 직접) | pending |
| REQ-REL-030 | UB | acceptance §Group D — REQ-REL-030 | `git grep -rnE "TODO\|FIXME\|placeholder" --include="*.ts" app/ lib/ workers/` | #27 | HARDENING-001 (Group D), QUALITY-001 (REQ-QUAL-011~014) | pending |
| REQ-REL-040 | UB | acceptance §Group E — REQ-REL-040 | `git grep -rnE "console\.(log\|warn\|error\|debug)" app/ lib/ workers/ --include="*.ts"` | #29 | HARDENING-001 (Group C) | pending |
| REQ-REL-050 | U | acceptance §Group F — REQ-REL-050 | `pnpm test:e2e --grep @security-headers`, audit_logs schema check | — | QUALITY-001 (REQ-QUAL-020~023) | pending |
| REQ-REL-060 | U | acceptance §Group G — REQ-REL-060 | `git status --short --branch`, `ls docs/releases/v1.0.0-rc.md`, `git tag --list "v1.0.0*"` | #28, #31 | — (본 SPEC 직접 M4) | pending |

---

## 자식 SPEC traceability roll-up

본 우산 SPEC의 status는 자식 SPEC traceability-matrix.md row의 종합 결과로 결정된다.

| 자식 SPEC | 총 REQ 수 | verified 시 본 SPEC 영향 |
|---|---|---|
| SPEC-REGULA-RELEASE-GATE-001 | 20 | REQ-REL-002, REQ-REL-010, REQ-REL-011 unblock |
| SPEC-REGULA-RELEASE-HARDENING-001 | 28 | REQ-REL-030, REQ-REL-040 unblock |
| SPEC-REGULA-QUALITY-001 | 25 | REQ-REL-030 (hybrid-router 부분), REQ-REL-050 unblock |

---

## Status 갱신 정책

- 본 SPEC RUN 단계 진입 전 모든 row는 `pending`
- 자식 SPEC RUN 완료 시 위임된 row를 `in-progress`로 갱신
- 자식 SPEC traceability-matrix.md 모든 row가 `verified` 일 때 본 SPEC 위임 row도 `verified`로 갱신
- M4 (RC declaration) 완료 시 본 SPEC 직접 row도 `verified`로 갱신

---

## References

- SPEC: `.moai/specs/SPEC-REGULA-RELEASE-001/spec.md`
- Acceptance: `.moai/specs/SPEC-REGULA-RELEASE-001/acceptance.md`
- Plan: `.moai/specs/SPEC-REGULA-RELEASE-001/plan.md`
