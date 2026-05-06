# Regula Implementation Status

Reviewed: 2026-05-06 KST
Implementation baseline commit: `8b3a983`

This document may be committed after `8b3a983`; no implementation files are
included in this review update.

## Executive State

Regula has a green RC baseline on `main`, but Wave 3 implementation has not
started. The current state is suitable for Gate 0 planning and local E2E
environment verification before #22 implementation.

## Verified Repository State

| Area | State | Evidence |
|---|---|---|
| Branch | `main` | local branch equals `origin/main` |
| Worktree | clean | `git status --short --branch` |
| Baseline commit | `8b3a983` | `docs(qa): pre-22 gate and e2e groundwork` |
| Open PRs | none | `gh pr list --state open` |
| Latest CI | success | GitHub Actions run `25424708761` |
| Latest Deploy workflow | success | GitHub Actions run `25424708756` |
| Latest Security Scan | success | GitHub Actions run `25424708803` |
| Work gate | active | #18 remains open and mandatory |

## Implementation Surface

| Surface | Count | Notes |
|---|---:|---|
| App pages | 16 | App shell, auth, dashboard, chat, knowledge, templates, updates, workflows, admin pages |
| API route handlers | 28 | Auth, RA consult, conversations, projects, sources, updates, workflows, radar, document upload |
| Component files | 33 | Shell, chat, dashboard, forms, workflow, and reusable UI components |
| Library files | 150 | DB, auth, RAG, audit, CI, corpus, workflow, deployment helpers |
| Test/spec files | 184 | Unit, integration, E2E, eval, CI, regression, and workflow tests |
| Playwright specs | 8 | `auth`, `consultation`, `citation-click`, `expert-review`, `i18n`, `project-switch`, `a11y`, `security-headers` |

## CI Gate State

The latest CI run on `8b3a983` completed successfully.

Passed in `CI Gates`:

- Type check
- Lint
- Format check
- Unit tests
- RBAC coverage
- Audit completeness
- Token symmetry
- i18n completeness
- Regulatory glossary
- Contrast check
- Module boundaries
- Migration sequence
- Build

Important caveat:

- Playwright E2E jobs completed successfully, but `Run E2E tests` was skipped
  because staging URL was missing.
- LLM Eval Harness was skipped.
- Therefore, current CI is a green release hygiene signal, not full browser
  evidence for Wave 3 closure.

## E2E And QA State

| Issue | State | Evidence |
|---|---|---|
| #73 | documented, open as program tracker | `docs/qa/qa-matrix.md` |
| #74 | documented, open as Gate 0 tracker | `docs/qa/gate-0-spec-readiness.md` |
| #80 | partially complete, blocked | Compose config passes; Docker engine was not running for `up -d` |
| #81 | open | Wave 1 E2E gate not executed from #80 local stack |
| #82 | open | Wave 2 E2E gate not executed from #80 local stack |
| #83 | open | PR merge E2E CI gate not implemented as full running browser gate |

## Open Work Classification

Open issues: 64.

| Lane | Count | Issues |
|---|---:|---|
| Governance | 2 | #1, #18 |
| QA/E2E | 11 | #73~#83 |
| Wave 3 | 23 | #22, #23, #24, #35~#43, #47, #48, #50, #51, #52, #55, #58~#62 |
| Wave 4 | 12 | #25, #44~#46, #49, #53, #54, #56, #57, #63~#65 |
| Wave 5 | 16 | #66~#72, #84~#92 |

## Current Blockers

1. #80 lacks real local `up/migrate/seed/Playwright` evidence because Docker
   Desktop engine was not running.
2. #22 has a prior Gate 0 entry, but it references an older base commit and
   branch. It must be refreshed against `8b3a983`.
3. #22 has a Gap Analysis enhancement request. It must be either included in
   SPEC-REGULA-PREDICATE-001 or explicitly split to a follow-up after #59.
4. Merged stale branches remain visible: local `work/e2efix-001`, remote
   `origin/feature/SPEC-REGULA-RELEASE-HARDENING-001`, remote
   `origin/work/e2efix-001`. Remote deletion requires owner approval.

## Next Priority

| Priority | Work | Reason |
|---|---|---|
| P0 | Refresh #18/session/#22 Gate 0 baseline to `8b3a983` | Prevent duplicate or stale branch work before #22 |
| P0 | Complete #80 local E2E evidence | Required before treating E2E-gated work as fully verified |
| P1 | Finalize #22 QA plan and SPEC readiness | #22 implementation is currently blocked by Gate 0 |
| P2 | Implement #22 backend search core | Highest-risk predicate functionality |
| P3 | Implement #22 UI/comparison/export | Depends on stable backend contracts |
