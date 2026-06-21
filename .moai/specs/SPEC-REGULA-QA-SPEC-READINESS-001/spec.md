# SPEC-REGULA-QA-SPEC-READINESS-001

## Metadata

- Issue: #74
- Status: Active
- Created: 2026-06-20
- Updated: 2026-06-21
- Priority: High
- Category: QA Gate 0 — Pre-implementation readiness
- Governing SSoT: `docs/qa/qa-gate-definitions.md` §Gate 0, `.moai/specs/_shared/qa-gate-roadmap.md` §4

## HISTORY

- 2026-06-20: Draft created — basic EARS scaffold (4 REQs).
- 2026-06-21: Promoted Draft → Active. Expanded EARS to 7 REQs covering all PASS rows of `qa-gate-definitions.md` §Gate 0. Added Application Scope, Evidence Artifacts, SSoT Alignment sections.

## Purpose

Ensure every issue passes a specification readiness check before implementation begins. This gate prevents late-stage discovery of missing acceptance criteria, untestable designs, and fixture gaps that cause rework and duplicated implementation effort. Gate 0 is the branch-creation checkpoint that precedes Gate 1 implementation checkpoints.

## Scope

- **Applied**: Before creating an implementation branch — immediately after a SPEC is drafted, when restarting a stalled issue, or when reopening scope after a long pause.
- **Covers**: Issue body alignment, SPEC completeness, dependency mapping, fixture/seed/mock definitions, contract-impact axes, evidence plan.
- **Out of scope**: Code review (Gate 2), runtime QA (Gates 1, 3, 4, 5), production deployment (Gate 5).

## Application Scope

Gate 0 applies to **every implementation issue** listed in `docs/qa/qa-matrix.md` (all rows) before code starts. Unlike Gates 2–5, Gate 0 is not enumerated per issue because it is a branch-creation obligation every contributor must satisfy before the RUN phase begins.

Reference: `docs/qa/qa-gate-definitions.md` §Gate 0 — "Applies to: every implementation issue in the QA matrix before code starts." The standing preflight checklist lives in `docs/qa/gate-0-spec-readiness.md`.

## Requirements (EARS format)

**REQ-G0-001 (Event-Driven)**: WHEN a developer prepares to create an implementation branch, THE SYSTEM SHALL require the Gate 0 checklist completion recorded in the issue body or PR body, including explicit `#18` Work Gate state (latest `main`, stale branch/PR, duplicate-work check).

**REQ-G0-002 (Event-Driven)**: WHEN a SPEC document exists for an issue, THE SYSTEM SHALL verify scope alignment across the issue body, the SPEC, the README roadmap, and the `#73` QA Matrix before implementation starts.

**REQ-G0-003 (Event-Driven)**: WHEN requirements and acceptance criteria are authored, THE SYSTEM SHALL require testable SHALL/MUST wording with no ambiguous "should" language, and each AC SHALL have a matching verification method.

**REQ-G0-004 (Event-Driven)**: WHEN an issue declares contracts (API, DB, RBAC, audit, citation, export, i18n, a11y, security), THE SYSTEM SHALL require each impact axis to be explicitly reviewed and flagged Yes/No before branch creation.

**REQ-G0-005 (Unwanted Behavior)**: IF an issue has external API dependencies, seed data, or corpus needs, THEN THE SYSTEM SHALL require mock definitions and fixture identifiers to be documented before implementation begins.

**REQ-G0-006 (Unwanted Behavior)**: IF an acceptance criterion is untestable or a term is ambiguous, THEN THE SYSTEM SHALL require it to be removed or deferred to a separate follow-up issue before Gate 0 passes.

**REQ-G0-007 (Event-Driven)**: WHEN Gate 0 completes, THE SYSTEM SHALL produce a `QA plan` comment on the issue before any implementation code is committed.

## Evidence Artifacts

Gate 0 produces a **`QA plan`** comment on the issue, using the template defined in `docs/qa/qa-matrix.md` §QA Comment Templates (`### QA plan`). The comment is posted before branch creation and before any RUN-phase work. Gate 0 does not produce a separate file artifact — its evidence is the checklist-embedded comment that Gate 1 later consumes as the baseline for implementation checkpoints.

Template fields (reference only — do not duplicate; see `qa-matrix.md`):
- Work gate state, scope alignment, dependency/map, impact axes, test plan, evidence plan.

## SSoT Alignment

- **Primary SSoT**: `docs/qa/qa-gate-definitions.md` §Gate 0 (PASS conditions table, Application scope).
- **Roadmap SSoT**: `.moai/specs/_shared/qa-gate-roadmap.md` §4 (Gate 0 PASS summary).
- **Conflict policy**: On conflict between this SPEC and either SSoT file, **the SSoT wins**. This SPEC must not redefine PASS conditions; it operationalizes them.

## Acceptance Criteria

1. `#18` Work Gate state recorded (latest `main` pulled, stale branch/PR checked, duplicate-work checked).
2. Issue body, SPEC, README roadmap, and `#73` QA Matrix scope/priority agree (no silent additions or omissions).
3. All REQ/AC are testable statements using SHALL/MUST wording, with each AC mapped to a verification method.
4. Out-of-scope and deferred items explicitly listed.
5. Required fixtures, seed data, and mock external APIs defined.
6. Impact axes tagged per the SSoT 9-axis list (API, DB, RBAC, audit, citation, export, i18n, a11y, security) with Yes/No each; schema and performance may be tagged as supplementary axes beyond the SSoT minimum.
7. Prerequisite issues, external API/mocks, seed data, env/Docker/CI conditions identified.
8. `QA plan` comment posted on the issue before implementation starts.

## Gate Checklist (embed in PR body or issue comment)

- [ ] Latest `main` pulled, no stale branch conflicts
- [ ] Issue body, SPEC, README roadmap, and `#73` QA Matrix scope/priority aligned
- [ ] Prerequisite issues, external APIs/mocks, seed data, env/Docker/CI conditions identified
- [ ] Impact axes tagged: API, DB, RBAC, audit, citation, export, i18n, a11y, security (SSoT 9-axis; schema/performance optional supplementary)
- [ ] Untestable AC and ambiguous terms removed or deferred to separate issues
- [ ] `QA plan` comment posted

## Definition of Done

- Gate 0 checklist embedded in PR body or issue comment with all items checked.
- `QA plan` comment posted before branch creation.
- Reviewer confirms checklist completeness before approving branch creation.

## References

- `docs/qa/qa-gate-definitions.md` §Gate 0
- `docs/qa/gate-0-spec-readiness.md` (standing preflight checklist)
- `docs/qa/qa-matrix.md` §QA Comment Templates (### QA plan)
- `.moai/specs/_shared/qa-gate-roadmap.md` §2, §4
- Related SPECs: SPEC-REGULA-RELEASE-001 (verification owner per roadmap §2)
- Plan/Sync-only modification policy: see `qa-gate-roadmap.md` §5
