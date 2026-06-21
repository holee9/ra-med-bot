# SPEC-REGULA-QA-OPERATIONS-001

## Metadata

- Issue: #79
- Status: Active
- Created: 2026-06-20
- Updated: 2026-06-21
- Priority: High (post-RC, operations-environment dependent)
- Category: QA Gate 5 — Operations QA and regression monitoring
- Governing SSoT: `docs/qa/qa-gate-definitions.md` §Gate 5, `.moai/specs/_shared/qa-gate-roadmap.md` §4

## HISTORY

- 2026-06-20: Draft created — basic EARS scaffold (5 REQs).
- 2026-06-21: Promoted Draft → Active. Expanded EARS to 8 REQs covering all PASS rows of `qa-gate-definitions.md` §Gate 5 (5 canonical synthetic queries, rollback drill, latency/error/cost baseline). Added Application Scope, Evidence Artifacts, SSoT Alignment sections.

## Purpose

Validate production deployment readiness and ongoing regression monitoring: synthetic checks, rollback capability, quality metrics baselining, and compliance artifact completeness. Gate 5 activates **after the first RC** as part of the v0.2 operations phase (operations-environment availability dependent).

## Scope

- **Applied**: After Gate 4 UAT sign-off, before production deployment; ongoing thereafter for regression monitoring.
- **Covers**: Pre-deployment health checks, synthetic monitoring, rollback drills, quality metrics baselining (latency P95, error rate, cost per query), audit cold storage and retention, on-call runbook completeness.
- **Out of scope**: Feature functionality (covered by Gates 1–4), domain UAT (Gate 4).

## Application Scope

Gate 5 applies to infra/ops issues per `docs/qa/qa-gate-definitions.md` §Gate 5 Application scope.

Authoritative list from `qa-gate-definitions.md`:
**#45, #49, #52, #57, #67, #71, #72, #80, #83, #88, #89, #90, #91.**

`docs/qa/qa-matrix.md` §Gate Assignment Summary reports Gate 5 issue count as 11, while `qa-gate-definitions.md` enumerates 13. This is an SSoT-internal discrepancy and is **not resolved here** — per the conflict policy below, `qa-gate-definitions.md` §Gate 5 is the authoritative application-scope source. The matrix summary count should be reconciled in a separate Plan/Sync pass.

Reference: `docs/qa/qa-gate-definitions.md` §Gate 5 — "Applies to: production operations and ongoing regression monitoring."

## Requirements (EARS format)

**REQ-G5-001 (Event-Driven)**: WHEN deploying to production, THE SYSTEM SHALL run a pre-deployment health check confirming DB connectivity, Cloudflare Tunnel status, audit log write capability, and LLM API connectivity.

**REQ-G5-002 (Event-Driven)**: WHEN production deployment completes, THE SYSTEM SHALL verify Sentry error tracking and PostHog analytics are receiving events within 5 minutes.

**REQ-G5-003 (Event-Driven)**: WHEN synthetic checks run, THE SYSTEM SHALL execute the 5 canonical queries on schedule and require all 5 to pass.

**REQ-G5-004 (Event-Driven)**: WHEN a rollback drill is executed, THE SYSTEM SHALL complete the rollback procedure successfully to the previous stable deployment.

**REQ-G5-005 (Event-Driven)**: WHEN quality metrics are baselined, THE SYSTEM SHALL record latency P95, error rate, and cost per query as the operational baseline for regression monitoring.

**REQ-G5-006 (Unwanted Behavior)**: IF a production deployment fails health checks, THEN THE SYSTEM SHALL automatically trigger rollback to the previous stable deployment.

**REQ-G5-007 (Event-Driven)**: WHEN audit cold storage is in scope for the Wave, THE SYSTEM SHALL verify R2 write and the 7-year retention policy before Gate 5 approval.

**REQ-G5-008 (Event-Driven)**: WHEN Gate 5 completes, THE SYSTEM SHALL generate an operations readiness report listing deployment timestamp, health check results, monitoring status, rollback test result, quality metrics baseline, and compliance artifact status.

## Evidence Artifacts

Gate 5 produces an **operations readiness report** stored at `.moai/qa/ops/<wave>-ops-report.md`. The report references the `QA signoff` template (defined in `docs/qa/qa-matrix.md` §QA Comment Templates) for gate status, approver, evidence links, and closure decision, and additionally records:
- Deployment timestamp and health check results (DB, Cloudflare Tunnel, audit log, LLM API),
- Sentry / PostHog event receipt verification (within 5 min),
- Synthetic check schedule and 5 canonical query results,
- Rollback drill result,
- Quality metrics baseline (latency P95, error rate, cost per query),
- Audit cold storage verification (R2 write, 7-year retention) if in Wave scope,
- On-call runbook update with Wave-specific failure modes.

The Ops evidence level is defined in `docs/qa/qa-matrix.md` §Evidence Levels as "smoke, synthetic check, rollback drill, or monitoring evidence."

## SSoT Alignment

- **Primary SSoT**: `docs/qa/qa-gate-definitions.md` §Gate 5 (PASS conditions table, Application scope).
- **Roadmap SSoT**: `.moai/specs/_shared/qa-gate-roadmap.md` §4 (Gate 5 PASS summary).
- **Conflict policy**: On conflict between this SPEC and either SSoT file, **the SSoT wins**. Where `qa-gate-definitions.md` and `qa-matrix.md` disagree on the Gate 5 application-scope issue list, `qa-gate-definitions.md` §Gate 5 is authoritative per its role as the canonical gate definition document; the matrix summary count discrepancy should be reconciled separately.

## Acceptance Criteria

1. Pre-deployment health check passes all components (DB, Cloudflare Tunnel, audit log write, LLM API).
2. Sentry and PostHog receiving events post-deploy (verified within 5 minutes).
3. 5 canonical synthetic queries pass on schedule.
4. Rollback procedure tested successfully and documented in runbook.
5. Quality metrics baseline recorded (latency P95, error rate, cost per query).
6. Audit cold storage write verified with 7-year retention (if in Wave scope).
7. Operations readiness report generated and stored in `.moai/qa/ops/`.
8. On-call runbook updated with Wave-specific failure modes.

## Gate Checklist

- [ ] Gate 4 sign-off confirmed
- [ ] Pre-deployment health check script run and passed (DB, Cloudflare Tunnel, audit, LLM)
- [ ] Sentry events verified post-deploy (within 5 min)
- [ ] PostHog analytics verified post-deploy (within 5 min)
- [ ] 5 canonical synthetic queries pass on schedule
- [ ] Rollback tested (or documented as pre-tested in staging)
- [ ] Quality metrics baseline recorded (latency P95, error rate, cost per query)
- [ ] Audit cold storage verified with 7-year retention (if applicable)
- [ ] Runbook updated with Wave-specific failure modes
- [ ] Ops readiness report in `.moai/qa/ops/<wave>-ops-report.md`

## Definition of Done

- Ops readiness report complete with all checklist items confirmed.
- Deployment stable for 30 minutes post-deploy.
- Synthetic checks, rollback drill, and quality baseline recorded.
- Gate 5 PASS status recorded in Wave milestone.

## References

- `docs/qa/qa-gate-definitions.md` §Gate 5
- `docs/qa/qa-matrix.md` §QA Comment Templates (### QA signoff), §Gate Assignment Summary, Ops evidence level
- `.moai/specs/_shared/qa-gate-roadmap.md` §2, §4
- Related SPECs: post-v0.1 ownership per roadmap §2 (operations-environment availability dependent)
- Plan/Sync-only modification policy: see `qa-gate-roadmap.md` §5
