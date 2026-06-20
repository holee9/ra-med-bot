# SPEC-REGULA-QA-WAVE-INTEGRATION-001

## Metadata
- Issue: #77
- Status: Draft
- Created: 2026-06-20
- Priority: High
- Category: QA Gate 3 — Wave integration scenario testing

## Purpose
Validate that all features merged in a Wave work correctly end-to-end together,
catching cross-feature integration regressions before domain UAT begins.

## Scope
- Applied: After all Wave PRs are merged to main, before domain UAT
- Covers: Cross-feature flows, shared state (audit log, RBAC, citations), API chain integrity
- Out of scope: Individual feature unit tests (Gate 1/2), production deployment (Gate 5)

## Requirements (EARS format)

WHEN all Wave PRs are merged, THE SYSTEM SHALL execute the Wave integration test suite covering all cross-feature scenarios.

WHEN a citation flows from RA query through to audit log, THE SYSTEM SHALL verify the citation ID, source section, and confidence score are consistent across all layers.

IF an RBAC-protected resource is accessed by a role without permission, THEN THE SYSTEM SHALL return 403 and the denial SHALL appear in the audit log.

WHEN the Wave integration suite runs, THE SYSTEM SHALL produce a test report listing passed, failed, and skipped scenarios with evidence links.

## Acceptance Criteria
1. All Wave-scoped E2E and integration tests pass
2. Cross-feature audit log integrity verified: citation ID consistent from query → storage → UI
3. RBAC boundary tests pass for all new roles introduced in the Wave
4. No regression in existing Wave tests from prior Waves
5. Integration test report generated and linked in Wave milestone

## Gate Checklist
- [ ] All Wave feature PRs merged
- [ ] `npm run test:integration` passes
- [ ] Audit log chain integrity verified for at least 2 golden-path flows
- [ ] RBAC boundary tests pass
- [ ] Prior Wave regression: 0 new failures
- [ ] Integration report linked in Wave milestone comment

## Definition of Done
- Integration test suite green, report attached, Wave milestone updated
