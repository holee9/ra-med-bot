# SPEC Review Report: SPEC-REGULA-MIGRATION-001
Iteration: 1/3
Verdict: FAIL
Overall Score: 0.64

Reasoning context ignored per M1 Context Isolation. Only `spec.md` (primary),
`acceptance.md`, and `plan.md` (cross-reference) were consulted. No author
reasoning or conversation history was used.

## Must-Pass Results

- [PASS] **MP-1 REQ number consistency**: REQ IDs are grouped-sequential with no
  gaps or duplicates and consistent 3-digit zero-padding:
  `REQ-MIGRATION-001..007` (spec.md:75-81), `REQ-CI-001..003` (spec.md:87-89),
  `REQ-SAFETY-001..003` (spec.md:95-97). 13 unique IDs total. Grouped-prefix
  convention is a recognized variant of sequential numbering. Note (not a
  failure): the rubric's literal example is flat `REQ-001..N`; if the harness
  enforces flat numbering strictly this would need re-numbering.

- [FAIL] **MP-2 EARS format compliance**: The 7 Acceptance Criteria in spec.md
  §3 (spec.md:103-111) are declarative test criteria ending in "...존재한다",
  "...PASS한다", "...실패한다" — none match any of the five EARS patterns. The
  expanded `acceptance.md` explicitly declares Given/When/Then format
  (acceptance.md:3: "모든 AC는 Given-When-Then 시나리오로 정의되며"). The M3
  rubric explicitly classifies "Given/When/Then test scenarios mislabeled as
  EARS" as the 0.50 band and as an MP-2 FAIL trigger. (The REQ statements in §2
  ARE properly EARS — REQ-MIGRATION-006/007, REQ-CI-002/003, REQ-SAFETY-001 all
  use clean Event-driven/Unwanted/State-driven patterns; but MP-2 per checklist
  AC-1 covers Acceptance Criteria, which are not EARS.)

- [FAIL] **MP-3 YAML frontmatter validity**: The required field `created_at` is
  absent. The SPEC uses `created` instead (spec.md:7: `created: 2026-07-09`).
  The value is a valid ISO date, but the rubric explicitly names the required
  field `created_at` and states "Any missing required field = FAIL." All other
  required fields are present and correctly typed (id, version, status=draft,
  priority=High, labels=[array]); only the field name differs.

- [N/A] **MP-4 Section 22 language neutrality**: N/A — single-domain SPEC
  (PostgreSQL migrations + GitHub Actions CI). Not multi-language tooling; the
  16-language enumeration criterion does not apply. Auto-pass.

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.55 | 0.50 | AC-01 "예상 테이블 count" undefined (spec.md:105); "10개 drift point" count imprecise vs ~11-13 enumerated (spec.md:37,40); REQ-MIGRATION-001/005 bundle separable outcomes (spec.md:75,79); REQ-MIGRATION-006 is deferred [DELTA] (spec.md:80, plan.md:42); workflow path ambiguous (spec.md:139) |
| Completeness | 0.75 | 0.75 | HISTORY ✓ (spec.md:25), WHY ✓ (§1.1-1.2), WHAT ✓ (§1.3), HOW ✓ (§4), REQUIREMENTS ✓ (§2), AC ✓ (§3), Exclusions ✓ with 6 specific entries (spec.md:157-164). One non-critical frontmatter field-name issue (`created` vs `created_at`). |
| Testability | 0.75 | 0.75 | Verification column concrete (psql exit code, introspection queries, CI logs, negative test AC-05). AC-01 "예상 테이블 count"/"모든 RLS policy" not pinned to exact numbers/set (spec.md:105,14-15). REQ-MIGRATION-006 exact fix deferred (spec.md:80). No major weasel words. |
| Traceability | 0.50 | 0.50 | No explicit REQ↔AC mapping column in spec.md §2-3. Implicit mapping is derivable (REQ-MIGRATION-001→AC-01, REQ-CI-003→AC-05, REQ-SAFETY-002→AC-07, etc.). REQ-MIGRATION-002 (regula_app role) has only edge-case coverage (acceptance.md:95), no primary AC. All ACs reverse-trace to valid REQs. |

## Defects Found

D1. spec.md:7 — **YAML frontmatter missing required field `created_at`**; field
    is named `created` instead. MP-3 violation. — Severity: **critical**

D2. spec.md:103-111, acceptance.md:3 — **Acceptance Criteria are not in EARS
    format**. spec.md §3 ACs are declarative test criteria; acceptance.md
    explicitly uses Given/When/Then ("모든 AC는 Given-When-Then 시나리오로
    정의된다"). M3 rubric classifies GWT as 0.50 band and MP-2 FAIL. MP-2
    violation. — Severity: **critical**

D3. spec.md:96 (REQ-SAFETY-002) — **Requirement embeds implementation
    mechanism**: "autocommit 방식(`cat | psql` 또는 파일 단위)으로 적용한다"
    prescribes HOW (shell pipeline / per-file apply) rather than the WHAT
    (CONCURRENTLY indexes shall apply without transaction-block failure). RQ-4
    violation. — Severity: **major**

D4. spec.md:105 (AC-01) — **"예상 테이블 count" (expected table count) and
    "모든 RLS policy" are not pinned to concrete numbers/enumerated set
    anywhere in the SPEC**. A tester cannot determine PASS/FAIL for "matches
    expected count" when the expected count is undefined. AC-2 (binary-
    testable) partial violation. — Severity: **major**

D5. spec.md §2-§3 — **No explicit REQ↔AC traceability mapping**. The AC table
    (§3) lacks a REQ-ID column; mapping is only implicit. REQ-MIGRATION-002
    (regula_app role bootstrap) has no primary AC — only an edge-case scenario
    (acceptance.md:95). Traceability rubric 0.50 band. — Severity: **major**

D6. spec.md:37,40 — **"10개 drift point" count is imprecise**. Enumerated fixes
    in §4.1 are: 0002, 0004, 0087, 0095 (4 trivial) + 0054, 0055, 0056, 0082,
    0086 (5 FK) + 0089/0090/0092 idempotency (3, or 1 class) + 0014 + 0083 =
    13 (or 11) drift points, plus bootstrap role (REQ-MIGRATION-002) which is
    not a "drift point" but a missing prerequisite. — Severity: **minor**

D7. spec.md:139 — **CI workflow artifact path is ambiguous**: "migrations-real-
    db.yml (또는 ci.yml에 job 추가)" leaves the deliverable file location
    undecided at plan time. — Severity: **minor**

D8. spec.md:75,79 — **REQ-MIGRATION-001 and REQ-MIGRATION-005 bundle multiple
    separable outcomes** (from-scratch apply + trigger + RLS in 001; FK fix +
    fix-up idempotency in 005). EARS best practice is atomic requirements; this
    weakens traceability and testability granularity. — Severity: **minor**

D9. spec.md:80, plan.md:42 — **REQ-MIGRATION-006 (0014 transaction fix) is a
    [DELTA] requirement whose exact fix is deferred to Run phase** ("정확한 fix
    방향은 Run 단계에서 progress.md에 기록"). Honest but not fully specified
    at plan time; the EARS trigger "WHEN ... 진단되면" depends on a Run-phase
    diagnosis activity that has not yet occurred. — Severity: **minor**

## Chain-of-Verification Pass

Second-look result: **one material finding consolidated, no new critical/major
defects**. Verified by re-reading sections: §1 (Purpose), §2 (all 13 REQs end-
to-end), §3 (all 7 ACs), §4 (Technical Approach), Exclusions (6 entries — all
specific, confirmed PASS), frontmatter, acceptance.md (all 7 ACs + edge cases +
quality gates), plan.md (4 groups, risk table).

Checks performed in second pass:
- REQ sequencing verified end-to-end (not spot-checked): MIGRATION 001-007, CI
  001-003, SAFETY 001-003 — no gaps, no dupes.
- Traceability verified for every REQ (not sampled): all 13 have at least
  implicit AC coverage; REQ-MIGRATION-002 confirmed weakly covered (edge-case
  only) — folded into D5.
- Exclusions checked for specificity (not just presence): 6 concrete exclusions
  confirmed (base dump, data migration, drizzle-kit push, schema.ts, new fix-up
  migrations, rollback files) — PASS.
- Contradictions scanned between requirements: REQ-SAFETY-001 (no schema change
  to existing DB) vs REQ-MIGRATION-001..007 (edit migration files) — not
  contradictory (editing historical files ≠ re-applying to deployed DB).
- REQ-SAFETY-002 (autocommit `cat | psql`) vs REQ-MIGRATION-006 (fix 0014
  BEGIN/COMMIT) — implementation-level tension only, not a SPEC contradiction.
- Reverse orphan-AC scan: all 7 ACs trace to at least one valid REQ.

## Recommendation

Verdict is FAIL due to two must-pass violations. Both are mechanically fixable
without altering SPEC intent. manager-spec should apply the following fixes in
priority order:

1. **[MP-3, D1]** Rename frontmatter field `created` → `created_at` at
   spec.md:7. Verify the value remains `2026-07-09` (valid ISO date).

2. **[MP-2, D2]** Either (a) rephrase the 7 Acceptance Criteria in spec.md §3
   into EARS patterns, matching the REQ they verify — e.g. AC-01 →
   "WHEN `migrations/*.sql` are applied to a fresh pgvector container, THE
   SYSTEM SHALL complete with 0 errors and produce [N] tables, the
   `audit_log_hash_bi` trigger, and [M] RLS policies"; or (b) explicitly
   document in spec.md §3 that this project adopts BDD Given/When/Then for
   acceptance scenarios as a documented deviation from the EARS-for-AC rubric,
   and add a REQ-traceability column. Option (a) is preferred to satisfy MP-2
   cleanly.

3. **[D4, testability]** Pin AC-01 to concrete numbers: replace "예상 테이블
   count" with an explicit integer (or a deterministic derivation rule), and
   enumerate the exact RLS-policy name set expected in `pg_policies`.

4. **[D5, traceability]** Add a "REQ IDs" column to the §3 AC table mapping
   each AC to its covering REQ(s); ensure REQ-MIGRATION-002 (regula_app role
   bootstrap) gets a primary AC (not only an edge-case scenario).

5. **[D3, RQ-4]** Rewrite REQ-SAFETY-002 to express the WHAT ("CONCURRENTLY
   indexes SHALL apply without transaction-block failure") and move the
   `cat | psql` mechanism into §4 Technical Approach (HOW).

6. **[D6]** Reconcile the "10개 drift point" claim (spec.md:37,40) with the
   actual enumerated fix list in §4.1, or restate as "N drift points (see
   §4.1)".

7. **[D7]** Decide the CI workflow deliverable path (standalone
   `migrations-real-db.yml` vs new job in `ci.yml`) and state it definitively
   in §4.2.

8. **[D8]** (Optional) Split REQ-MIGRATION-001 and REQ-MIGRATION-005 into
   atomic REQs to improve traceability granularity.

9. **[D9]** (Optional) Keep REQ-MIGRATION-006 as [DELTA] but add an explicit
   fallback / acceptance lower-bound so AC-01 is testable even if the
   per-statement diagnosis yields multiple root causes.

Once items 1-2 are applied, MP-3 and MP-2 can be re-verified at iteration 2.
Items 3-7 should be resolved in the same revision to lift Clarity/Testability/
Traceability bands above 0.50.
