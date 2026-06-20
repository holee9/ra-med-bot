# SPEC-REGULA-QA-OPERATIONS-001

## Metadata
- Issue: #79
- Status: Draft
- Created: 2026-06-20
- Priority: High
- Category: QA Gate 5 — Operations QA (Production readiness)

## Purpose
Validate production deployment readiness: infrastructure stability, monitoring coverage,
rollback capability, and compliance artifact completeness before go-live.

## Scope
- Applied: After Gate 4 UAT sign-off, before production deployment
- Covers: Deployment health, monitoring alerts, audit cold storage, runbook completeness, rollback procedure
- Out of scope: Feature functionality (covered by Gates 1-4)

## Requirements (EARS format)

WHEN deploying to production, THE SYSTEM SHALL run a pre-deployment health check confirming: DB connectivity, Cloudflare Tunnel status, audit log write capability, and LLM API connectivity.

WHEN production deployment completes, THE SYSTEM SHALL verify Sentry error tracking and PostHog analytics are receiving events within 5 minutes.

IF a production deployment fails health checks, THEN THE SYSTEM SHALL automatically trigger rollback to the previous stable deployment.

WHEN audit cold storage is in scope for the Wave, THE SYSTEM SHALL verify R2 write and 7-year retention policy before Gate 5 approval.

WHEN Gate 5 completes, THE SYSTEM SHALL generate an operations readiness report listing: deployment timestamp, health check results, monitoring status, rollback test result, and compliance artifact status.

## Acceptance Criteria
1. Pre-deployment health check passes all components
2. Sentry and PostHog receiving events post-deploy (verified within 5 min)
3. Rollback procedure tested and documented in runbook
4. Audit cold storage write verified (if in Wave scope)
5. Operations readiness report generated and stored in `.moai/qa/ops/`
6. On-call runbook updated with Wave-specific failure modes

## Gate Checklist
- [ ] Gate 4 sign-off confirmed
- [ ] Pre-deployment health check script run and passed
- [ ] Sentry events verified post-deploy
- [ ] PostHog analytics verified post-deploy
- [ ] Rollback tested (or documented as pre-tested in staging)
- [ ] Audit cold storage verified (if applicable)
- [ ] Runbook updated
- [ ] Ops readiness report in `.moai/qa/ops/<wave>-ops-report.md`

## Definition of Done
- Ops readiness report complete, all checklist items confirmed, deployment stable for 30 minutes post-deploy
