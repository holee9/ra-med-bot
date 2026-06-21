# SPEC-REGULA-QA-IMPLEMENTATION-CHECKPOINT-001

## Metadata

- Issue: #75
- Status: Active
- Created: 2026-06-20
- Updated: 2026-06-21
- Priority: High
- Category: QA Gate 1 — Mid-implementation checkpoint
- Governing SSoT: `docs/qa/qa-gate-definitions.md` §Gate 1, `.moai/specs/_shared/qa-gate-roadmap.md` §4

## HISTORY

- 2026-06-20: Draft created — basic EARS scaffold (4 REQs).
- 2026-06-21: Promoted Draft → Active. Expanded EARS to 7 REQs covering all PASS rows of `qa-gate-definitions.md` §Gate 1. Added Application Scope, Evidence Artifacts, SSoT Alignment sections. Aligned tooling verbs to `pnpm` (was `npm`/`npx`).

## Purpose

Provide a mid-implementation quality checkpoint to catch schema drift, incomplete negative-path coverage, contract violations, and missing audit/citation wiring before they accumulate into large PR review burdens. Gate 1 is the RUN-phase checkpoint that precedes Gate 2 PR acceptance.

## Scope

- **Applied**: During the RUN phase, at the 50% implementation milestone or when the first route handler / DB schema is committed, whichever comes first.
- **Covers**: Unit tests for the changed surface, contract tests (API, DB, RBAC, audit, citation, export), audit log wiring, citation regression, negative-path and unauthorized-access coverage.
- **Out of scope**: E2E testing (Gate 3), production deployment validation (Gate 5), domain UAT (Gate 4), PR-level CI gates (Gate 2 — Gate 1 feeds evidence into Gate 2 but does not duplicate CI policy).

## Application Scope

Gate 1 applies **commonly** to every implementation issue listed in `docs/qa/qa-matrix.md` (all rows). Unlike Gates 2–5, Gate 1 is not enumerated per issue because it is a RUN-phase obligation that every contributor must satisfy before opening a PR.

Reference: `docs/qa/qa-gate-definitions.md` §Gate 1 — "Applies to: every implementation issue during the RUN phase."

## Requirements (EARS format)

**REQ-G1-001 (Event-Driven)**: WHEN a route handler or schema change is first committed, THE SYSTEM SHALL verify `pnpm test` passes for the changed surface before the implementation checkpoint is recorded.

**REQ-G1-002 (Event-Driven)**: WHEN the changed surface touches an API, DB, RBAC, audit, citation, or export contract, THE SYSTEM SHALL run the corresponding contract test suite and require a PASS result before Gate 1 approval.

**REQ-G1-003 (Event-Driven)**: WHEN the SPEC requires audited behavior, THE SYSTEM SHALL verify that at least one `audit_logs` row is produced for each audited action and captured as test evidence.

**REQ-G1-004 (Event-Driven)**: WHEN the changed surface touches the citation flow, THE SYSTEM SHALL run `tests/e2e/citation-click.spec.ts` and require a PASS before Gate 1 approval.

**REQ-G1-005 (Unwanted Behavior)**: IF an implementation covers a happy path only, THEN THE SYSTEM SHALL require at least one negative-path test and at least one unauthorized-access (401/403) test before Gate 1 passes.

**REQ-G1-006 (Event-Driven)**: WHEN a schema change is committed, THE SYSTEM SHALL verify all dependent route handlers, test fixtures, and type definitions are updated in the same PR.

**REQ-G1-007 (Event-Driven)**: WHEN a Gate 1 checkpoint is recorded, THE SYSTEM SHALL produce a `QA checkpoint` comment on the issue summarizing commands run, results, follow-ups, and artifact links.

## Evidence Artifacts

Gate 1 produces a **`QA checkpoint`** comment on the issue, using the template defined in `docs/qa/qa-matrix.md` §QA Comment Templates (`### QA checkpoint`). The comment is pushed at least once per implementation session and before the PR is opened. Gate 1 does not produce a separate file artifact — its evidence feeds the PR body's `QA evidence` section at Gate 2.

Template fields (reference only — do not duplicate; see `qa-matrix.md`):
- Change checkpoint, Checks run, Result (PASS / FAIL / INCONCLUSIVE), Follow-up.

## SSoT Alignment

- **Primary SSoT**: `docs/qa/qa-gate-definitions.md` §Gate 1 (PASS conditions table).
- **Roadmap SSoT**: `.moai/specs/_shared/qa-gate-roadmap.md` §4 (Gate 1 PASS summary).
- **Conflict policy**: On conflict between this SPEC and either SSoT file, **the SSoT wins**. This SPEC must not redefine PASS conditions; it operationalizes them.

## Acceptance Criteria

1. `pnpm test` passes for the changed surface (unit tests).
2. Contract tests pass for every contract the change touches (API, DB, RBAC, audit, citation, export).
3. At least one negative-path test per route handler.
4. At least one unauthorized-access (401/403) test per RBAC-protected endpoint.
5. Audit log wiring verified when the SPEC requires audited behavior (`audit_logs` row evidence attached).
6. `tests/e2e/citation-click.spec.ts` passes when the citation surface is touched.
7. Schema changes propagated to types, route handlers, and test fixtures in the same PR.
8. Mock / fallback / beta behaviors labeled in UI and audit metadata.
9. No placeholder TODOs in code that affect correctness of shipped behavior.

## Gate Checklist

- [ ] `pnpm typecheck` passes with 0 errors
- [ ] `pnpm lint` passes with 0 errors
- [ ] `pnpm test` passes for the changed surface
- [ ] Contract tests pass (API / DB / RBAC / audit / citation / export as applicable)
- [ ] At least 1 negative-path test per route handler
- [ ] At least 1 unauthorized-access test per RBAC-protected endpoint
- [ ] Audit log row verified (if SPEC requires audited behavior)
- [ ] `tests/e2e/citation-click.spec.ts` passes (if citation surface touched)
- [ ] `QA checkpoint` comment posted with commands, results, and follow-ups

## Definition of Done

- Gate 1 checklist complete and reflected in the `QA checkpoint` issue comment.
- `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass locally and in CI.
- Negative-path, unauthorized-access, audit, and citation regression tests exist and pass as applicable.
- Checkpoint evidence is linked from the PR body's `QA evidence` section for Gate 2 consumption.

## References

- `docs/qa/qa-gate-definitions.md` §Gate 1
- `docs/qa/qa-matrix.md` §QA Comment Templates (### QA checkpoint)
- `.moai/specs/_shared/qa-gate-roadmap.md` §2, §4
- Related SPECs: SPEC-REGULA-RELEASE-HARDENING-001, SPEC-REGULA-QUALITY-001 (owners per roadmap §2)
- Plan/Sync-only modification policy: see `qa-gate-roadmap.md` §5
