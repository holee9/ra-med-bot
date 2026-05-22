# Regula Implementation Status

Reviewed: 2026-05-22 KST
Implementation baseline commit: `da371c8`

This document reflects the Gate 0 baseline refresh from `8b3a983` to `da371c8`.
Commits since prior review: `e781ea6`, `1dcaa72`, `ce66183`, `37c7cb5`, `2340893`, `7059630`, `7b2f212`, `da371c8`.

## Executive State

Regula has a green RC baseline on `main`. Auth (Credentials + SSO) is fully
implemented and tested (Closes #109, #110, #111). Wave 3 implementation (#22
predicate search) is not yet started. The local E2E stack (Docker DB, schema,
seed, Playwright) is now operational, unblocking E2E-gated work.

## Verified Repository State

| Area | State | Evidence |
|---|---|---|
| Branch | `main` | local branch equals `origin/main` |
| Worktree | clean | `git status --short --branch` |
| Baseline commit | `da371c8` | `fix(auth): Auth.js v5 Credentials 로그인 버그 수정 및 환경 설정 업데이트` |
| Open PRs | none | `gh pr list --state open` |
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

The latest CI run on `da371c8` completed successfully.

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
| #80 | **complete** | Docker DB up, 21-table schema applied, seed seeded, 5/6 security-headers Playwright tests pass (1 skipped: Ubuntu 26.04 browser limitation) |
| #81 | open | Wave 1 E2E gate not yet executed; #80 stack is now available |
| #82 | open | Wave 2 E2E gate not yet executed; #80 stack is now available |
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

1. #22 has a Gap Analysis enhancement request. It must be either included in
   SPEC-REGULA-PREDICATE-001 or explicitly split to a follow-up after #59.
2. Stale remote branches remain: `origin/feature/SPEC-REGULA-RELEASE-HARDENING-001`,
   `origin/work/e2efix-001` — scheduled for deletion (P2).

## Next Priority

| Priority | Work | Reason |
|---|---|---|
| P0 | Begin #22 SPEC-REGULA-PREDICATE-001 implementation | Gate 0 baseline refreshed, E2E stack operational |
| P1 | Execute #81 Wave 1 E2E gate on local stack | Stack is now available |
| P2 | Delete stale remote branches | Housekeeping; no active work on those branches |
| P2 | Execute #82 Wave 2 E2E gate on local stack | Stack is now available |
