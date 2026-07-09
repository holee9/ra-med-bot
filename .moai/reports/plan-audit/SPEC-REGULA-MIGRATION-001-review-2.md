# SPEC Review Report: SPEC-REGULA-MIGRATION-001
Iteration: 2/3
Verdict: FAIL
Overall Score: 0.72

Reasoning context ignored per M1 Context Isolation. Only `spec.md` (primary),
`acceptance.md` (cross-reference), and the iteration-1 review report (for
regression check) were consulted. No author reasoning or conversation history
was used. Project frontmatter convention verified against
`.moai/specs/SPEC-REGULA-RLHF-001/spec.md` per orchestrator instruction.

## Must-Pass Results

- [PASS] **MP-1 REQ number consistency**: REQ IDs are grouped-sequential with no
  gaps or duplicates and consistent 3-digit zero-padding, verified end-to-end:
  `REQ-MIGRATION-001..007` (spec.md:80-86), `REQ-CI-001..003` (spec.md:92-94),
  `REQ-SAFETY-001..003` (spec.md:100-102). 13 unique IDs. Grouped-prefix
  convention is a recognized variant of sequential numbering.

- [FAIL] **MP-2 EARS format compliance**: The 8 Acceptance Criteria in spec.md §3
  (spec.md:110-119) are Given/When/Then scenarios — none match any of the five
  EARS patterns. The SPEC explicitly declares this: spec.md:108 states "모든 AC는
  Given/When/Then 시나리오로 정의된다" and spec.md:32 (frontmatter note) frames
  it as a deliberate project choice. The §2 Requirements ARE clean EARS
  (REQ-MIGRATION-006/007 use WHEN/THEN; REQ-CI-003 uses IF/THEN; REQ-SAFETY-001
  uses WHILE — all properly event/state/unwanted-driven). However, MP-2 per
  checklist AC-1 covers Acceptance Criteria, and 0 of 8 ACs match an EARS
  pattern. Per M3 rubric, "Fewer than a quarter of ACs use EARS patterns" is the
  0.25 band; and MP-2 explicitly lists "Given/When/Then test scenarios" as a
  FAIL trigger. The SPEC author took iteration-1's option (b) (document GWT as a
  deviation) rather than option (a) (rephrase ACs into EARS). A documented
  deviation from a must-pass rubric is still non-compliance — MP-2 has no escape
  hatch for "documented deviation". This is the sole remaining blocker. See
  Recommendation for the iteration-3 resolution path.

- [PASS] **MP-3 YAML frontmatter validity**: Field `created: 2026-07-09`
  (spec.md:7) follows the established project convention. Verified:
  `.moai/specs/SPEC-REGULA-RLHF-001/spec.md` uses `created: 2026-06-22`
  (identical field name, no `_at` suffix). Per orchestrator instruction, a
  project-wide frontmatter convention overrides the generic `created_at`
  expectation — MP-3 is satisfied (convention-compliant), NOT a defect. All
  other required fields present and correctly typed: id (string, matches
  SPEC-{DOMAIN}-{NUM}), version (1.1.0 string), status (draft), priority (High),
  labels (array of 3). Additional non-required fields (phase, author,
  issue_number, depends_on, lifecycle_level, updated) are well-formed.

- [N/A] **MP-4 Section 22 language neutrality**: N/A — single-domain SPEC
  (PostgreSQL migrations + GitHub Actions CI). Not multi-language tooling; the
  16-language enumeration criterion does not apply. Auto-pass.

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.75 | 0.75 | Major clarity gains since iter-1: D4 table count pinned to 96 (spec.md:112, acceptance.md:13), D6 drift count reconciled to 11 (spec.md:43,56), D7 CI workflow path definitively standalone (spec.md:147), D9 acceptance lower-bound added (spec.md:85). Residual: AC-07 When clause re-introduces the apply mechanism "cat \| psql 또는 파일 단위 apply" (spec.md:118) — pragmatic for a test harness setup but slightly blurs WHAT/HOW at the AC level (minor). |
| Completeness | 0.75 | 0.75 | HISTORY ✓ (spec.md:25-30, now includes 1.1.0 revision log), WHY ✓ (§1.1-1.2 with regulatory anchor 21 CFR Part 11), WHAT ✓ (§1.3), HOW ✓ (§4 with 4.1-4.4), REQUIREMENTS ✓ (§2, 13 REQs), AC ✓ (§3, 8 ACs), Exclusions ✓ with 6 specific entries (spec.md:169-174). Frontmatter convention-compliant. |
| Testability | 0.85 | 0.75-1.0 | Substantial improvement since iter-1: AC-01 pins table count = 96 (spec.md:112), RLS policy baseline snapshot procedure defined deterministically (acceptance.md:15), AC-06 idempotency verification concrete (`answer_feedback` table count = 1, spec.md:117), AC-08 role bootstrap binary check (`pg_roles` count = 1, spec.md:119), D9 lower-bound makes REQ-MIGRATION-006 testable regardless of diagnosis outcome (spec.md:85). No weasel words. Slight deduction for RLS baseline depending on a Run-phase T0 capture (derivable but not pre-pinned). |
| Traceability | 1.0 | 1.0 | Full REQ↔AC traceability matrix now present as a dedicated column in the §3 AC table (spec.md:110). New AC-08 provides direct primary coverage for REQ-MIGRATION-002 (spec.md:119), closing the iter-1 gap. Verified end-to-end (not sampled): all 13 REQs have ≥1 AC; all 8 ACs reference valid REQs; no orphans either direction. Mapping: MIGRATION-001→AC-01; 002→AC-08; 003→AC-01; 004→AC-01; 005→AC-01/AC-06; 006→AC-01; 007→AC-01; CI-001→AC-02; CI-002→AC-02; CI-003→AC-05; SAFETY-001→AC-03; SAFETY-002→AC-07; SAFETY-003→AC-04. |

## Defects Found

D1. spec.md:110-119 (§3) — **8 Acceptance Criteria are Given/When/Then, not
    EARS**. MP-2 violation persists from iteration 1. The SPEC author took
    option (b) (document GWT as deviation at spec.md:108, 32) rather than option
    (a) (rephrase into EARS). A documented deviation from a must-pass criterion
    remains non-compliance. This is the sole blocking defect. — Severity:
    **critical** (must-pass firewall)

D2. spec.md:118 (AC-07 When clause) — **Apply mechanism ("cat | psql 또는 파일
    단위 apply") re-appears in the AC's When clause**, even though it was
    correctly removed from REQ-SAFETY-002 (D3 iter-1, resolved at REQ level).
    For a test scenario this is more defensible than in a REQ (a test must
    specify harness setup), but it mildly re-introduces HOW into an acceptance
    statement. — Severity: **minor**

No other defects found. The revision substantially resolved 8 of 9 iteration-1
defects (D1-frontmatter, D3, D4, D5, D6, D7, D8-acknowledged, D9).

## Chain-of-Verification Pass

Second-look result: **one new minor (D2), no new critical/major defects**.
Verified by re-reading: §1 (Purpose), §2 (all 13 REQs EARS patterns confirmed
end-to-end), §3 (all 8 ACs + REQ IDs column), §4 (4.1-4.4, mechanism correctly
housed in §4.3), Exclusions (6 entries, all specific), frontmatter (convention
verified against SPEC-REGULA-RLHF-001), acceptance.md (all 8 ACs + edge cases +
quality gates).

Checks performed in second pass:
- REQ sequencing re-verified end-to-end (not spot-checked): MIGRATION 001-007,
  CI 001-003, SAFETY 001-003 — no gaps, no dupes.
- Traceability re-verified for every REQ (not sampled): all 13 have explicit AC
  coverage in the REQ IDs column; all 8 ACs reverse-trace to valid REQs.
- REQ-SAFETY-002 re-checked: now clean WHAT (spec.md:101), mechanism moved to
  §4.3 (spec.md:149-157). D3 resolved at REQ level.
- AC-01 count re-checked: 96 is explicitly pinned in both spec.md (L112) and
  acceptance.md (L13). D4 resolved.
- REQ-MIGRATION-006 lower-bound re-checked: spec.md:85 — present and
  well-formed. D9 resolved.
- Contradiction re-scan: REQ-SAFETY-001 (no schema change to existing DB) vs
  REQ-MIGRATION-001..007 (edit files) — not contradictory (editing ≠
  re-applying, AC-03 verifies). REQ-MIGRATION-005 (uuid FK fix) vs REQ-SAFETY-001
  — fix-up migrations 0089/0090/0092 handle deployed DB, no conflict.
- New AC-08 verified: proper GWT scenario, covers REQ-MIGRATION-002 directly.
- Exclusions re-checked for specificity: 6 concrete entries (base dump, data
  migration, drizzle-kit push, schema.ts, new fix-up migrations, rollback files)
  — PASS.

## Regression Check (Iteration 2)

Defects from iteration 1 (review-1.md D1-D9):

- **D1** (frontmatter `created` vs `created_at`): **RESOLVED**. Orchestrator
  instruction + SPEC-REGULA-RLHF-001 convention confirm `created` is the
  project-wide field name. MP-3 now PASS (convention-compliant).
- **D2** (ACs not EARS / GWT): **UNRESOLVED**. Author took option (b); GWT
  remains non-EARS. Renumbered as D1 in this iteration. MP-2 still FAIL.
- **D3** (REQ-SAFETY-002 mechanism in REQ): **RESOLVED**. spec.md:101 is now
  clean WHAT; mechanism moved to §4.3. (Minor residual in AC-07 — see new D2.)
- **D4** (AC-01 "예상 테이블 count" unpinned): **RESOLVED**. Pinned to 96 at
  spec.md:112 and acceptance.md:13; RLS baseline snapshot procedure defined.
- **D5** (no REQ↔AC traceability column; REQ-MIGRATION-002 no primary AC):
  **RESOLVED**. REQ IDs column added (spec.md:110); AC-08 added for
  REQ-MIGRATION-002 (spec.md:119). Full 13×8 matrix verified.
- **D6** ("10개 drift point" imprecise): **RESOLVED**. Reconciled to 11
  (spec.md:43,56), referencing research.md D1-D11.
- **D7** (CI workflow path ambiguous): **RESOLVED**. Definitively standalone at
  `.github/workflows/migrations-real-db.yml` (spec.md:147).
- **D8** (REQ-MIGRATION-001/005 bundle): **ACKNOWLEDGED**. spec.md:76 adds a
  transparent REQ-granularity note; bundle kept for REQ-ID stability with AC
  split (001→AC-01/08, 005→AC-01/06). Acceptable for a minor.
- **D9** (REQ-MIGRATION-006 [DELTA] deferred): **RESOLVED**. Acceptance
  lower-bound added at spec.md:85 making AC-01 testable regardless of diagnosis
  outcome.

Net: 8 of 9 prior defects resolved; 1 critical (MP-2) persists; 1 new minor
introduced (D2 this iteration).

## Recommendation

Verdict is FAIL due solely to MP-2. All other dimensions are now strong
(traceability is perfect at 1.0; testability 0.85). One decision point remains
for iteration 3:

1. **[MP-2, D1 — SOLE BLOCKER]** Convert the 8 Acceptance Criteria in spec.md §3
   from Given/When/Then into EARS patterns. This is iteration-1's option (a),
   which the SPEC author did not take. Concrete rephrasing examples:

   - **AC-01** (currently GWT) → "WHEN `migrations/*.sql` (`_rollback` 제외) are
     applied in numeric order to a fresh `pgvector/pgvector:pg16` container with
     `regula_app` pre-created, THE SYSTEM SHALL complete with 0 errors AND
     produce a public-schema table count of 96 AND the `audit_log_hash_bi`
     trigger in `pg_trigger` AND an RLS-policy-name set matching the
     `regula-test-db` baseline snapshot."
   - **AC-02** → "WHEN the from-scratch CI workflow boots a fresh pgvector
     service and applies migrations, THE SYSTEM SHALL execute the 7 real-db
     integration suites (`migrations-real-db`, `audit-immutability`,
     `audit-retention`, `cer-persist-roundtrip`, `model-governance`,
     `validation-consumers`, `knowledge-gap-replay-real`) with all 7 PASS and
     0 SKIPPED."
   - **AC-05** → "IF a deliberately drifted migration (e.g., `org_id text
     REFERENCES organizations(id)`) is introduced in a PR, THEN THE SYSTEM SHALL
     fail the from-scratch CI gate with a red status, blocking the merge."
   - **AC-08** → "WHEN `CREATE ROLE regula_app` is executed before applying
     `0001_audit_append_only.sql` to a fresh container, THE SYSTEM SHALL
     complete `0001`'s REVOKE/GRANT statements with 0 errors AND register
     `regula_app` in `pg_roles`."

   Apply the same WHEN/THEN (event-driven), IF/THEN (unwanted), or WHILE
   (state-driven) conversion to AC-03, AC-04, AC-06, AC-07. Preserve the
   detailed evidence/verification text in the "Verification" column — that part
   is already strong.

   **ALTERNATIVE (policy decision, not plan-auditor's to bless)**: If the
   project genuinely adopts GWT as its acceptance-scenario convention (as
   spec.md:108 and the frontmatter note at L32 assert), then MP-2 must be waived
   at the orchestrator/user level as an explicit rubric-deviation policy. This
   is not a plan-auditor PASS — it is a policy override that belongs upstream.
   If iteration 3 retains GWT without an orchestrator-issued MP-2 waiver, the
   verdict will remain FAIL and the report will escalate to the user per the
   3-iteration retry contract.

2. **[D2, minor — optional]** Move the apply-mechanism detail ("cat | psql 또는
   파일 단위 apply") out of AC-07's When clause (spec.md:118) and into the
   Verification column or §4.3, so the AC states only the condition ("WHEN a
   migration containing `CREATE INDEX CONCURRENTLY` is applied via the §4.3
   autocommit pipeline") and the expected outcome.

Once item 1 is applied (EARS conversion), MP-2 can be re-verified at iteration
3. With MP-2 cleared, all four must-pass criteria pass and all category scores
lift above 0.75 — the SPEC would be ready for Plan→Run transition.
