---
id: SPEC-REGULA-RELEASE-HARDENING-001
artifact: traceability-matrix
title: "Traceability Matrix — RELEASE-HARDENING-001"
created: 2026-05-05
updated: 2026-05-05
author: manager-spec
status_legend: "pending | in-progress | verified"
---

# Traceability Matrix — SPEC-REGULA-RELEASE-HARDENING-001

본 매트릭스는 HARDENING-001의 28개 EARS REQ를 acceptance scenario, 검증 명령, GitHub issue로 1:1 연결한다.

| REQ ID | EARS Pattern | Acceptance Criteria ID | Test/Script | GitHub Issue | Status |
|---|---|---|---|---|---|
| REQ-HARDEN-001 | ED | acceptance Scenario A-1 | API contract test: `GET /api/ra/dashboard` shape | #33 | pending |
| REQ-HARDEN-002 | U | acceptance Scenario A-1, A-3 | `db.select({count}).from(conversations)` integration test | #33 | pending |
| REQ-HARDEN-003 | U | acceptance Scenario A-1, A-3 | `db.select({count}).from(expert_reviews)` integration test | #33 | pending |
| REQ-HARDEN-004 | U | acceptance Scenario A-1, A-3 | `db.select({count}).from(projects)` integration test | #33 | pending |
| REQ-HARDEN-005 | SD | acceptance Scenario A-2 | API contract test: empty org returns `0` not `{}` | #33 | pending |
| REQ-HARDEN-006 | ED | acceptance Scenario B-1 | `GET /api/ra/sources` list endpoint test | #33 | pending |
| REQ-HARDEN-007 | U | acceptance Scenario B-1 | `/knowledge` page render test | #33 | pending |
| REQ-HARDEN-008 | UB | acceptance Static check B-S1 | `git grep "const sourceGroups = " app/(app)/knowledge/page.tsx` (must be 0) | #33 | pending |
| REQ-HARDEN-009 | SD | acceptance Scenario B-2 | E2E: empty corpus → empty state message | #33 | pending |
| REQ-HARDEN-010 | ED | acceptance Scenario B-3 | E2E: API 500 → error notice (no fallback data) | #33 | pending |
| REQ-HARDEN-011 | UB | acceptance Static check C-S1 | `git grep -rnE "console\.(log\|warn\|error\|debug)" app/ lib/ workers/ --include="*.ts"` | #29 | pending |
| REQ-HARDEN-012 | U | acceptance Scenario C-1 | Logger smoke test: Sentry/Langfuse routed | #29 | pending |
| REQ-HARDEN-013 | UB | acceptance Static check C-S2 | grep PII variable names in logger calls | #29 | pending |
| REQ-HARDEN-014 | O (Where) | acceptance Static check C-S2 | hash/length/locale only in error context | #29 | pending |
| REQ-HARDEN-015 | U | (no separate scenario; static check) | grep `writeAudit` calls — shape unchanged | #29 | pending |
| REQ-HARDEN-016 | O (Where) | acceptance Edge case C-E1 | scripts/, tests/ excluded from `no-console` lint | #29 | pending |
| REQ-HARDEN-017 | UB | acceptance Static check D-S1 | `git grep -rnE "TODO\|FIXME\|placeholder\|mock implementation" app/ lib/ workers/ --include="*.ts"` | #27 | pending |
| REQ-HARDEN-018 | ED | acceptance Scenario D-1 | feature flag test: `FEATURE_EU_ECTD=disabled` throws | #27 | pending |
| REQ-HARDEN-019 | UB | acceptance Scenario D-2 | feature flag test: invocation throws `FeatureNotAvailableError` | #27 | pending |
| REQ-HARDEN-020 | U | acceptance Static check D-S2 (delegated) | Cross-SPEC ownership delegation to QUALITY-001 (REQ-QUAL-011~014) | #27 | pending |
| REQ-HARDEN-021 | U | acceptance Static check D-S3 | grep TODO in `tests/e2e/fixtures/msw-sse.ts` (must be 0) | #27 | pending |
| REQ-HARDEN-022 | UB | acceptance Static check E-S1 | grep `test.skip(true,` in `tests/e2e/citation-click.spec.ts` (must be 0) | — | pending |
| REQ-HARDEN-023 | U | acceptance Scenario E-1 | Playwright fixture: `tests/e2e/fixtures/auth.ts` exists, used by spec | — | pending |
| REQ-HARDEN-024 | ED | acceptance Scenario E-2 | CI matrix: chromium + firefox PASS for citation-click suite | — | pending |
| REQ-HARDEN-025 | U | acceptance Scenario F-1 | Playwright visual: 3 WorkflowCard with Beta badge | — | pending |
| REQ-HARDEN-026 | ED | acceptance Scenario F-2 | E2E: workflow execution page banner present, non-dismissable | — | pending |
| REQ-HARDEN-027 | U | acceptance Scenario F-3 | API contract test: `_mock: true` in mock executor response | — | pending |
| REQ-HARDEN-028 | ED | acceptance Scenario F-4 | DB query test: `audit_logs.metadata.mock_data: true` recorded | — | pending |

---

## Cross-SPEC Ownership 명시 (REQ-HARDEN-020)

| 항목 | 본 SPEC 처리 | 위임된 SPEC |
|---|---|---|
| `lib/ai/hybrid-router.ts:142` Vectorize TODO 해소 | 본 SPEC은 이 파일을 수정하지 않음 (REQ-HARDEN-020 명시) | SPEC-REGULA-QUALITY-001 (REQ-QUAL-011~014) |

---

## Status 갱신 정책

- RUN 단계 진입 전 모든 row는 `pending`
- Group별 작업이 시작되면 해당 row를 `in-progress`로 갱신
- acceptance scenario 또는 static check가 PASS하면 `verified`
- 28개 row 모두 `verified`일 때 RELEASE-001 traceability-matrix.md의 위임 row (REQ-REL-030, REQ-REL-040)도 `verified`로 전이

---

## References

- SPEC: `.moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/spec.md`
- Acceptance: `.moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/acceptance.md`
- Plan: `.moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/plan.md`
- Research: `.moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/research.md`
- Umbrella SPEC: `.moai/specs/SPEC-REGULA-RELEASE-001/`
- Cross-SPEC: `.moai/specs/SPEC-REGULA-QUALITY-001/` (REQ-HARDEN-020 위임 대상)
