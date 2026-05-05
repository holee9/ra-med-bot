---
id: SPEC-REGULA-RELEASE-GATE-001
artifact: traceability-matrix
title: "Traceability Matrix — RELEASE-GATE-001"
created: 2026-05-05
updated: 2026-05-05
author: manager-spec
status_legend: "pending | in-progress | verified"
---

# Traceability Matrix — SPEC-REGULA-RELEASE-GATE-001

본 매트릭스는 GATE-001의 20개 EARS REQ를 acceptance §4.1~4.5, 검증 명령, GitHub issue로 1:1 연결한다.

| REQ ID | EARS Pattern | Acceptance Criteria ID | Test/Script | GitHub Issue | Status |
|---|---|---|---|---|---|
| REQ-GATE-001 | U | acceptance §4.1 — biome format profile route | `pnpm biome ci app/api/ra/profile/route.ts` | #30 | pending |
| REQ-GATE-002 | U | acceptance §4.1 — biome format department | `pnpm biome ci lib/auth/department.ts` | #30 | pending |
| REQ-GATE-003 | ED | acceptance §4.1 — biome lint audit any | `pnpm biome ci lib/audit.ts` | #30 | pending |
| REQ-GATE-004 | ED | acceptance §4.1 — biome lint forEach test | `pnpm biome ci tests/unit/auth/department.test.ts` | #30 | pending |
| REQ-GATE-005 | SD | acceptance §4.1 — PR #21 all checks green | `gh pr checks 21` | #30, PR #21 | pending |
| REQ-GATE-006 | ED | acceptance §4.1 — Playwright 3-browser run | `gh pr checks 20`, CI workflow trigger | PR #20 | pending |
| REQ-GATE-007 | UB | acceptance §4.1 — non-green E2E blocks merge | PR check summary 검증 | PR #20 | pending |
| REQ-GATE-008 | SD | acceptance §4.1 — E2E artifact downloadable | `gh run view <id> --json artifacts` | PR #20 | pending |
| REQ-GATE-009 | ED | acceptance §4.2 — Issue #12 closure with commit `9b7adda` | `gh issue view 12 --json state,closedAt,body` | #12 | pending |
| REQ-GATE-010 | ED | acceptance §4.2 — Issue #13 closure with commit `11bd6fa` | `gh issue view 13 --json state,closedAt,body` | #13 | pending |
| REQ-GATE-011 | U | acceptance §4.2 — Issue #18 OPEN preserved | `gh issue view 18 --json state -q .state` (must be `OPEN`) | #18 | pending |
| REQ-GATE-012 | UB | acceptance §4.2 — closure blocked when commit unclear | Manual: closure note review | #12, #13 | pending |
| REQ-GATE-013 | ED | acceptance §4.3 — feature branch merged into main | `git log main --oneline | grep <merge commit>` | PR #20, #21 | pending |
| REQ-GATE-014 | ED | acceptance §4.3 — feature branch deleted | `git branch --list 'feature/SPEC-REGULA-NETWORK-001'`, `git ls-remote --heads origin 'feature/SPEC-REGULA-NETWORK-001'` | — | pending |
| REQ-GATE-015 | SD | acceptance §4.3 — `.worktrees/` 처리 | `cat .gitignore | grep .worktrees`, `git worktree list` | #28 | pending |
| REQ-GATE-016 | U | acceptance §4.3 — main clean working tree | `git status` on main | #28 | pending |
| REQ-GATE-017 | U | acceptance §4.3 — main history policy-compliant | `git log --oneline --graph -20` | — | pending |
| REQ-GATE-018 | UB | acceptance §4.3 — merge conflict pause behavior | Manual: conflict report on merge | — | pending |
| REQ-GATE-019 | ED | acceptance §4.4 — session-memo committed with status | `git log --oneline .moai/state/session-memo.md` | — | pending |
| REQ-GATE-020 | U | acceptance §4.4 — session-memo canonical handoff state | Read `.moai/state/session-memo.md` content | — | pending |

---

## Status 갱신 정책

- RUN 단계 진입 전 모든 row는 `pending`
- 각 REQ에 해당하는 작업이 시작되면 `in-progress`
- acceptance 명령이 PASS하면 `verified`
- 본 SPEC 모든 row가 `verified`일 때 RELEASE-001 traceability-matrix.md의 위임 row도 `verified`로 전이

---

## References

- SPEC: `.moai/specs/SPEC-REGULA-RELEASE-GATE-001/spec.md`
- Research: `.moai/specs/SPEC-REGULA-RELEASE-GATE-001/research.md`
- Umbrella SPEC: `.moai/specs/SPEC-REGULA-RELEASE-001/`
