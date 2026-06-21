# SPEC-REGULA-QA-DOMAIN-UAT-001

## Metadata

- Issue: #78
- Status: Active
- Created: 2026-06-20
- Updated: 2026-06-21
- Priority: High (post-RC, domain-expert dependent)
- Category: QA Gate 4 — Domain UAT (User Acceptance Testing)
- Governing SSoT: `docs/qa/qa-gate-definitions.md` §Gate 4, `.moai/specs/_shared/qa-gate-roadmap.md` §4

## HISTORY

- 2026-06-20: Draft created — basic EARS scaffold (4 REQs). Citation accuracy threshold set to 90%; expert count set to 1.
- 2026-06-21: Promoted Draft → Active. Expanded EARS to 7 REQs covering all PASS rows of `qa-gate-definitions.md` §Gate 4. **SSoT-driven corrections**: raised citation accuracy threshold 90% → **95% on a 50-sample audit**; raised required expert signoff count 1 → **≥ 3 RA domain experts**; added explicit source-use license review requirement. Added Application Scope, Evidence Artifacts, SSoT Alignment sections.

## Purpose

Validate that implemented features meet real-world RA domain requirements through structured UAT sessions with RA domain experts. Gate 4 is mandatory for citation-producing issues and activates **after the first RC** as part of the v0.2 operations phase (domain-expert availability dependent).

## Scope

- **Applied**: After Gate 3 integration suite passes, for issues that produce user-facing RA claims, citations, or expert-reviewed artifacts.
- **Covers**: Domain accuracy of RA answers, citation accuracy and relevance, source-use license compliance, workflow UX, compliance scenario coverage, expert signoff.
- **Out of scope**: Infrastructure, CI pipeline, internal code quality (covered by Gates 1–3), production operations monitoring (Gate 5).

## Application Scope

Gate 4 applies to **11 citation-producing issues** per `docs/qa/qa-matrix.md` §Gate Assignment Summary. These rows set `manual signoff` to `required` and are marked `Domain UAT` in the matrix.

Authoritative list from `docs/qa/qa-gate-definitions.md` §Gate 4 Application scope:
**#23, #40, #53, #59, #60, #61, #66, #69, #70, #84, #85.**

Reference: `docs/qa/qa-gate-definitions.md` §Gate 4 — "Mandatory for citation-producing issues (marked `Domain UAT` in the matrix)."

For verification, grep `docs/qa/qa-matrix.md` for `| Gate 4 |`.

## Requirements (EARS format)

**REQ-G4-001 (Event-Driven)**: WHEN Gate 3 passes, THE SYSTEM SHALL schedule UAT sessions with **at least 3 RA domain experts** and collect explicit signoff from each.

**REQ-G4-002 (Event-Driven)**: WHEN a UAT session runs, THE SYSTEM SHALL provide a structured scenario script covering: query → answer → citation → audit trail → expert review.

**REQ-G4-003 (Event-Driven)**: WHEN UAT citation accuracy is measured, THE SYSTEM SHALL require **≥ 95% accuracy on a 50-sample audit** (correct source and correct section reference) before Gate 4 approval.

**REQ-G4-004 (Event-Driven)**: WHEN cited sources are reviewed, THE SYSTEM SHALL complete a source-use license review for every cited source and record the result before Gate 4 approval.

**REQ-G4-005 (Unwanted Behavior)**: IF a UAT tester identifies a citation that is incorrect or irrelevant, THEN THE SYSTEM SHALL log the finding as a UAT defect and require a fix before Gate 4 approval.

**REQ-G4-006 (Event-Driven)**: WHEN UAT completes, THE SYSTEM SHALL produce a UAT sign-off document with tester names, dates, scenarios run, defects found, citation accuracy sample, source-use review results, and an accept/reject decision.

**REQ-G4-007 (Unwanted Behavior)**: IF any P0 UAT defect is open at sign-off time, THEN THE SYSTEM SHALL block Gate 4 approval until the defect is resolved.

## Evidence Artifacts

Gate 4 produces a **UAT sign-off document** stored at `.moai/qa/uat/<wave>-uat-signoff.md`. The document references the `QA signoff` template (defined in `docs/qa/qa-matrix.md` §QA Comment Templates) for gate status, approver, evidence links, and closure decision, and additionally records:
- Expert reviewer names (≥ 3) and dates,
- Scenarios run with per-scenario result,
- Citation accuracy sample (50-sample audit, ≥ 95% target),
- Source-use license review results,
- UAT defects found and P0 status.

## SSoT Alignment

- **Primary SSoT**: `docs/qa/qa-gate-definitions.md` §Gate 4 (PASS conditions table, Application scope).
- **Roadmap SSoT**: `.moai/specs/_shared/qa-gate-roadmap.md` §4 (Gate 4 PASS summary).
- **Conflict policy**: On conflict between this SPEC and either SSoT file, **the SSoT wins**. The 2026-06-21 promotion resolved three such conflicts in favor of the SSoT (citation accuracy, expert count, source-use review) — see HISTORY.

## Acceptance Criteria

1. At least 3 RA domain experts provide explicit signoff (names recorded in UAT sign-off document).
2. Citation accuracy ≥ 95% on a 50-sample audit (correct source, correct section reference).
3. Source-use license review complete for every cited source.
4. Audit trail complete for all UAT scenarios (query → answer → review → decision).
5. Expert review gate functions correctly (answer locked after approval).
6. Zero P0 UAT defects open at sign-off.
7. UAT sign-off document produced and stored in `.moai/qa/uat/<wave>-uat-signoff.md`.

## Gate Checklist

- [ ] Gate 3 pass confirmed
- [ ] UAT sessions scheduled with ≥ 3 RA domain experts
- [ ] Structured scenario script prepared (query → answer → citation → audit trail → expert review)
- [ ] Citation accuracy measured on 50-sample audit and ≥ 95%
- [ ] Source-use license review complete for cited sources
- [ ] All P0 defects resolved
- [ ] UAT sign-off document in `.moai/qa/uat/<wave>-uat-signoff.md` with all expert names recorded

## Definition of Done

- UAT sign-off document signed by ≥ 3 RA domain experts.
- Citation accuracy ≥ 95% on 50-sample audit.
- Source-use license review complete.
- All P0 defects closed.
- Gate 4 PASS status recorded in Wave milestone.

## References

- `docs/qa/qa-gate-definitions.md` §Gate 4
- `docs/qa/qa-matrix.md` §QA Comment Templates (### QA signoff), §Gate Assignment Summary, Domain UAT evidence level
- `.moai/specs/_shared/qa-gate-roadmap.md` §2, §4
- Related SPECs: post-v0.1 ownership per roadmap §2 (domain-expert availability dependent)
- Plan/Sync-only modification policy: see `qa-gate-roadmap.md` §5
