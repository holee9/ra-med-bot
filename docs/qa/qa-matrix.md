# Regula QA Matrix

Updated: 2026-06-18

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
- #80 local E2E foundation exists, but full local E2E evidence is blocked until
  Docker Desktop engine is running and `up/migrate/seed/Playwright` completes.
- #22 implementation remains blocked until its Gate 0 `QA plan` is refreshed
  against baseline commit `8b3a983`.
- #169 Traceability UI integration is present on main after PR #184 merge.
  PR #177 was closed as stale/superseded because the substantive code was
  already in main and the branch remained conflicting.
- #182 E2E user validation PR #184 is merged. Evidence: CI Gates, Playwright
  chromium/firefox/webkit, LLM Eval, E2E Smoke, Vercel preview, Security Scan,
  local `biome check .`, `tsc --noEmit`, and full `vitest run` all passed.

## Closure Rule

An implementation issue cannot close until its PR or issue comment contains
`QA evidence` with the command, result, and artifact or manual signoff. Release
blockers require explicit PASS, WAIVED, or BLOCKED status.

Every implementation issue must also have a `QA plan` before code starts. Gate 0
is defined in [Gate 0 SPEC Readiness](gate-0-spec-readiness.md).

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
