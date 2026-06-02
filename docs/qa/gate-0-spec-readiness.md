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

Updated: 2026-06-02

| Item | Current state before #22 |
|---|---|
| Issue | #22 open |
| SPEC | SPEC-REGULA-PREDICATE-001 (draft, .moai/specs/SPEC-REGULA-PREDICATE-001/spec.md) |
| Current baseline | `847e95c` on `main` (feat(notifications): Wave 3 인프라 #123) |
| Open PRs | none |
| Stale branches | none — 6개 정리 완료 (2026-06-02, issue #124) |
| Branch | Create fresh `feat/issue-22-predicate` after Gate 0 PASS |
| Required fixtures | FDA 510(k) source corpus or deterministic offline substitute, predicate ranking fixture, negative/no-match fixture |
| Required checks | Unit, API contract, DB integration, Playwright predicate search flow, audit/citation evidence |
| External dependency | FDA 510(k) Open API (offline mock 필수) |
| Scope decision | Gap Analysis → SPEC-REGULA-PREDICATE-001에 포함하거나 #59 이후 별도 분리 결정 필요 |
| Wave 3 already merged | #52 (notifications), #84 (refine), #85 (confidence) — main에 반영됨 |
| Decision | BLOCKED — #22 이슈에 `847e95c` 기준 refreshed QA plan 코멘트 작성 후 PASS 전환 |

## Maintenance

- Keep this file linked from [QA Matrix](qa-matrix.md) and README.
- Update this file only when Gate 0 policy changes.
- Do not use this file as implementation evidence; use issue comments or PR bodies.
