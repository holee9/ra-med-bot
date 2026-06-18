# Regula Implementation Status

Reviewed: 2026-06-18 KST
Implementation baseline commit: `a79759c` (main after PR #184)

This document includes the 2026-06-18 PR cleanup after PR #184 merge and
PR #177 superseded closure.
Branch: `main` — no open PRs remain after the cleanup.

## Executive State

PR #184 was merged to main after CI recovery. The merged state includes the
E2E user validation framework and Traceability integration surface. PR #177 was
closed as superseded because its substantive Traceability changes were already
present on main and the branch was stale/conflicting.

CI Gates, Playwright chromium/firefox/webkit, LLM Eval Harness, E2E Smoke,
Vercel preview, and Security Scan all passed for PR #184 before merge.

## Verified Repository State

| Area | State | Evidence |
|---|---|---|
| Branch | `main` | after PR #184 merge |
| Baseline commit | `a79759c` | `feat(e2e): add user validation framework` |
| Mergeability | CLEAN | PR #184 merged; PR #177 closed as superseded |
| Tests | 2,307 passing, 7 skipped | local full `vitest run` after CI fix |
| Open PRs | none | `gh pr list --state open` |
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

## Implementation Surface

| Surface | Count | Delta | Notes |
|---|---:|---:|---|
| App pages | 19 | +3 | Added: predicate/search, predicate/compare, predicate/history |
| API route handlers | 33 | +5 | Added: predicate search, comparison, comparison/[id]/approve, export, admin/cache/clear |
| Component files | 36 | +3 | Added: CandidateCard, ComparisonTable, SubjectDeviceForm |
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

## Open Work Classification

| Lane | Count | Issues |
|---|---:|---|
| Governance | 2 | #1, #18 |
| Wave 3 — next | 2 | #23 (CER-001), #24 (PCCP-001) |
| Wave 3 — remaining | 21 | #35~#43, #47, #48, #50, #51, #52, #55, #58~#62 |
| Wave 4 | 12 | #25, #44~#46, #49, #53, #54, #56, #57, #63~#65 |
| Wave 5 | 16 | #66~#72, #84~#92 |
| Pending PRs | 4 | #119 citation-click, #120 security, #121 confidence, #122 refine |

## Current Blockers

1. PR #126 needs merge to main (no technical blocker, ready to merge).
2. PRs #119–#122 need sequential merge after #126.
3. Stale remote branches: `origin/feature/SPEC-REGULA-RELEASE-HARDENING-001`,
   `origin/work/e2efix-001` — scheduled for deletion (P2).

## Next Priority

| Priority | Work | Reason |
|---|---|---|
| P0 | Merge PR #126 (feat/issue-22-predicate → main) | PREDICATE-001 complete, all gates green |
| P0 | Merge PR #119 → #120 → #121 → #122 sequentially | citation, security, confidence, refine fixes |
| P1 | Begin #23 SPEC-REGULA-CER-001 (EU MDR Clinical Evaluation Report) | Wave 3 next SPEC |
| P1 | Begin #24 SPEC-REGULA-PCCP-001 (FDA PCCP builder) | Wave 3 next SPEC |
| P2 | Delete stale remote branches | Housekeeping

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
