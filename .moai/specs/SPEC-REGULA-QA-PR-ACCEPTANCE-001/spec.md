# SPEC-REGULA-QA-PR-ACCEPTANCE-001

## Metadata

- Issue: #76
- Status: Active
- Created: 2026-06-20
- Updated: 2026-06-21
- Priority: High (RC-blocking)
- Category: QA Gate 2 — PR acceptance QA
- Governing SSoT: `docs/qa/qa-gate-definitions.md` §Gate 2, `.moai/specs/_shared/qa-gate-roadmap.md` §4

## HISTORY

- 2026-06-20: Draft created — basic EARS scaffold (4 REQs).
- 2026-06-21: Promoted Draft → Active. Expanded EARS to 8 REQs covering all PASS rows of `qa-gate-definitions.md` §Gate 2 (added explicit a11y/axe-core and security/gitleaks requirements). Added Application Scope, Evidence Artifacts, SSoT Alignment sections.

## Purpose

Define acceptance criteria that every PR must satisfy before merge into `main`. Gate 2 prevents regressions, undocumented behavior changes, incomplete feature merges, accessibility violations, and security findings from reaching `main`. It is the final pre-merge gate and is **RC-blocking**.

## Scope

- **Applied**: Before merging any feature PR into `main`.
- **Covers**: CI green, typecheck, lint, tests with baseline, accessibility (axe-core), security (gitleaks + dependency scan), evidence package, SPEC AC coverage, reviewer sign-off, regression in existing E2E or eval baselines.
- **Out of scope**: Production smoke test (Gate 5), domain UAT (Gate 4), cross-feature integration (Gate 3).

## Application Scope

Gate 2 applies to **38 PR-acceptance scope issues** per `docs/qa/qa-matrix.md` §Gate Assignment Summary. These are the issues whose `Gate` column reads `Gate 2` in the per-issue gate assignment table (rows spanning #22–#92, excluding the infra/E2E/UAT/ops rows assigned to Gates 3–5).

Reference: `docs/qa/qa-gate-definitions.md` §Gate 2 — "Applies to: every PR that merges into `main`."

For the authoritative per-issue list, grep `docs/qa/qa-matrix.md` for `| Gate 2 |`. This SPEC must not duplicate the list because the matrix is the SSoT for issue-to-gate assignment.

## Requirements (EARS format)

**REQ-G2-001 (Event-Driven)**: WHEN a PR is opened, THE SYSTEM SHALL run CI (typecheck, lint, unit tests) and require `gh pr checks <N>` to be all green before review begins.

**REQ-G2-002 (Event-Driven)**: WHEN a PR modifies a public API, DB, RBAC, audit, citation, export, i18n, a11y, or security contract, THE SYSTEM SHALL require the corresponding contract test updates in the same PR.

**REQ-G2-003 (Unwanted Behavior)**: IF test coverage drops below the baseline established at Gate 1, THEN THE SYSTEM SHALL block merge until coverage is restored or improved.

**REQ-G2-004 (Event-Driven)**: WHEN a PR implements a SPEC requirement, THE SYSTEM SHALL verify each acceptance criterion is covered by a test or documented manual QA evidence in the PR body.

**REQ-G2-005 (Unwanted Behavior)**: IF the changed surface is user-facing, THEN THE SYSTEM SHALL require axe-core violations equal to zero for the changed surfaces before merge.

**REQ-G2-006 (Unwanted Behavior)**: IF gitleaks or dependency scan reports a finding, THEN THE SYSTEM SHALL block merge until the finding is resolved or explicitly waived with recorded risk acceptance.

**REQ-G2-007 (Unwanted Behavior)**: IF the PR causes a regression in existing E2E or eval baselines, THEN THE SYSTEM SHALL block merge until the regression is resolved or the baseline is re-baselined with justification.

**REQ-G2-008 (Event-Driven)**: WHEN a PR is ready for merge, THE SYSTEM SHALL require (a) a `QA evidence` section in the PR body (CI artifact, screenshots, audit log dump) and (b) a `QA signoff` comment with explicit PASS / WAIVED / BLOCKED status.

## Evidence Artifacts

Gate 2 produces two artifacts defined in `docs/qa/qa-matrix.md` §QA Comment Templates:

1. **`QA evidence`** section in the PR body — fields: Commit or PR, Commands, Results, Artifacts, Manual signoff, Residual risk.
2. **`QA signoff`** comment before merge — fields: Gate status (PASS / WAIVED / BLOCKED), Approver, Evidence links, Closure decision.

Release blockers require explicit PASS / WAIVED / BLOCKED status per `qa-gate-definitions.md` §Gate 2 Output artifact.

## SSoT Alignment

- **Primary SSoT**: `docs/qa/qa-gate-definitions.md` §Gate 2 (PASS conditions table).
- **Roadmap SSoT**: `.moai/specs/_shared/qa-gate-roadmap.md` §4 (Gate 2 PASS summary).
- **Conflict policy**: On conflict between this SPEC and either SSoT file, **the SSoT wins**. This SPEC must not redefine PASS conditions; it operationalizes them.

## Acceptance Criteria

1. All CI checks pass (typecheck, lint, unit tests, contract tests) — `gh pr checks <N>` all green.
2. No coverage regression from Gate 1 baseline (baseline maintained or improved).
3. Each SPEC acceptance criterion covered by a test or a linked manual QA evidence entry.
4. axe-core violations equal zero for changed user-facing surfaces.
5. gitleaks and dependency scan clean (or findings waived with recorded risk).
6. No regression in existing E2E or eval baselines.
7. `QA evidence` section complete in PR body (CI artifact, screenshots, audit log dump).
8. `QA signoff` comment posted with PASS / WAIVED / BLOCKED status before merge.
9. At least one reviewer approval and no unresolved blocking review comments.

## Gate Checklist

- [ ] CI green (`gh pr checks <N>` all passing)
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean
- [ ] `pnpm test` passes with baseline maintained or improved
- [ ] axe-core violations = 0 for changed surfaces
- [ ] gitleaks + dependency scan clean (or waived with risk recorded)
- [ ] Each SPEC AC covered by test or QA note
- [ ] `QA evidence` section complete (commands, results, artifacts, manual signoff, residual risk)
- [ ] `QA signoff` comment posted (PASS / WAIVED / BLOCKED)
- [ ] Reviewer approved; no blocking unresolved comments

## Definition of Done

- All checklist items checked.
- `QA signoff` status is PASS.
- PR merged to `main`.

## References

- `docs/qa/qa-gate-definitions.md` §Gate 2
- `docs/qa/qa-matrix.md` §QA Comment Templates (### QA evidence, ### QA signoff), §Gate Assignment Summary
- `.moai/specs/_shared/qa-gate-roadmap.md` §2, §4
- Related SPECs: SPEC-REGULA-RELEASE-GATE-001 (primary owner per roadmap §2)
- Plan/Sync-only modification policy: see `qa-gate-roadmap.md` §5
