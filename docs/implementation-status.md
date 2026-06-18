# Regula Implementation Status

Reviewed: 2026-06-18 KST
Implementation baseline commit: `b775e57` (`origin/main` after PR #184 cleanup docs)

This document includes the 2026-06-18 PR cleanup after PR #184 merge,
PR #177 superseded closure, and the active Predicate Visualization addendum
for Issue #185 / PR #186.
Branch under review: `feat/issue-185-predicate-visualization`.

## Executive State

PR #184 was merged to main after CI recovery. The merged state includes the
E2E user validation framework and Traceability integration surface. PR #177 was
closed as superseded because its substantive Traceability changes were already
present on main and the branch was stale/conflicting.

CI Gates, Playwright chromium/firefox/webkit, LLM Eval Harness, E2E Smoke,
Vercel preview, and Security Scan all passed for PR #184 before merge.

PR #186 is the only open PR after branch inspection. It adds the Predicate
Visualization addendum for Issue #185 on top of the existing Predicate
Comparator surface. The branch reuses the existing feature branch per Issue #18
duplicate-work prevention rules. Local `main` has one unpushed commit with the
compare-page visualization toggle, but the same functional change is already
present in PR #186; the local `main` commit was not merged or pushed.

## Verified Repository State

| Area | State | Evidence |
|---|---|---|
| Active branch | `feat/issue-185-predicate-visualization` | existing branch reused for Issue #185 |
| Base commit | `b775e57` | `origin/main`, fetched before docs update |
| Active PR | #186 | `[P1][Predicate] 비교 분석 시각화 개선 - 입결전 상태 완성` |
| Mergeability | UNSTABLE | GitHub merge state at branch check time; awaiting PR checks/review state |
| Tests | 45 predicate-focused tests passing | local targeted Vitest run after review fixes |
| Open PRs | 1 | PR #186 only |
| Work gate | #18 active | #18 remains open and mandatory |

## 2026-06-18 PR Cleanup Update

| Area | State | Evidence |
|---|---|---|
| PR #184 | Merged | squash merge `a79759c` |
| PR #177 | Closed | stale/superseded; code already present on main |
| BFF routes | Complete | `/api/ra/traceability/scan`, `graph`, `impact` |
| Browser client/hooks | Complete | `traceabilityClient`, `useScanTraceability`, `useTraceGraph`, `useImpactAnalysis` |
| UI | Complete | `/workflows/traceability` scan, graph, impact tabs |
| RBAC | Complete | `traceability.scan`, `traceability.view`, `traceability.impact` |
| E2E validation | Complete | persona scenarios, Go/No-Go criteria, RA Lead daily workflow docs/tests |
| PR #177 disposition | Complete | GitHub comment added, PR closed per Issue #18 stale-branch rule |

Verification evidence:

- `biome check .` — pass.
- `node scripts/no-hex-colors.mjs` — pass.
- `vitest run` — 222 files passed, 2,307 tests passed, 7 skipped.
- GitHub PR #184 checks — CI Gates, LLM Eval Harness, Playwright chromium/firefox/webkit,
  Vercel preview, E2E Smoke, Dependency Vulnerability Scan, and gitleaks all success.

## 2026-06-18 Predicate Visualization Addendum — PR #186

Issue #185 addresses the highest-priority E2E validation finding that Predicate
comparison was too text-heavy for investor/customer demos and technical
assessment review. The addendum keeps the existing approval table path intact
and layers an interactive visualization-first view into `/predicate/compare`.

| Area | State | Evidence |
|---|---|---|
| Compare page entry | Complete | `app/(app)/predicate/compare/page.tsx` imports `PredicateVisualization` and exposes `Show Interactive Visualization` |
| Visualization component | Complete | `components/predicate/PredicateVisualization.tsx` |
| View modes | Complete | Bar chart, Radar chart, Table view |
| Before-After mode | Complete | subject vs first predicate dimension comparison |
| Required/Optional distinction | Complete | required rows use brand token; optional rows use ink token in actual bar cells and legend |
| Demo animation | Complete | `animationPhase` drives Bar/Radar animation keys, duration, begin, and radar opacity |
| Accessibility refinement | Complete | table row click replaced with explicit dimension button |
| Lint hardening | Complete | no explicit `any`, no raw hex colors, no accumulator spread |
| Session history | Complete | `.moai/state/session-memo.md` restored previous records and appended PR #186 state |

Validation evidence:

- `pnpm lint` — pass.
- `pnpm typecheck` — pass.
- `pnpm exec vitest run tests/unit/components/predicate/PredicateComparePage.test.tsx tests/unit/predicate-schema.test.ts tests/unit/predicate-rbac.test.ts` — 45 tests pass.
- `git diff --check` — pass.

## Implementation Surface

| Surface | Count | Delta | Notes |
|---|---:|---:|---|
| App pages | 19 | +3 | Added: predicate/search, predicate/compare, predicate/history |
| API route handlers | 33 | +5 | Added: predicate search, comparison, comparison/[id]/approve, export, admin/cache/clear |
| Component files | 37 | +4 | Added: CandidateCard, ComparisonTable, SubjectDeviceForm, PredicateVisualization |
| Library files | 200+ | +50+ | Added: predicate cascade-search, comparison-builder, openfda-client, cache, pdf-builder, docx-builder |
| Test/spec files | 200+ | +16 | Predicate unit + integration tests |
| Playwright specs | 8 | 0 | No new E2E specs added |
| DB migrations | 36 | +4 | 0029–0032: predicate_comparisons, comparison_cells, comparison_exports, cache_entries |

## CI Gate State

Latest CI run on `feat/issue-22-predicate` — all gates passed.

Passed in `CI Gates`:

- Type check (0 errors)
- Lint (Biome clean)
- Format check
- Unit tests (1,976 passing)
- RBAC coverage
- Audit completeness
- Token symmetry
- i18n completeness
- Regulatory glossary
- Contrast check
- Module boundaries
- Migration sequence (0029–0032)
- Build

Important caveat:

- Playwright E2E jobs completed, but `Run E2E tests` skipped (staging URL missing).
- LLM Eval Harness skipped.

## Wave 3 PREDICATE-001 Feature State

| Component | Path | REQ | Status |
|---|---|---|---|
| openFDA client | `lib/predicate/openfda-client.ts` | REQ-PRED-001~010 | ✅ |
| Cascade search | `lib/predicate/cascade-search.ts` | REQ-PRED-011~015 | ✅ |
| KV cache | `lib/predicate/cache.ts` | REQ-PRED-016~018 | ✅ |
| Comparison builder | `lib/predicate/comparison-builder.ts` | REQ-PRED-019~025 | ✅ |
| PDF export | `lib/predicate/pdf-builder.ts` | REQ-PRED-026~028 | ✅ |
| DOCX export | `lib/predicate/docx-builder.ts` | REQ-PRED-029~030 | ✅ |
| Search API | `app/api/ra/predicate/search/route.ts` | REQ-PRED-005~008 | ✅ |
| Comparison API | `app/api/ra/predicate/comparison/route.ts` | REQ-PRED-019~022 | ✅ |
| Approve API | `app/api/ra/predicate/comparison/[id]/approve/route.ts` | REQ-PRED-033 | ✅ IDOR fixed |
| Export API | `app/api/ra/predicate/export/route.ts` | REQ-PRED-026~030 | ✅ |
| Search page | `app/(app)/predicate/search/page.tsx` | — | ✅ |
| Compare page | `app/(app)/predicate/compare/page.tsx` | — | ✅ |
| History page | `app/(app)/predicate/history/page.tsx` | — | ✅ |
| Visualization addendum | `components/predicate/PredicateVisualization.tsx` | SPEC-PREDICATE-VIS-001 | 🚧 PR #186 |

## Open Work Classification

| Lane | Count | Issues |
|---|---:|---|
| Governance | 2 | #1, #18 |
| Wave 3 — next | 2 | #23 (CER-001), #24 (PCCP-001) |
| Wave 3 — remaining | 21 | #35~#43, #47, #48, #50, #51, #52, #55, #58~#62 |
| Wave 4 | 12 | #25, #44~#46, #49, #53, #54, #56, #57, #63~#65 |
| Wave 5 | 16 | #66~#72, #84~#92 |
| Pending PRs | 1 | #186 Predicate Visualization |

## Current Blockers

1. PR #186 merge state is `UNSTABLE` at branch check time; wait for GitHub checks/review state after push.
2. Local `main` is ahead of `origin/main` by one duplicate compare-page toggle commit. Do not push or merge it into this PR; PR #186 already carries the functional change.
3. No stale remote feature branches were found during `git branch -r` inspection.

## Next Priority

| Priority | Work | Reason |
|---|---|---|
| P0 | Push PR #186 review/doc updates | unblock Issue #185 review |
| P0 | Confirm PR #186 checks after push | merge state currently `UNSTABLE` |
| P1 | Begin #23 SPEC-REGULA-CER-001 (EU MDR Clinical Evaluation Report) | Wave 3 next SPEC |
| P1 | Begin #24 SPEC-REGULA-PCCP-001 (FDA PCCP builder) | Wave 3 next SPEC |
| P2 | Resolve duplicate local `main` commit disposition | Housekeeping after PR #186 lands

---

## Codebase Analysis Update (2026-06-17)

### Latest Architecture Documentation

**Project Scale Analysis**:
- TypeScript files: 377 (updated from baseline)
- API routes: 67 (stable across Wave 3)
- Database tables: 18 (includes new predicate tables)
- lib modules: 27 (comprehensive coverage)
- components categories: 11 (full UI coverage)

**Architecture Documentation Updates**:
- `.moai/project/codemaps/overview.md` - Updated with 2026-06-17 timestamp
- `.moai/project/codemaps/modules.md` - 12 core modules documented
- `.moai/project/codemaps/dependencies.md` - 110+ dependencies analyzed
- `.moai/project/codemaps/entry-points.md` - 67 API routes catalogued
- `.moai/project/codemaps/data-flow.md` - RAG pipeline and data flows documented

**README.md Integration**:
- Added codebase analysis section with project scale metrics
- Integrated architecture overview with latest module structure
- Updated technical stack breakdown with current versions
- Connected documentation references for detailed architecture

**Documentation Status**:
- ✅ README.md - Updated with codebase analysis
- ✅ docs/architecture.md - Enhanced with latest codebase metrics
- ✅ docs/implementation-status.md - This file updated
- ✅ `.moai/project/codemaps/` - All 5 codemap files current |
