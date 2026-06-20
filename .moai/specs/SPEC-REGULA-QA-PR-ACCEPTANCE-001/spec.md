# SPEC-REGULA-QA-PR-ACCEPTANCE-001

## Metadata
- Issue: #76
- Status: Draft
- Created: 2026-06-20
- Priority: High
- Category: QA Gate 2 — PR acceptance QA

## Purpose
Define acceptance criteria that every PR must satisfy before merge into main.
Prevents regression, undocumented behavior changes, and incomplete feature merges.

## Scope
- Applied: Before merging any feature PR to main
- Covers: CI green, coverage delta, SPEC AC coverage, reviewer sign-off
- Out of scope: Production smoke test (Gate 5), domain UAT (Gate 4)

## Requirements (EARS format)

WHEN a PR is opened, THE SYSTEM SHALL run CI (type-check, lint, unit tests) and require all checks to pass before review begins.

WHEN a PR modifies a public API contract, THE SYSTEM SHALL require contract test updates in the same PR.

IF test coverage drops below the baseline established at Gate 1, THEN THE SYSTEM SHALL block merge until coverage is restored.

WHEN a PR implements a SPEC requirement, THE SYSTEM SHALL verify each AC is covered by a test or documented manual QA evidence in the PR body.

## Acceptance Criteria
1. All CI checks pass (type-check, lint, unit tests, contract tests)
2. No coverage regression from Gate 1 baseline
3. Each SPEC AC has corresponding test or manual QA evidence link
4. `QA evidence` section in PR body complete
5. At least one reviewer approval
6. No unresolved review comments marked as blocking

## Gate Checklist
- [ ] CI green (all checks pass)
- [ ] Coverage delta >= 0 from baseline
- [ ] Each AC in SPEC covered by test or QA note
- [ ] `QA evidence` section complete
- [ ] Reviewer approved
- [ ] No blocking unresolved comments

## Definition of Done
- All checklist items checked, PR merged to main
