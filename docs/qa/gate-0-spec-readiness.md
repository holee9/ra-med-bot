# Gate 0 SPEC Readiness

Updated: 2026-05-06

## Purpose

Gate 0 is the required readiness check before implementation starts. It applies
to #22 and every later implementation issue in the QA matrix.

## Required PASS Conditions

| Area | PASS condition |
|---|---|
| Work gate | #18 reviewed, `main` checked, duplicate branch/PR checked |
| Scope | Issue, SPEC, README, and QA matrix agree on boundaries |
| Requirements | Requirements are testable and use clear SHALL/MUST wording |
| Acceptance criteria | Each AC has a matching verification method |
| Exclusions | Deferred or out-of-scope behavior is explicit |
| Fixtures | Required seed data, mocks, corpora, and external API substitutes identified |
| Contracts | API, DB, RBAC, audit, citation, export, i18n, a11y, and security impact reviewed |
| Dependencies | Blocking issues are split or linked before branch creation |
| Evidence plan | `QA plan` comment exists before implementation starts |

## Gate 0 Output

Every issue must receive a comment in this shape before code changes:

```md
## QA plan

- Scope:
- SPEC or issue source of truth:
- Acceptance criteria:
- Automated checks:
- Fixture/mock needs:
- External services:
- Risk areas:
- Gate 0 decision: PASS / BLOCKED
```

## BLOCKED Conditions

Implementation must not start when any of these are true:

- No clear source of truth exists for the issue.
- Acceptance criteria cannot be tested.
- External API, regulated source, or paid service behavior has no mock strategy.
- DB, RBAC, audit, or citation impact is unknown.
- A duplicate branch or PR already exists and has not been reconciled with `main`.

## #22 Gate 0 Preflight Snapshot

| Item | Current state before #22 |
|---|---|
| Issue | #22 open |
| SPEC | SPEC-REGULA-PREDICATE-001 named in issue title |
| Branch | Do not create until Gate 0 comment is posted |
| Required fixtures | Predicate source corpus, ranking fixture, negative/no-match fixture |
| Required checks | Unit, API contract, DB integration, Playwright search flow, audit/citation evidence |
| External dependency | FDA 510(k) source or deterministic offline substitute |
| Decision | BLOCKED until #22 receives a `QA plan` comment |

## Maintenance

- Keep this file linked from [QA Matrix](qa-matrix.md) and README.
- Update this file only when Gate 0 policy changes.
- Do not use this file as implementation evidence; use issue comments or PR bodies.
