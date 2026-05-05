---
id: SPEC-REGULA-QUALITY-001
artifact: traceability-matrix
title: "Traceability Matrix — QUALITY-001"
created: 2026-05-05
updated: 2026-05-05
author: manager-spec
status_legend: "pending | in-progress | verified"
---

# Traceability Matrix — SPEC-REGULA-QUALITY-001

본 매트릭스는 QUALITY-001의 28개 EARS REQ(Group A~G)를 acceptance scenario, 검증 명령, 구현 파일, GitHub issue로 1:1 연결한다.

| REQ ID | EARS Pattern | Acceptance Criteria ID | Test/Script | GitHub Issue | Status |
|---|---|---|---|---|---|
| REQ-QUAL-001 | U | acceptance Scenario A1 | `pnpm db:seed:corpus` exit 0 | #34 | pending |
| REQ-QUAL-002 | U | acceptance Scenario A1 | `SELECT COUNT(*) FROM source_sections` ≥ 100 | #34 | pending |
| REQ-QUAL-003 | U | acceptance Scenario A1 | Manual: seed JSON content review (real regulatory text) | #34 | pending |
| REQ-QUAL-004 | ED | acceptance Scenario A1 | Re-run `pnpm db:seed:corpus` and diff chunk ids | #34 | pending |
| REQ-QUAL-005 | ED | acceptance Scenario A2 | `tests/integration/seed-smoke.test.ts` (canonical query test) | #34 | pending |
| REQ-QUAL-006 | U | acceptance Scenario B1 | `pnpm eval:ci` exit code 0 | #34 | pending |
| REQ-QUAL-007 | SD | acceptance Scenario B1 | promptfoo ≥ 80% pass rate (55 scenarios / 6 datasets) | #34 | pending |
| REQ-QUAL-008 | U | acceptance Scenario B1 | `tests/eval/results/<timestamp>.json` write + `baseline.json` commit | #34 | pending |
| REQ-QUAL-009 | ED | acceptance Scenario B2 | Failure record `rootCause` field populated | #34 | pending |
| REQ-QUAL-010 | UB | acceptance Scenario B3 | CI timeout enforcement (≤ 30 min) | #34 | pending |
| REQ-QUAL-011 | U | acceptance Scenario C1 | `grep -E "TODO.*Vectorize\|wire up Vectorize" lib/ai/hybrid-router.ts` (must be 0). **Sole owner of hybrid-router.ts:142** (HARDENING-001 REQ-HARDEN-020 defers to this REQ) | #34 | pending |
| REQ-QUAL-012 | SD | acceptance Scenario C1 | `.env.example` documented + `lib/ai/hybrid-router.ts` doc-comment | #34 | pending |
| REQ-QUAL-013 | ED | acceptance Scenario C1 | Workers runtime test: env set → Vectorize binding; Node test → pgvector | #34 | pending |
| REQ-QUAL-014 | U | acceptance Scenario C1 | `tests/integration/hybrid-router-fallback.test.ts` PASS | #34 | pending |
| REQ-QUAL-015 | U | acceptance Scenario D1 | E2E: admin upload → ingest pipeline → `source_sections` insert | #34 | pending |
| REQ-QUAL-016 | ED | acceptance Scenario D1 | E2E: upload → `sources` row + ≥ 1 `source_sections` row with embedding | #34 | pending |
| REQ-QUAL-017 | ED | acceptance Scenario D1 | E2E: search uploaded doc term → top-K result includes uploaded doc | #34 | pending |
| REQ-QUAL-018 | UB | acceptance Scenario D2 | E2E: non-admin → HTTP 403 + audit log entry | #34 | pending |
| REQ-QUAL-019 | UB | acceptance Scenario D3 | E2E: oversized/unsupported/PII-fail upload → structured error, no partial insert | #34 | pending |
| REQ-QUAL-020 | U | acceptance Scenario E1 | `pnpm test:e2e --grep @security-headers` exit 0 on chromium | #34 | pending |
| REQ-QUAL-021 | U | acceptance Scenario E1 | Header assertion: CSP/X-Frame-Options/HSTS/X-Content-Type-Options | #34 | pending |
| REQ-QUAL-022 | ED | acceptance Scenario E1 | CSP nonce match: header nonce == inline `<script>` nonce | #34 | pending |
| REQ-QUAL-023 | UB | acceptance Scenario E2 | Hypothetical missing header build → CI fails | #34 | pending |
| REQ-QUAL-024 | U | acceptance Scenario F1 | `pnpm ci:rbac` exit 0 with admin doc routes (4 routes) | #34 | pending |
| REQ-QUAL-025 | UB | acceptance Scenario F1 | RBAC matrix missing route → `pnpm ci:rbac` fails with route name | #34 | pending |
| REQ-QUAL-026 | U | acceptance Scenario G1 | Fresh checkout + `pnpm dev:bootstrap` → `.env.local` 생성 + 후속 `pnpm db:seed:corpus` 통과. Idempotent 재실행 검증. SPEC §2 Group G. plan.md M7. Files: `scripts/dev-bootstrap.ts` (new), `package.json` (script) | #99 | pending |
| REQ-QUAL-027 | UB | acceptance Scenario G2 | `NODE_ENV=production ANTHROPIC_API_KEY=dev-placeholder-anthropic pnpm build` → fail-fast, exit code ≠ 0. SPEC §2 Group G. plan.md M7 / §3.7. Files: `lib/env.ts` (patch — zod refinement) | #99 | pending |
| REQ-QUAL-028 | U | acceptance Scenario G3 | `DEVELOPMENT.md` Section 2 에 5단계 sequence (git clone → pnpm install → pnpm dev:bootstrap → db:up/migrate/seed → pnpm dev) 존재 확인. SPEC §2 Group G. plan.md M7. Files: `DEVELOPMENT.md` (Section 2 update) | #99 | pending |

---

## Cross-SPEC Ownership 명시 (REQ-QUAL-011)

| 항목 | 본 SPEC 처리 | 위임 출처 |
|---|---|---|
| `lib/ai/hybrid-router.ts:142` Vectorize TODO 해소 | 본 SPEC이 sole owner (REQ-QUAL-011~014) | HARDENING-001 REQ-HARDEN-020이 본 SPEC에 위임 |

---

## Status 갱신 정책

- RUN 단계 진입 전 모든 row는 `pending`
- Group별 마일스톤(M1~M7) 시작 시 해당 row를 `in-progress`로 갱신
- acceptance scenario PASS 시 `verified`
- 28개 row 모두 `verified`일 때 RELEASE-001 traceability-matrix.md의 위임 row (REQ-REL-030 hybrid-router 부분, REQ-REL-050)도 `verified`로 전이
- Group G (REQ-QUAL-026~028)는 #99 closure에 직접 연동 — 3 rows 모두 `verified` 시 #99 자동 close 가능

---

## References

- SPEC: `.moai/specs/SPEC-REGULA-QUALITY-001/spec.md`
- Acceptance: `.moai/specs/SPEC-REGULA-QUALITY-001/acceptance.md`
- Plan: `.moai/specs/SPEC-REGULA-QUALITY-001/plan.md`
- Research: `.moai/specs/SPEC-REGULA-QUALITY-001/research.md`
- Umbrella SPEC: `.moai/specs/SPEC-REGULA-RELEASE-001/`
- Cross-SPEC: `.moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/` (REQ-HARDEN-020이 본 SPEC에 위임)
