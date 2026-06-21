# QA Gate Definitions (Gate 0 ~ Gate 5)

Updated: 2026-06-21

## Purpose

This document is the canonical definition of QA Gates 0 ~ 5 for the Regula
release family. It maps each gate to its governing issue (#73 ~ #79), states
the PASS conditions, and lists which implementation issues each gate applies
to.

The single source of truth for gate-to-spec ownership is
`.moai/specs/_shared/qa-gate-roadmap.md`. This document expands the per-issue
application surface so contributors know which gate blocks their work.

## Gate Summary

| Gate | Name | Issue | RC prerequisite | Phase |
|---|---|---|---|---|
| 0 | SPEC Readiness | #74 | Required (all in-scope SPECs) | Before branch creation |
| 1 | Implementation Checkpoint | #75 | Required (before RUN entry) | During implementation |
| 2 | PR Acceptance | #76 | Required (every PR merge) | PR review |
| 3 | Wave Integration | #77 | Recommended post-RC | Post-release |
| 4 | RA Domain UAT | #78 | Required post-RC | Post-release |
| 5 | Operations & Regression | #79 | Required post-RC | Post-release |

Gate 0 ~ 2 block the first release candidate (RC). Gate 3 ~ 5 activate in the
v0.2 operations phase, consistent with `qa-gate-roadmap.md` §2.

## Gate 0 — SPEC Readiness (#74)

**Owner SPEC**: SPEC-REGULA-QA-SPEC-READINESS-001 (Active, #74)
**Applies to**: every implementation issue in the QA matrix before code starts.

### PASS conditions

| Area | Condition |
|---|---|
| Work gate | #18 reviewed; `main` checked; duplicate branch/PR checked |
| Scope | Issue, SPEC, README, and QA matrix agree on boundaries |
| Requirements | Requirements are testable, use clear SHALL/MUST wording |
| Acceptance criteria | Each AC has a matching verification method |
| Exclusions | Deferred or out-of-scope behavior is explicit |
| Fixtures | Seed data, mocks, corpora, external API substitutes identified |
| Contracts | API, DB, RBAC, audit, citation, export, i18n, a11y, security reviewed |
| Dependencies | Blocking issues split or linked before branch creation |
| Evidence plan | `QA plan` comment exists before implementation |

### Output artifact

A `QA plan` comment on the issue in the shape defined in
[QA Matrix — QA Comment Templates](qa-matrix.md#qa-comment-templates).

### Application scope

Every row of `docs/qa/qa-matrix.md` must have a `QA plan` comment before
implementation starts. See `docs/qa/gate-0-spec-readiness.md` for the standing
preflight checklist.

## Gate 1 — Implementation Checkpoint (#75)

**Owner SPEC**: SPEC-REGULA-QA-IMPLEMENTATION-CHECKPOINT-001 (Active, #75)
**Applies to**: every implementation issue during the RUN phase.

### PASS conditions

| Area | Condition |
|---|---|
| Unit tests | `pnpm test` passes for the changed surface |
| Contract tests | API, DB, RBAC, audit, citation, export contracts pass |
| Audit entry | `audit_logs` row produced for audited actions |
| Citation regression | `tests/e2e/citation-click.spec.ts` passes when citation surface is touched |
| Negative path | At least one negative or unauthorized-access test passes |

### Output artifact

A `QA checkpoint` comment summarizing commands, results, and follow-ups. Pushed
at least once per implementation session and before PR open.

## Gate 2 — PR Acceptance (#76)

**Owner SPEC**: SPEC-REGULA-RELEASE-GATE-001, SPEC-REGULA-QA-PR-ACCEPTANCE-001 (Active, #76)
**Applies to**: every PR that merges into `main`.

### PASS conditions

| Area | Condition |
|---|---|
| CI | `gh pr checks <N>` all green |
| Typecheck | `pnpm typecheck` clean |
| Lint | `pnpm lint` clean |
| Tests | `pnpm test` passes with baseline maintained or improved |
| Accessibility | axe-core violations = 0 for changed surfaces |
| Security | gitleaks and dependency scan clean |
| Evidence | CI artifact, screenshots, audit log dump attached to PR |
| Regression | No regression in existing E2E or eval baselines |

### Output artifact

A `QA evidence` section in the PR body plus a `QA signoff` comment before merge.
Release blockers require explicit PASS / WAIVED / BLOCKED status.

## Gate 3 — Wave Integration (#77)

**Owner SPEC**: SPEC-REGULA-QA-WAVE-INTEGRATION-001 (Active, #77)
**Applies to**: cross-feature integration scenarios after the first RC.

### PASS conditions

| Area | Condition |
|---|---|
| Cross-feature E2E | Foundation + Chat + RAG + Workflow flows pass |
| Data flow | upload → ingest → search → answer → audit validated end-to-end |
| Persona journeys | 4 canonical RA persona scenarios pass |

### Application scope

Activates after Wave-level features are individually green through Gate 2.
Tracks #80 ~ #83 (E2E infra/gate issues) and the Wave 3/4/5 lanes that depend
on integrated behavior.

## Gate 4 — RA Domain UAT (#78)

**Owner SPEC**: SPEC-REGULA-QA-DOMAIN-UAT-001 (Active, #78)
**Applies to**: issues that produce user-facing RA claims, citations, or
expert-reviewed artifacts.

### PASS conditions

| Area | Condition |
|---|---|
| Expert approval | ≥ 3 RA domain experts provide explicit signoff |
| Citation accuracy | ≥ 95% on a 50-sample audit |
| Source-use rights | License review complete for cited sources |

### Application scope

Mandatory for citation-producing issues (marked `Domain UAT` in the matrix):
#23, #40, #53, #59, #60, #61, #66, #69, #70, #84, #85. These rows set
`manual signoff` to `required`.

## Gate 5 — Operations & Regression (#79)

**Owner SPEC**: SPEC-REGULA-QA-OPERATIONS-001 (Active, #79)
**Applies to**: production operations and ongoing regression monitoring.

### PASS conditions

| Area | Condition |
|---|---|
| Synthetic checks | 5 canonical queries pass on schedule |
| Rollback drill | Rollback procedure executed successfully |
| Quality metrics | latency P95, error rate, cost/query baselined |

### Application scope

Applies to infra/ops issues (#45, #49, #52, #57, #67, #71, #72, #80, #83, #88,
#89, #90, #91) and tracks the v0.2 operational readiness surface.

## Relationship to issue lifecycle

```
Issue open
  └─ Gate 0 (#74) PASS → branch created
      └─ Gate 1 (#75) checkpoints during RUN
          └─ Gate 2 (#76) PASS → PR merges
              └─ (post-RC) Gate 3 (#77) integration
                  └─ Gate 4 (#78) domain UAT
                      └─ Gate 5 (#79) operations monitoring
```

## Maintenance

- Update this file only when gate definitions, ownership, or PASS conditions
  change.
- For the cross-SPEC RACI summary, see
  [qa-gate-roadmap.md §3](../../.moai/specs/_shared/qa-gate-roadmap.md).
- For per-issue gate assignment, see the `Gate` column of
  [qa-matrix.md](qa-matrix.md).
