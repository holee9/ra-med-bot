# Regula Implementation Status

Reviewed: 2026-06-11 KST
Implementation baseline commit: `2c8fe91` (feat/issue-22-predicate)

This document reflects the Wave 3 PREDICATE-001 completion state.
Branch: `feat/issue-22-predicate` — PR #126 (Fixes #22) awaiting merge to main.

## Executive State

Wave 3 PREDICATE-001 is complete. FDA 510(k) Predicate Comparator (38 REQ) is
fully implemented across `feat/issue-22-predicate`. TypeScript 0 errors, 1,976
tests passing. PR #126 is ready for merge.

Wave 1+2 (Phase 1-11, v1.0.0-rc) remain merged and stable on `main`.
Next: merge PR #126, then begin CER-001 (#23).

## Verified Repository State

| Area | State | Evidence |
|---|---|---|
| Branch | `feat/issue-22-predicate` | predicate implementation branch |
| Baseline commit | `2c8fe91` | `fix(lint): biome 포맷 위반 해소 — predicate export route 재포맷` |
| TypeScript | 0 errors | `tsc --noEmit` clean |
| Tests | 1,976 passing | vitest run |
| Open PRs | PR #126 ready | `feat/issue-22-predicate → main` |
| Work gate | #18 active | #18 remains open and mandatory |

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
