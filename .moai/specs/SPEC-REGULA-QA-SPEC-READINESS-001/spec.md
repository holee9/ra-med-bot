# SPEC-REGULA-QA-SPEC-READINESS-001

## Metadata
- Issue: #74
- Status: Draft
- Created: 2026-06-20
- Priority: High
- Category: QA Gate 0 — Pre-implementation readiness

## Purpose
Ensure every issue passes a specification readiness check before implementation begins.
This gate prevents late-stage discovery of missing acceptance criteria, untestable designs,
and fixture gaps that cause rework and duplicated implementation effort.

## Scope
- Applied: Before creating implementation branch, immediately after SPEC is drafted, when restarting a stalled issue
- Covers: Issue body alignment, SPEC completeness, dependency mapping, fixture definitions
- Out of scope: Code review, PR acceptance, runtime QA

## Requirements (EARS format)

WHEN a developer creates an implementation branch, THE SYSTEM SHALL require Gate 0 checklist completion recorded in the issue or PR body.

WHEN a SPEC document exists for an issue, THE SYSTEM SHALL verify scope alignment between issue body, SPEC, and #73 QA Matrix before implementation starts.

IF an issue has external API dependencies, THEN THE SYSTEM SHALL require mock definitions to be documented before implementation.

WHEN Gate 0 checklist is incomplete, THE SYSTEM SHALL block branch creation or require explicit skip justification in the issue comment.

## Acceptance Criteria
1. Issue body and SPEC scope match (no silent additions or omissions)
2. All REQ/AC are written as testable statements (no ambiguous "should" language)
3. out-of-scope and deferred items explicitly listed
4. Required fixtures, seed data, and mock external APIs defined
5. citation/audit/expert-review/RBAC requirements flagged with Yes/No
6. Dependency issues and predecessor gate states confirmed
7. #18 Work Gate state recorded

## Gate Checklist (embed in PR body)
- [ ] Latest `main` pulled, no stale branch conflicts
- [ ] Issue body, SPEC, README roadmap, and #73 QA Matrix scope/priority aligned
- [ ] Prerequisite issues, external APIs/mocks, seed data, env/Docker/CI conditions identified
- [ ] Impact axes tagged: schema/API/RBAC/audit/citation/export/i18n/a11y/security/performance
- [ ] Untestable AC and ambiguous terms removed or deferred to separate issues

## Definition of Done
- Gate 0 checklist embedded in PR body or issue comment with all items checked
- Reviewer confirms checklist is complete before approving branch creation
