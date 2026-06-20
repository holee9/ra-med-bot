# SPEC-REGULA-QA-DOMAIN-UAT-001

## Metadata
- Issue: #78
- Status: Draft
- Created: 2026-06-20
- Priority: High
- Category: QA Gate 4 — Domain UAT (User Acceptance Testing)

## Purpose
Validate that implemented features meet real-world RA domain requirements through
structured UAT sessions with domain experts (RA Lead, QA Lead, Regulatory Affairs specialist).

## Scope
- Applied: After Gate 3 integration test suite passes
- Covers: Domain accuracy of RA answers, citation relevance, workflow UX, compliance scenario coverage
- Out of scope: Infrastructure, CI pipeline, internal code quality

## Requirements (EARS format)

WHEN Gate 3 passes, THE SYSTEM SHALL schedule a UAT session with at least one RA domain expert.

WHEN a UAT session runs, THE SYSTEM SHALL provide a structured scenario script covering: query → answer → citation → audit trail → expert review.

IF a UAT tester identifies a citation that is incorrect or irrelevant, THEN THE SYSTEM SHALL log the finding as a UAT defect and require fix before Gate 4 approval.

WHEN UAT is complete, THE SYSTEM SHALL produce a UAT sign-off document with tester name, date, scenarios run, defects found, and accept/reject decision.

## Acceptance Criteria
1. At least 2 golden-path RA scenarios validated by domain expert
2. Citation accuracy >= 90% (correct source, correct section reference)
3. Audit trail complete for all UAT scenarios (query → answer → review → decision)
4. Expert review gate functions correctly (answer locked after approval)
5. Zero P0 UAT defects open at sign-off
6. UAT sign-off document produced and stored in `.moai/qa/uat/`

## Gate Checklist
- [ ] Gate 3 pass confirmed
- [ ] UAT session scheduled with domain expert
- [ ] Scenario script prepared (minimum 2 golden paths)
- [ ] Citation accuracy measured and >= 90%
- [ ] All P0 defects resolved
- [ ] UAT sign-off document in `.moai/qa/uat/<wave>-uat-signoff.md`

## Definition of Done
- UAT sign-off document signed, all P0 defects closed, Gate 4 status recorded in Wave milestone
