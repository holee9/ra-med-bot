# SPEC-REGULA-QA-WAVE-INTEGRATION-001

## Metadata

- Issue: #77
- Status: Active
- Created: 2026-06-20
- Updated: 2026-06-21
- Priority: Medium (post-RC activation)
- Category: QA Gate 3 — Wave integration scenario testing
- Governing SSoT: `docs/qa/qa-gate-definitions.md` §Gate 3, `.moai/specs/_shared/qa-gate-roadmap.md` §4

## HISTORY

- 2026-06-20: Draft created — basic EARS scaffold (4 REQs).
- 2026-06-21: Promoted Draft → Active. Expanded EARS to 7 REQs covering all PASS rows of `qa-gate-definitions.md` §Gate 3 (Foundation+Chat+RAG+Workflow flows; upload→ingest→search→answer→audit data flow; 4 RA persona journeys). Added Application Scope, Evidence Artifacts, SSoT Alignment sections.

## Purpose

Validate that all features merged in a Wave work correctly end-to-end together, catching cross-feature integration regressions and shared-state (audit log, RBAC, citations) drift before domain UAT begins. Gate 3 activates **after the first RC** as part of the v0.2 operations phase.

## Scope

- **Applied**: After all Wave feature PRs are merged to `main` and each has individually passed Gate 2; before domain UAT (Gate 4).
- **Covers**: Cross-feature E2E flows (Foundation + Chat + RAG + Workflow), end-to-end data flow (upload → ingest → search → answer → audit), 4 canonical RA persona journeys, audit log chain integrity across shared state, RBAC boundary behavior across integrated features.
- **Out of scope**: Individual feature unit tests (Gate 1), PR-level CI gates (Gate 2), domain-expert sign-off (Gate 4), production deployment validation (Gate 5).

## Application Scope

Gate 3 applies to **2 issues** per `docs/qa/qa-matrix.md` §Gate Assignment Summary: **#81** (Wave 1 E2E smoke — Foundation/chat E2E) and **#82** (Wave 2 E2E flow — RAG/expert review E2E). Both are E2E gate / infra issues with no SPEC owner (rows read `no (infra)`).

Additionally, Gate 3 activates after Wave-level features across Waves 3/4/5 are individually green through Gate 2. The gate tracks **#80–#83** (E2E infra/gate issues) and the Wave 3/4/5 lanes that depend on integrated behavior, per `docs/qa/qa-gate-definitions.md` §Gate 3 Application scope.

Reference: `docs/qa/qa-gate-definitions.md` §Gate 3 — "Applies to: cross-feature integration scenarios after the first RC."

## Requirements (EARS format)

**REQ-G3-001 (Event-Driven)**: WHEN all Wave feature PRs are merged and individually green through Gate 2, THE SYSTEM SHALL execute the Wave integration test suite covering all cross-feature scenarios.

**REQ-G3-002 (Event-Driven)**: WHEN the integration suite runs, THE SYSTEM SHALL verify the Foundation + Chat + RAG + Workflow flow passes end-to-end.

**REQ-G3-003 (Event-Driven)**: WHEN the integration suite runs, THE SYSTEM SHALL verify the upload → ingest → search → answer → audit data flow passes with consistent state at each stage.

**REQ-G3-004 (Event-Driven)**: WHEN the integration suite runs, THE SYSTEM SHALL execute the 4 canonical RA persona journey scenarios and require all 4 to pass.

**REQ-G3-005 (Event-Driven)**: WHEN a citation flows from RA query through to audit log, THE SYSTEM SHALL verify the citation ID, source section, and confidence score are consistent across all layers.

**REQ-G3-006 (Unwanted Behavior)**: IF an RBAC-protected resource is accessed by a role without permission, THEN THE SYSTEM SHALL return 403 and the denial SHALL appear in the audit log.

**REQ-G3-007 (Event-Driven)**: WHEN the Wave integration suite completes, THE SYSTEM SHALL produce a test report listing passed, failed, and skipped scenarios with evidence links, attached to the Wave milestone.

## Evidence Artifacts

Gate 3 produces a **Wave integration test report** linked in the Wave milestone comment. The report references:
- Playwright JUnit / trace artifacts from #81 (Wave 1 smoke) and #82 (Wave 2 flow),
- CI workflow validation and artifact retention evidence from #83 (per `qa-matrix.md` rows #80–#83).

Gate 3 does not introduce a new comment template; it consumes the `QA evidence` template (defined in `qa-matrix.md` §QA Comment Templates) for the Wave milestone summary.

## SSoT Alignment

- **Primary SSoT**: `docs/qa/qa-gate-definitions.md` §Gate 3 (PASS conditions table, Application scope).
- **Roadmap SSoT**: `.moai/specs/_shared/qa-gate-roadmap.md` §4 (Gate 3 PASS summary).
- **Conflict policy**: On conflict between this SPEC and either SSoT file, **the SSoT wins**. This SPEC must not redefine PASS conditions; it operationalizes them.

## Acceptance Criteria

1. Cross-feature E2E flow (Foundation + Chat + RAG + Workflow) passes.
2. End-to-end data flow (upload → ingest → search → answer → audit) validated.
3. 4 canonical RA persona journey scenarios pass.
4. Cross-feature audit log integrity verified: citation ID, source section, and confidence score consistent from query through storage to UI for at least 2 golden-path flows.
5. RBAC boundary tests pass for all new roles introduced in the Wave; denials appear in audit log.
6. No regression in existing Wave tests from prior Waves (0 new failures).
7. Integration test report generated and linked in the Wave milestone comment.

## Gate Checklist

- [ ] All Wave feature PRs merged and individually green through Gate 2
- [ ] Cross-feature Foundation + Chat + RAG + Workflow E2E passes
- [ ] upload → ingest → search → answer → audit data flow validated
- [ ] 4 canonical RA persona journeys pass
- [ ] Audit log chain integrity verified for at least 2 golden-path flows
- [ ] RBAC boundary tests pass for new Wave roles
- [ ] Prior Wave regression: 0 new failures
- [ ] Integration report linked in Wave milestone comment

## Definition of Done

- Integration test suite green across cross-feature E2E, data flow, and persona journeys.
- Integration report attached to Wave milestone with evidence links to #81 / #82 / #83 artifacts.
- Wave milestone updated with Gate 3 PASS status.

## References

- `docs/qa/qa-gate-definitions.md` §Gate 3
- `docs/qa/qa-matrix.md` §Gate Assignment Summary, rows #80–#83
- `.moai/specs/_shared/qa-gate-roadmap.md` §2, §4
- Related SPECs: post-v0.1 ownership per roadmap §2
- Plan/Sync-only modification policy: see `qa-gate-roadmap.md` §5
