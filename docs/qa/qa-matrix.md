# Regula QA Matrix

Updated: 2026-06-21

## Current State

- Baseline commit: `0c802bb` (HEAD equals main)
- Open PRs: none on this branch
- Active branch: `fix/issue-73-qa-matrix` (synchronized with main)
- Canonical QA gate SSoT: `.moai/specs/_shared/qa-gate-roadmap.md`
- Gate definitions: [qa-gate-definitions.md](qa-gate-definitions.md)
- Gate 0 readiness: [gate-0-spec-readiness.md](gate-0-spec-readiness.md)

## Historical Baseline References

The following baseline references are archived and no longer used for gate assessment:

- `a63915a`: Previous Gate 0 baseline (superseded by `0c802bb`)
- `8b3a983`: Historical Gate 0 baseline (archived)
- `2c8fe91`: Historical implementation baseline (archived)


## Scope

This matrix is the working QA index for #73. It applies before #22 starts.

Included implementation and E2E issues:

- #22~#72
- #80~#92

Excluded from per-issue implementation rows:

- #73~#79: QA meta gates tracked as governing issues.
- #93~#101: superseded or closed as not planned.

Completed RC references kept as evidence anchors:

- #26, #30, #31, #97, #104, #105

Current evidence state:

- #73 matrix document exists and remains open as the QA program tracker.
- #74 Gate 0 document exists and remains open as the readiness policy tracker.
- #75 ~ #79 gate definitions are now captured in
  [qa-gate-definitions.md](qa-gate-definitions.md).
- #80 local E2E foundation exists, but full local E2E evidence is blocked until
  Docker Desktop engine is running and `up/migrate/seed/Playwright` completes.
- #22 implementation remains blocked until its Gate 0 `QA plan` is refreshed
  against current baseline commit `0c802bb`.
- #169 Traceability UI integration is present on main after PR #184 merge.
  PR #177 was closed as stale/superseded because the substantive code was
  already in main and the branch remained conflicting.
- #182 E2E user validation PR #184 is merged. Evidence: CI Gates, Playwright
  chromium/firefox/webkit, LLM Eval, E2E Smoke, Vercel preview, Security Scan,
  local `biome check .`, `tsc --noEmit`, and full `vitest run` all passed.
- #97 (E2EFIX SPEC), #104 (E2EFIX impl), #105 (DEPLOY-001 impl) tracked as RC
  release references. #98/#99/#100 are NOT_PLANNED; scope is covered by #105,
  #32, #34 instead.
- #26 (build reproducibility) and #30 (PR/CI closure integrity) closed as
  release blocker references for the #31 RC gate.

## Closure Rule

An implementation issue cannot close until its PR or issue comment contains
`QA evidence` with the command, result, and artifact or manual signoff. Release
blockers require explicit PASS, WAIVED, or BLOCKED status.

Every implementation issue must also have a `QA plan` before code starts. Gate 0
is defined in [Gate 0 SPEC Readiness](gate-0-spec-readiness.md). Gate 1 ~ Gate 5
are defined in [QA Gate Definitions](qa-gate-definitions.md).

## Evidence Levels

| Level | Evidence |
|---|---|
| Static | Typecheck, lint, formatting, schema or config validation |
| Unit | Vitest unit tests for pure logic and guards |
| Contract | API, DB, RBAC, audit, citation, or export contract checks |
| Integration | DB-backed route or service test with deterministic fixtures |
| E2E | Playwright browser flow, trace, screenshot, or JUnit output |
| Eval | promptfoo or domain evaluator result with saved output |
| Domain UAT | RA expert signoff, source-use review, or validation record |
| Validation | IQ/OQ/PQ package, SBOM, cybersecurity artifact, or model governance record |
| Ops | smoke, synthetic check, rollback drill, or monitoring evidence |

## Target Matrix

| Issue | Lane | Priority | Components | Minimum automated QA before close | Required evidence |
|---|---|---|---|---|---|
| #22 | Wave 3 | high | frontend, backend | Gate 0, unit, contract, integration, E2E | Predicate source fixture, search ranking evidence, audit/citation evidence |
| #23 | Wave 3 | high | frontend, backend, rag | Gate 0, unit, contract, eval, E2E | CER output fixture, citation accuracy sample, RA signoff |
| #24 | Wave 3 | high | frontend, backend | Gate 0, unit, contract, E2E | PCCP structured output fixture, review gate evidence |
| #25 | Wave 4 | medium | frontend, backend, infra | Gate 0, unit, integration, E2E | CRDT concurrency trace, conflict recovery evidence |
| #35 | Wave 3 | high | backend, rag | Gate 0, unit, contract, integration | Knowledge gap fixture, issue creation audit evidence |
| #36 | Wave 3 | high | frontend, backend | Gate 0, unit, contract, E2E | SLA workflow trace, reviewer action audit evidence |
| #37 | Wave 3 | high | frontend, backend | Gate 0, unit, contract, integration, E2E | Submission package fixture, lifecycle state evidence |
| #38 | Wave 3 | medium | frontend, backend | Gate 0, unit, contract, E2E | Analytics event fixture, privacy review evidence |
| #39 | Wave 3 | high | backend, rag | Gate 0, unit, contract, eval | Workflow executor fixture, LLM failure fallback evidence |
| #40 | Wave 3 | high | frontend, backend, rag | Gate 0, unit, contract, eval, E2E | Multi-market strategy fixture, citation/eval output |
| #41 | Wave 3 | high | backend, rag | Gate 0, unit, contract, integration | Radar update fixture, impact audit evidence |
| #42 | Wave 3 | high | frontend, backend, rag | Gate 0, unit, contract, eval, E2E | Jurisdiction gap fixture, source mapping evidence |
| #43 | Wave 3 | high | frontend, backend, rag | Gate 0, unit, contract, E2E | Batch request fixture, timeout/rate-limit evidence |
| #44 | Wave 4 | medium | frontend, backend | Gate 0, unit, contract, E2E | Deadline fixture, calendar export evidence |
| #45 | Wave 4 | medium | backend, rag, infra | Gate 0, unit, integration, ops | Delta sync fixture, retry and idempotency evidence |
| #46 | Wave 4 | medium | frontend, backend, rag | Gate 0, unit, contract, eval, E2E | ISO 14971 risk fixture, traceability evidence |
| #47 | Wave 3 | high | frontend, backend, rag | Gate 0, unit, contract, integration, E2E | Trace matrix artifact, immutable link audit evidence |
| #48 | Wave 3 | high | backend, rag | Gate 0, unit, contract, integration | Source authority fixture, version/expiry evidence |
| #49 | Wave 4 | high | backend, infra | Gate 0, static, contract, ops | IQ/OQ/PQ validation package evidence |
| #50 | Wave 3 | high | frontend, backend, rag | Gate 0, unit, contract, eval, E2E | Knowledge promotion fixture, RBAC and audit evidence |
| #51 | Wave 3 | high | backend, rag | Gate 0, unit, contract, integration | Project memory fixture, retention and access evidence |
| #52 | Wave 3 | high | backend, infra | Gate 0, unit, contract, integration | Notification webhook fixture, delivery/audit evidence |
| #53 | Wave 4 | high | frontend, backend, rag | Gate 0, unit, contract, eval, E2E | PMS/PMCF fixture, RA signoff evidence |
| #54 | Wave 4 | medium | frontend, backend, rag | Gate 0, unit, contract, eval, E2E | Change control fixture, impact trace evidence |
| #55 | Wave 3 | medium | frontend, backend | Gate 0, unit, contract, E2E | KPI fixture, analytics privacy evidence |
| #56 | Wave 4 | medium | frontend, backend, rag | Gate 0, unit, contract, eval, E2E | Feedback loop fixture, answer quality metric evidence |
| #57 | Wave 4 | medium | backend, infra | Gate 0, contract, integration, ops | QMS/DMS mock fixture, retry and auth evidence |
| #58 | Wave 3 | high | frontend, backend, rag | Gate 0, unit, contract, eval, E2E | Digest fixture, source freshness evidence |
| #59 | Wave 3 | high | frontend, backend, rag | Gate 0, unit, contract, eval, E2E | Classification fixture, market rule evidence |
| #60 | Wave 3 | high | backend, rag | Gate 0, unit, contract, eval | Literature search fixture, citation/source-use evidence |
| #61 | Wave 3 | high | frontend, backend, rag | Gate 0, unit, contract, eval, E2E | Vigilance report fixture, audit and expert review evidence |
| #62 | Wave 3 | high | backend, rag | Gate 0, unit, contract, integration | Standards mapping fixture, revision tracking evidence |
| #63 | Wave 4 | high | frontend, backend, rag | Gate 0, unit, contract, eval, E2E | AI/ML SaMD fixture, regulatory framework evidence |
| #64 | Wave 4 | high | frontend, backend | Gate 0, unit, contract, integration, E2E | DHF artifact fixture, traceability evidence |
| #65 | Wave 4 | high | frontend, backend | Gate 0, unit, contract, integration, E2E | eSTAR/EUDAMED/eCTD export fixture evidence |
| #66 | Wave 5 | high | frontend, backend, rag | Gate 0, unit, contract, eval, E2E | Label/IFU fixture, claim review evidence |
| #67 | Wave 5 | high | backend, rag, infra | Gate 0, static, contract, integration | SBOM/cybersecurity artifact evidence |
| #68 | Wave 5 | high | frontend, backend, rag | Gate 0, unit, contract, integration, E2E | Complaint to CAPA fixture, closed-loop audit evidence |
| #69 | Wave 5 | high | frontend, backend, rag | Gate 0, unit, contract, eval, E2E | IDE/clinical investigation fixture, RA signoff |
| #70 | Wave 5 | medium | frontend, backend, rag | Gate 0, unit, contract, eval, E2E | Reimbursement fixture, source-use evidence |
| #71 | Wave 5 | high | backend, rag, infra | Gate 0, static, contract, ops | Model/version change record, rollback evidence |
| #72 | Wave 5 | high | backend, rag, infra | Gate 0, contract, integration, ops | License entitlement fixture, source restriction evidence |
| #80 | E2E infra | high | infra | Docker compose config, DB migrate, seed, Playwright smoke | `.env.test`, docker compose, seed, local E2E command evidence |
| #81 | E2E gate | high | frontend, backend | Gate 0, Playwright Wave 1 smoke | Foundation/chat E2E JUnit or trace evidence |
| #82 | E2E gate | high | frontend, backend, rag | Gate 0, Playwright Wave 2 flow | RAG/expert review E2E artifact evidence |
| #83 | E2E gate | high | infra | CI workflow validation, Playwright artifact upload | PR check evidence and artifact retention evidence |
| #84 | Wave 5 | high | frontend, rag | Gate 0, unit, contract, eval, E2E | Answer refine fixture, regeneration audit evidence |
| #85 | Wave 5 | high | frontend, rag | Gate 0, unit, contract, eval, E2E | Confidence explanation fixture, alternate answer evidence |
| #86 | Wave 5 | medium | frontend, backend | Gate 0, unit, contract, E2E | Personal library fixture, RBAC and audit evidence |
| #87 | Wave 5 | high | frontend, backend | Gate 0, unit, contract, integration, E2E | Export/share fixture, access and audit evidence |
| #88 | Wave 5 | high | backend | Gate 0, contract, integration, ops | E-sign lock fixture, Part 11 audit evidence |
| #89 | Wave 5 | high | backend | Gate 0, contract, integration, ops | DSAR request fixture, privacy evidence |
| #90 | Wave 5 | high | backend, rag | Gate 0, contract, integration, ops | Region routing fixture, LLM/embedding proof evidence |
| #91 | Wave 5 | high | backend | Gate 0, unit, contract, integration | DLP/redaction fixture, leakage negative test evidence |
| #92 | Wave 5 | high | frontend, backend | Gate 0, unit, contract, E2E | Auditor role fixture, read-only export package evidence |
| #169 | Integration | high | frontend, backend | static, unit, contract, E2E smoke | Traceability BFF/UI/RBAC present on main; PR #177 closed superseded |

## RC Release References

Closed issues tracked as release reference anchors. They are not active
implementation rows but are linked here so the #31 RC gate can verify them.

| Issue | Title (short) | State | RC role | Evidence |
|---|---|---|---|---|
| #26 | Build reproducibility | CLOSED | Release blocker ref | Reproducible build procedure on main |
| #30 | PR #20/#21 CI closure integrity | CLOSED | Release blocker ref | CI green, #12/#13 closure |
| #31 | Release readiness umbrella SPEC | CLOSED | RC gate owner | SPEC-REGULA-RELEASE-001 |
| #97 | E2EFIX SPEC — 7-spec activation | CLOSED | RC reference | PR #106 |
| #104 | E2EFIX impl | CLOSED | RC reference | Completed, on main |
| #105 | DEPLOY-001 impl | CLOSED | RC reference | deploy.yml on main |

## Issue Metadata

Per-issue metadata required by #73. `Gate` is the highest gate that blocks the
issue from closing. `Local SPEC` shows whether a SPEC document exists under
`.moai/specs/`. `Manual signoff` marks issues that require RA domain expert
review (Gate 4). `Blocker / follow-up` lists dependencies.

| Issue | Gate | Local SPEC | Manual signoff | Blocker / follow-up |
|---|---|---|---|---|
| #22 | Gate 2 | yes (PREDICATE-001 draft) | no | #59 gap analysis split decision |
| #23 | Gate 4 | yes (CER-001) | required | citation accuracy ≥95% |
| #24 | Gate 2 | yes (PCCP-001) | no | review gate wiring |
| #25 | Gate 2 | yes (COLLAB-001) | no | CRDT conflict recovery |
| #35 | Gate 2 | yes (KNOWLEDGE-GAP-001) | no | issue creation audit |
| #36 | Gate 2 | yes (SLA-001) | no | reviewer action audit |
| #37 | Gate 2 | yes (SUBMISSION-001) | no | lifecycle state |
| #38 | Gate 2 | yes (ANALYTICS-001) | no | privacy review |
| #39 | Gate 2 | yes (WORKFLOW-EXEC-001) | no | LLM failure fallback |
| #40 | Gate 4 | yes (MULTI-MARKET-001) | required | citation/eval output |
| #41 | Gate 2 | yes (RADAR-001) | no | impact audit |
| #42 | Gate 2 | yes (JURISDICTION-001) | no | source mapping |
| #43 | Gate 2 | yes (BATCH-001) | no | timeout/rate-limit |
| #44 | Gate 2 | yes (CALENDAR-001) | no | merged via PR #209 |
| #45 | Gate 2 | yes (DOCINGEST-001) | no | delta sync, idempotency |
| #46 | Gate 2 | yes (RISK-001) | no | ISO 14971 traceability |
| #47 | Gate 2 | yes (TRACE-001) | no | immutable link audit |
| #48 | Gate 2 | yes (SOURCE-AUTHORITY-001) | no | version/expiry |
| #49 | Gate 5 | yes (VALIDATION-001) | no | IQ/OQ/PQ package |
| #50 | Gate 2 | yes (KNOWLEDGE-PROMO-001) | no | RBAC and audit |
| #51 | Gate 2 | yes (PROJECT-MEMORY-001) | no | retention and access |
| #52 | Gate 2 | yes (NOTIFY-001) | no | delivery/audit |
| #53 | Gate 4 | yes (PMS-001) | required | RA signoff |
| #54 | Gate 2 | yes (CHANGE-CTRL-001) | no | impact trace |
| #55 | Gate 2 | yes (KPI-001) | no | analytics privacy |
| #56 | Gate 2 | yes (FEEDBACK-001) | no | answer quality metric |
| #57 | Gate 5 | yes (QMS-DMS-001) | no | retry and auth |
| #58 | Gate 2 | yes (DIGEST-001) | no | source freshness |
| #59 | Gate 4 | yes (CLASSIFY-001) | required | market rule |
| #60 | Gate 4 | yes (LITERATURE-001) | required | citation/source-use |
| #61 | Gate 4 | yes (VIGILANCE-001) | required | audit and expert review |
| #62 | Gate 2 | yes (STANDARDS-001) | no | revision tracking |
| #63 | Gate 2 | yes (AIML-SAMD-001) | no | regulatory framework |
| #64 | Gate 2 | yes (DHF-001) | no | traceability |
| #65 | Gate 2 | yes (EXPORT-001) | no | eSTAR/EUDAMED/eCTD |
| #66 | Gate 4 | yes (LABEL-IFU-001) | required | claim review |
| #67 | Gate 5 | yes (CYBERSEC-001) | no | SBOM artifact |
| #68 | Gate 2 | yes (COMPLAINT-CAPA-001) | no | closed-loop audit |
| #69 | Gate 4 | yes (IDE-CLINICAL-001) | required | RA signoff |
| #70 | Gate 4 | yes (REIMBURSE-001) | required | source-use |
| #71 | Gate 5 | yes (MODEL-GOV-001) | no | rollback evidence |
| #72 | Gate 5 | yes (LICENSE-001) | no | source restriction |
| #80 | Gate 5 | no (infra) | no | Docker engine dependency |
| #81 | Gate 3 | no (infra) | no | Wave 1 E2E smoke |
| #82 | Gate 3 | no (infra) | no | Wave 2 E2E flow |
| #83 | Gate 2 | no (infra) | no | CI workflow validation |
| #84 | Gate 4 | yes (REFINE-001) | required | regeneration audit |
| #85 | Gate 4 | yes (CONFIDENCE-001) | required | alternate answer |
| #86 | Gate 2 | yes (PERSONAL-LIB-001) | no | merged via PR #208 |
| #87 | Gate 2 | yes (EXPORT-HUB-001) | no | access and audit |
| #88 | Gate 5 | yes (ESIG-001) | no | Part 11 audit |
| #89 | Gate 5 | yes (DSAR-001) | no | privacy evidence |
| #90 | Gate 5 | yes (REGION-ROUTE-001) | no | LLM/embedding proof |
| #91 | Gate 2 | yes (DLP-001) | no | leakage negative test |
| #92 | Gate 2 | yes (AUDITOR-VIEW-001) | no | read-only export |
| #169 | Gate 2 | no (integration) | no | on main via PR #184 |

## Gate Assignment Summary

Aggregated view of which gates apply to how many issues. Use this to size gate
ownership effort.

| Gate | Issue count | RC-blocking? |
|---|---|---|
| Gate 2 (PR Acceptance, #76) | 38 | yes |
| Gate 4 (RA Domain UAT, #78) | 11 | post-RC |
| Gate 5 (Operations, #79) | 11 | post-RC |
| Gate 3 (Wave Integration, #77) | 2 | post-RC |

Gate 0 (#74) and Gate 1 (#75) apply to every row and are not counted here.

## QA Comment Templates

### QA plan

```md
## QA plan

- Scope:
- Gate 0 status: PASS / BLOCKED
- Targeted automated checks:
- Fixture or mock data:
- Manual or domain signoff required:
- Known exclusions:
```

### QA checkpoint

```md
## QA checkpoint

- Change checkpoint:
- Checks run:
- Result: PASS / FAIL / INCONCLUSIVE
- Follow-up:
```

### QA evidence

```md
## QA evidence

- Commit or PR:
- Commands:
- Results:
- Artifacts:
- Manual signoff:
- Residual risk:
```

### QA signoff

```md
## QA signoff

- Gate status: PASS / WAIVED / BLOCKED
- Approver:
- Evidence links:
- Closure decision:
```

## Maintenance

- Add every new implementation issue to this matrix before implementation starts.
- Keep #73 open as the QA program tracking issue unless the project owner closes it.
- Link this matrix from PR bodies and issue comments when QA evidence is posted.
- For the canonical gate definitions and PASS conditions, see
  [qa-gate-definitions.md](qa-gate-definitions.md).
- For the cross-SPEC RACI summary and release-phase mapping, see
  [qa-gate-roadmap.md](../../.moai/specs/_shared/qa-gate-roadmap.md).
- When baseline `main` advances, refresh the Current State block above and
  re-issue a `QA plan` for any blocked row (currently #22).
- Excluded issue classes (do not add as rows): #73 ~ #79 (QA meta gates),
  #93 ~ #96 (superseded drafts), #98 ~ #101 (NOT_PLANNED).
