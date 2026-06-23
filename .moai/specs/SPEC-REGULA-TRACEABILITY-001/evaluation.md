# SPEC-REGULA-TRACEABILITY-001 — Independent Skeptical Evaluation

**Evaluator**: evaluator-active (CG mode, effort: xhigh)
**Date**: 2026-06-23
**Branch**: `feat/issue-47` (changeset is uncommitted in working tree — NOT yet on the branch tip)
**SPEC**: `.moai/specs/SPEC-REGULA-TRACEABILITY-001/spec.md` (12 REQs, 8 ACs)
**Overall Verdict**: **PASS-WITH-CONDITIONS**

> The evidence-graph core, IDOR defense, audit trail, and export pipeline are
> production-quality. Three functional gaps and one dead-code module prevent an
> unconditional PASS. The conditions are scoped, concrete, and fixable without
> re-architecting.

---

## Dimension Scorecard

| Dimension | Weight | Score | Verdict | Key Evidence |
|-----------|--------|-------|---------|--------------|
| Functionality | 40% | 68/100 | **FAIL** | Matrix filters ignored; `unresolved_review` false-positive; REQ-011 dead code; AC-05 unwired |
| Security | 25% | 88/100 | **PASS** | 3-layer IDOR gate, Zod everywhere, RLS, audit on every mutate+export |
| Craft | 20% | 82/100 | **PASS** | 33 traceability tests pass; TDD structure; weak PDF assertion; dead code |
| Consistency | 15% | 92/100 | **PASS** | Follows classify/knowledge-gap conventions; Drizzle/RSC/island patterns upheld |

**Weighted total**: 0.40×68 + 0.25×88 + 0.20×82 + 0.15×92 = **78.8/100**

Security PASSes the hard threshold. Functionality FAILS on 3 concrete defects,
so the overall verdict is **PASS-WITH-CONDITIONS** (mergeable once the 3
functional conditions are met or explicitly descoped with tracked issues).

---

## Tooling Evidence (actual output, not assumed)

| Check | Command | Result |
|-------|---------|--------|
| Traceability tests | `pnpm test -- lib/traceability/__tests__/ tests/unit/components/traceability/` | **33 passed**, 0 failed |
| Full suite regression | `pnpm test --run` | **3285 passed**, 7 skipped, 0 failed |
| Typecheck | `pnpm typecheck` (`tsc --noEmit`) | **Clean**, no errors |
| Lint | `pnpm biome check` (26 traceability files) | **Clean**, no fixes applied |
| Build | `pnpm build` | **Success** — `/traceability` + `/traceability/[deliverableId]` routes emit |

---

## Acceptance Criteria — Per-AC Verdict

| AC# | Criterion | Verdict | Evidence / Gap |
|-----|-----------|---------|----------------|
| AC-01 | source→answer→review→export graph stored | **PARTIAL** | Graph model supports it (`createEdge`, 6 relations). `createEdge` unit-tested in isolation (`graph.test.ts:73-171`). **No single test creates the full 4-hop chain** (source→answer→review→export) and verifies it via the matrix/packet assemblers together. The `integration-real-pipeline.test.ts` tests stale fan-out and export rendering independently, not the complete edge chain. |
| AC-02 | Matrix UI + filters work | **PARTIAL** | UI renders, `MatrixFilters` test verifies filter controls present + URL navigation (`TraceabilityIslands.test.tsx:20-52`). `stale=only` filter works (`matrix.test.ts:117-135`). **GAP**: `jurisdiction`, `product`, `packageId`, `riskLevel` are declared in `MatrixFilters` (`matrix.ts:16-19`) and accepted by the Zod schema (`route.ts:14-21`) but **never applied** in `loadDeliverables` (`matrix.ts:154-170` only filters by `orgId`, `projectId`, `nodeType`). The filter UI changes the URL but the backend silently ignores 4 of 5 filters. |
| AC-03 | Missing citation / stale / unresolved review surfaced | **PARTIAL** | `missing_citation` tested (`matrix.test.ts:50-67`). `stale_source` tested (`matrix.test.ts:94-115`). **BUG**: `unresolved_review` detection (`matrix.ts:106`) is broken in the production DB path — `deps.nodesById` is never passed by the route (`route.ts:40`) or page (`page.tsx:112-124`), so `deps.nodesById?.get(...)` always short-circuits to `undefined`, making `!undefined === true`. Result: **every deliverable with a `reviewed_by` edge is falsely flagged `unresolved_review`**. |
| AC-04 | PDF/Markdown export | **PARTIAL** | Markdown export test asserts non-empty bytes containing 'run-1' (`integration-real-pipeline.test.ts:54-60`). **PDF export test is weak** — only asserts `typeof result.success === 'boolean'` (`integration-real-pipeline.test.ts:73`), does NOT assert non-empty PDF bytes. If the PDF renderer silently produced empty output, the test would still pass. |
| AC-05 | Source supersession → stale propagation | **PARTIAL** | `propagateStaleFromNode` BFS tested DB-stubbed (`stale-propagation.test.ts`, `integration-real-pipeline.test.ts:85-150`). `onSourceSectionSuperseded` hook exists (`hooks.ts:29`). **GAP (DEFERRED)**: The hook is **never called** — `grep` finds zero call sites in `lib/radar/delta-sync/` or anywhere else. The only production trigger is the manual `staleReason` param on `POST /api/traceability/edges`. Automatic propagation on real source supersession is NOT wired. |
| AC-06 | Every traceability change → audit_logs | **PASS** | Edges route: `traceability.edge_created`, `traceability.edge_deleted`, `traceability.stale_propagated` (`edges/route.ts:65-91,104-115`). Export route: `traceability.packet_exported` (`export/route.ts:57-67`). Enum lock-step runtime test (`integration-real-pipeline.test.ts:157-166`). Schema/audit.ts/SQL all add the 4 actions consistently. |
| AC-07 | Evidence packet for answer/CER/PCCP/510(k)/risk | **PASS (generic)** | `getEvidencePacket` (`evidence-packet.ts:42`) is node-type-agnostic — accepts any `deliverableId` and resolves whatever node exists. The 8-value `evidence_node_type` enum covers all 5 deliverable families (CER/PCCP/510(k) map to `workflow_run` or `submission_package`). The packet detail route (`/[deliverableId]/packet`) works for all node types. **Caveat**: the matrix only surfaces 3 row types (`message`, `workflow_run`, `risk_item` per `matrix.ts:11`), but the packet viewer itself is fully general. |
| AC-08 | Source-missing deliverable → open gap | **PASS** | `missing_citation` gap when no `derived_from`/`cites` edge (`matrix.ts:104`, tested `matrix.test.ts:50-67`). Maps cleanly to REQ-012. |

**Summary**: 2 PASS (AC-06, AC-08), 1 PASS-generic (AC-07), 5 PARTIAL (AC-01, AC-02, AC-03, AC-04, AC-05), 0 UNVERIFIED.

---

## Requirement Coverage

| REQ | Verdict | Note |
|-----|---------|------|
| REQ-001 (persist graph edge source→answer→review→export) | **PARTIAL** | Edge persistence works, full chain not integration-tested |
| REQ-002 (node metadata: authority/version/effective_date/reviewer/hash) | **PASS** | Schema + `upsertNode` + `EvidenceNode` interface |
| REQ-003 (6 edge relations) | **PASS** | Enum + Zod + tests |
| REQ-004 (per-project matrix UI) | **PASS** | `page.tsx` SSR + table |
| REQ-005 (filter by jurisdiction/product/package/risk/stale) | **FAIL** | 4 of 5 filters silently ignored in query |
| REQ-006 (flag missing citation/stale/unresolved review) | **PARTIAL** | `unresolved_review` false-positive in DB path |
| REQ-007 (evidence packet for 5 deliverable types) | **PASS** | Generic assembler |
| REQ-008 (PDF/MD export) | **PARTIAL** | Works, PDF test assertion too weak |
| REQ-009 (supersession → stale propagation) | **PARTIAL** | Function works, trigger unwired |
| REQ-010 (audit every edge mutate) | **PASS** | Strongest dimension |
| REQ-011 (replay/eval edge verification) | **FAIL (dead code)** | `verifyAnswerEdges` defined, zero call sites |
| REQ-012 (source-missing → open gap) | **PASS** | `missing_citation` |

---

## Findings (prioritized)

### Critical (blocks full AC satisfaction)

**[C1] REQ-011 dead code — `verifyAnswerEdges` never called**
- File: `lib/traceability/verify-edges.ts` (entire module)
- Evidence: `grep -rn "verifyAnswerEdges\|verify-edges" lib/ app/` → zero call sites outside the definition
- Impact: REQ-011 ("replay/eval scenario verifies edge integrity") is unsatisfied. The verifier exists but is dead code — no replay/eval path invokes it. This is worse than "deferred": it creates the illusion of compliance.
- **Required before merge**: Either (a) wire `verifyAnswerEdges` into the knowledge-gap replay path (even a single call site), or (b) remove the module and add a tracked issue (`gh issue create`) documenting the explicit deferral with a TODO in the plan.

**[C2] Matrix filters `jurisdiction`/`product`/`packageId`/`riskLevel` silently ignored**
- File: `lib/traceability/matrix.ts:154-170` (`loadDeliverables`)
- Evidence: The 4 filter fields appear only in the interface (`matrix.ts:16-19`) and Zod schema (`route.ts:17-20`), never in the query. `loadDeliverables` filters by `orgId`, `projectId`, `nodeType` only.
- Impact: AC-02 "filters operate" is only 20% true (1 of 5 filters works). Users selecting jurisdiction/product/risk-level see no effect.
- **Required before merge**: Either implement the filters (join `source_sections`/`submission_packages`/`risk_items` for jurisdiction/product/package/risk), or restrict the UI to only show the filters that work and file an issue for the rest.

**[C3] `unresolved_review` gap false-positive in production path**
- File: `lib/traceability/matrix.ts:106`
- Code: `if (reviewEdge && !deps.nodesById?.get(reviewEdge.fromNodeId)?.reviewerId)`
- Evidence: The route (`route.ts:40`) and page (`page.tsx:112`) call `buildMatrix` without `nodesById`. When `nodesById` is undefined, the optional chain short-circuits: `undefined?.get(...)` → `undefined`, `undefined?.reviewerId` → `undefined`, `!undefined` → `true`. So the condition becomes `if (reviewEdge && true)` → **every reviewed deliverable is flagged unresolved**.
- Impact: AC-03 surfaces a false "검토 미완료" badge on every reviewed item. This is a user-facing correctness bug.
- **Required before merge**: Pass `nodesById` from the route/page (load referenced nodes), or remove the `unresolved_review` branch until the lookup is wired.

### Warnings (should fix, not hard-blocking)

**[W1] AC-05 trigger unwired — supersession hooks defined but never called**
- Files: `lib/traceability/hooks.ts:29` (`onSourceSectionSuperseded`), `hooks.ts:78` (`onRegulatoryUpdateSuperseded`)
- Evidence: `grep -rn "onSourceSectionSuperseded" lib/ app/` → zero call sites outside `hooks.ts`
- Impact: The SPEC says "WHEN a source is superseded THE SYSTEM SHALL propagate" — automatic propagation does not happen. The manual `staleReason` param on the edges route is a workaround, not the specified trigger.
- **Assessment**: This is the documented DEFERRED item. Acceptable as scope-discipline **IF** tracked as an issue and documented in `progress.md`. Currently undocumented. File `gh issue create` and add a `@MX:TODO` at the delta-sync supersession write site.

**[W2] PDF export test too weak — no byte assertion**
- File: `lib/traceability/__tests__/integration-real-pipeline.test.ts:62-74`
- Code: `expect(typeof result.success).toBe('boolean')`
- Impact: Per the prompt's anti-leniency rule ("does the test assert non-empty real bytes, or just didn't throw?") — the PDF test does NOT assert non-empty bytes. An empty or broken PDF would pass.
- **Fix**: Add `expect(result.success).toBe(true); expect(result.content?.length ?? 0).toBeGreaterThan(0)` to match the MD test strength. Note: the prompt mentions "PDF injection confirmation" as DEFERRED — this is consistent with that.

**[W3] AC-01 lacks a single end-to-end chain test**
- Evidence: The 4-hop chain (source → answer → review → export) is tested only in isolated units. No test creates all 4 nodes, links them, and verifies via matrix + packet together.
- **Fix**: Add one integration test that builds the chain via `createEdge` and asserts the packet tree renders all 4 hops. This can live in `integration-real-pipeline.test.ts`.

**[W4] IDOR 404 mapping untested at HTTP layer**
- Evidence: `EdgeIdorError` → 404 mapping exists in `edges/route.ts:119-121` but no test exercises the route end-to-end with a cross-org node. The unit test (`graph.test.ts:94-129`) proves `createEdge` rejects, but not that the route returns 404 (vs 500 if the catch were misconfigured).
- **Fix**: Add a route-level test (mock `withPermission` session, call the route handler directly with a foreign-org `toNodeId`, assert 404). The prompt specifically asks "is the test real not mocked-away?" — currently it's only at the unit level.

### Suggestions (craft, not blocking)

**[S1] `matrix.ts:80` dead branch** — `const evidenceSources = incoming.filter(...).map(() => null)` produces an array of nulls that is only used in a fallback branch (`matrix.ts:117-121`) which itself produces placeholder `{nodeType:'source_section', authority:null, version:null}` objects. This is misleading — either populate evidence properly from `nodesById` or remove the placeholder fallback.

**[S2] `stale-propagation.ts:123-124`** — `void and; void eq;` is a workaround for unused imports. Clean up by removing the `and`/`eq` imports entirely (they're not used in this module after the refactor).

**[S3] Export injection surface** — `export-packet.ts:27,40,76,84` interpolates `refTable`, `refId`, `authority`, `version` into Markdown strings. These are DB-stored and not directly user-controllable at request time, but `upsertNode` does NOT validate `refTable` against an allowlist. Low risk (callers are internal), but an allowlist on `refTable` at `upsertNode` would harden the render path.

**[S4] `evidence-packet.test.ts:15-17`** — The "returns null when node not found" test is a no-op (`expect(true).toBe(true)`). Either implement it via a DB stub or remove the placeholder with a comment pointing to the integration test.

---

## What Works Well (credit where due)

1. **3-layer IDOR defense** (`withPermission` + `createEdge` double-org-gate + RLS policy) is well-designed and the `EdgeIdorError` → 404 (not 403) approach correctly avoids leaking cross-org node existence.
2. **Audit trail** is the strongest dimension — every mutate + export path emits a structured audit row with correct action enum values, and the enum lock-step is runtime-tested.
3. **Idempotent edge insert** via `onConflictDoNothing` on `uq_evidence_edges_relation` prevents duplicate evidence edges on retry.
4. **Stale propagation BFS** is correctly idempotent (`uq_stale_flags_node_reason`), cycle-terminating, and the pure `bfsReachable` helper is cleanly factored for unit testing.
5. **WCAG 2.1 AA** — gap badges use icon + text (not color alone), `role="tree"`/`aria-labelledby` on the packet tree.
6. **Convention adherence** — Drizzle schema style, RSC + client island split, `withPermission` helper, `writeAudit` pattern, `@MX:ANCHOR` on high-fan-in modules all match the classify/knowledge-gap precedent.
7. **Migration quality** — single-file `0068_traceability.sql`, RLS on all 3 tables, proper FKs, unique indexes for idempotency, CHECK constraint for no-self-reference.

---

## Conditions for Unconditional PASS

Before claiming full SPEC satisfaction, the following must be resolved (each is
scoped — no re-architecture needed):

1. **[C1] REQ-011 verifier**: Wire `verifyAnswerEdges` into one replay/eval call site, OR remove the module + file `gh issue create` documenting the deferral.
2. **[C2] Matrix filters**: Implement `jurisdiction`/`product`/`packageId`/`riskLevel` filtering in `loadDeliverables`, OR restrict the UI to only the filters that work + file an issue.
3. **[C3] `unresolved_review` false positive**: Pass `nodesById` from the route/page, OR remove the broken branch until wired.
4. **[W1] Supersession trigger**: File `gh issue create` for the delta-sync/impact write-path wiring, add `@MX:TODO` at the call site in `lib/radar/delta-sync/ingest.ts`, document the deferral in `progress.md`.
5. **[W2] PDF assertion**: Strengthen the PDF test to assert non-empty bytes (or explicitly document why the renderer may be unavailable in CI).

Items 1-3 are functional correctness gates. Items 4-5 are documentation/test-rigor gates. All five are small, localized fixes.

---

## Verdict

**PASS-WITH-CONDITIONS** — The evidence-graph foundation is sound and
mergeable for the audit/security/core-graph dimensions. The 3 functional
defects (C1-C3) must be resolved or explicitly descoped with tracked issues
before the SPEC can claim full acceptance. The deferrals (W1 REQ-011, W1 AC-05
trigger) are borderline acceptable as scope-discipline, but only if they are
visible (issues filed, TODOs placed, progress.md updated) rather than silent.

**Do NOT modify implementation code from this evaluation.** Route C1-C3 to a
fixer agent; file issues for W1 deferrals.
