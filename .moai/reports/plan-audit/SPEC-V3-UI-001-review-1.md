# SPEC Review Report: SPEC-V3-UI-001

Iteration: 1/3
Auditor: plan-auditor (independent adversarial)
Date: 2026-07-03
Reasoning context ignored per M1 Context Isolation.

Verdict: PASS (conditional — mandatory fix D1 required before implementation kick-off)
Overall Score: 0.86

---

## Must-Pass Results

- [PASS] **MP-1 REQ number consistency**: REQ IDs are sequential within modules
  (001-005, 010-016, 020-024, 030-034, 040-045), zero-padded to 3 digits, with no
  duplicates and no intra-module gaps. Inter-module gaps (005→010, 016→020, 024→030,
  034→040) are intentional module separators, consistent with SPEC-V3-INBOX-001
  convention. **However** the stated COUNT is wrong (see D1) — the numbering scheme
  itself is consistent; the arithmetic summary is not. MP-1 (numbering) PASSES; D1
  is tracked separately as a consistency defect.

- [PASS] **MP-2 EARS format compliance**: All 28 REQs match exactly one of the five
  EARS patterns. EARS keywords (When/While/Where/If/Shall/Shall NOT) are in English;
  response text is Korean (explicitly permitted at spec.md:77). Spot-check:
  REQ-001 (Ubiquitous "The system shall") spec.md:82;
  REQ-002 (Event "When...shall") spec.md:86;
  REQ-003 (State "While...shall...while...shall") spec.md:90;
  REQ-004 (Optional "Where...shall") spec.md:93;
  REQ-014 (Unwanted "If...shall...SHALL NOT") spec.md:121;
  REQ-043 (Unwanted "If...shall...SHALL NOT") spec.md:191.
  No informal language, no Given/When/Then mislabeled as EARS. Rubric score 1.0.

- [PASS] **MP-3 YAML frontmatter validity**: spec.md:1-21 has all required fields:
  `id` (string "SPEC-V3-UI-001"), `version` (string "1.0.0"), `status` (string
  "draft"), `created` (ISO date "2026-07-03"), `priority` (string "high"),
  `labels` (array of 4 strings). Types correct. Note: field is `created` not
  `created_at` — see D4 (minor naming variance, intent unambiguous).

- [N/A] **MP-4 Section 22 language neutrality**: This SPEC targets a single-language
  TypeScript/Next.js frontend; no multi-language tooling enumeration required.
  Auto-passes.

---

## Category Scores (rubric-anchored)

| Dimension | Score | Band | Evidence |
|-----------|-------|------|----------|
| Clarity | 0.90 | 1.0 | Every REQ has single unambiguous interpretation; backend contracts are code-anchored with file:line cites (spec.md §7, §10). Minor: REQ-024 reason-prompt trigger could be clearer. |
| Completeness | 0.85 | 0.75 | All required sections present (HISTORY, Overview, Scope, Requirements, Traceability, Affected Files, NFR, Contract Authoritative Source, Open Questions, Dependencies, References, Exclusions). Frontmatter complete. 12 exclusions with rationale. Deduction: 3 REQs (004/005/024) lack dedicated AC scenarios. |
| Testability | 0.90 | 1.0 | GWT scenarios in acceptance.md are binary-testable: "4개 칼럼 렌더링" (AC-001), "오직 Needs Review만" (AC-003), "401 인라인 에러" (AC-006), "critical 위반 0개" (AC-010). No weasel words ("appropriate", "reasonable", "adequate") found. |
| Traceability | 0.80 | 0.75 | spec.md §4 table maps 13 UI REQs to backend REQs/ACs; all cited backend REQs (002/006/008/009/010/012/014/017/019/020/021/030) exist in SPEC-V3-INBOX-001. Deduction: REQ-011/016/024/031/040-045 lack explicit §4 table rows (most are legitimately UI-only). REQ-004/005/024 have no acceptance scenario. |

---

## Backend Contract Accuracy (verified against source code)

| SPEC Claim | Code Verified | Result |
|------------|---------------|--------|
| VALID_TRANSITIONS matrix (spec.md:296-303, REQ-020, AC-003) | `lib/domains/inbox/types.ts:33-40` | MATCH — `auto:['needs-review']`, `waiting:['needs-review','closed']` (no rejected), `closed/rejected:[]` all confirmed verbatim. |
| Approve body `{password, esigSignature}` (spec.md:312-316, REQ-013) | `app/api/inbox/[id]/approve/route.ts:18-21` | MATCH — Zod schema is exactly `{password, esigSignature}`. SPEC-V3-INBOX-001 §4.5 `{final_answer, citations[], esig:{...}}` text is indeed wrong; SPEC-V3-UI-001 correctly cites code as authoritative. |
| 401 invalid password path (spec.md:122, REQ-014) | `approve/route.ts:82` | MATCH — `Response.json({error:'Invalid password'}, {status:401})` at line 82. |
| 400 "Cannot promote" (spec.md:126, REQ-015) | `approve/route.ts:134-136` | MATCH for :134-136. Cite `:118` is the audit meta block, not the 400 return (see D3). |
| triage 409 Conflict (spec.md:144, REQ-022) | `triage/route.ts:80-93` | MATCH — assertValidTransition catch → audit → 409 return. |
| triage 404 IDOR (spec.md:148, REQ-023) | `triage/route.ts:67-70` | MATCH — assertTicketInOrg catch → 404. |
| Kanban list `GET /api/inbox?state=&limit=50` (REQ-002) | `app/api/inbox/route.ts:14-17,20-55` | MATCH — Zod accepts `state` (6-value enum, optional), `limit` (1-100 default 50). |
| `listByTriageState(db, orgId, filters)` (plan cite queries.ts:26) | `inbox/route.ts` imports & calls it with `{state, limit, offset}` | MATCH (indirect — signature confirmed via call site). |
| inbox.view minRole ra-member (REQ-030/031) | `permissions.ts:516-519` `'inbox.view': {minRole:'ra-member'}` | MATCH. |
| inbox.manage minRole ra-lead (REQ-032) | `permissions.ts:507-510` `'inbox.manage': {minRole:'ra-lead'}` | MATCH. |
| ask.create minRole viewer (REQ-033) | `permissions.ts:528-531` `'ask.create': {minRole:'viewer'}` | MATCH. |
| Sidebar showX prop convention (REQ-031) | `components/shell/Sidebar.tsx:35-75` | MATCH — 14 existing `showX?: boolean` props follow identical pattern. |
| layout.tsx server-side resolution (REQ-030) | `app/(app)/layout.tsx:21-60` | MATCH — `let showX = false; ... resolved in try block via auth() + hasRole()`. |

**Backend contract accuracy: 13/13 claims verified correct.** This is the SPEC's strongest dimension — every code citation was checked against the actual merged source (PR #322) and matches.

---

## Defects Found

**D1 (MAJOR)** — spec.md:77, spec.md:344, spec-compact.md:16, acceptance.md:265 — REQ count
mismatch. The SPEC states "총 25개 REQ" / "25 REQs" in four places, but the actual
enumerated count is **28** (Module 1: 5 + Module 2: 7 + Module 3: 5 + Module 4: 5 +
Module 5: 6 = 28). acceptance.md:265 even lists all 28 IDs parenthetically
"(001..005, 010..016, 020..024, 030..034, 040..045)" while saying "25". This is an
arithmetic error (5+7+5+5+6 ≠ 25). Impact: a reviewer or implementer tracking "25
REQs done" might believe 3 REQs are out of scope. Severity MAJOR because it appears
in the Definition of Done checklist.

**D2 (MINOR)** — acceptance.md — Three REQs lack dedicated acceptance scenarios:
- REQ-V3-UI-004 (SLA badge rendering): no GWT scenario covers `slaDeadline` display
  or overdue styling.
- REQ-V3-UI-005 (archived filter for terminal states): no GWT scenario covers the
  `showArchived` toggle behavior.
- REQ-V3-UI-024 (reason prompt for rejected/escalated transitions): no GWT scenario
  covers the optional `reason` (max 500 chars) input.
Impact: these REQs are testable implicitly during implementation but have no
falsifiable acceptance gate. Recommend adding AC-UI-011 (SLA badge), AC-UI-012
(archived filter), AC-UI-013 (reason prompt).

**D3 (MINOR)** — spec.md:126, acceptance.md:129 — REQ-015 cites `approve/route.ts:118`
for the 400 "Cannot promote" path, but line 118 is the audit-on-failure `meta_json`
block. The actual 400 return is at `:134-136` (correctly cited alongside). The `:118`
cite is misleading. Recommend removing `:118` or replacing with `:130-136`.

**D4 (MINOR)** — spec.md:5, acceptance.md:5 — YAML uses field name `created` rather
than `created_at` (FC-4 expects `created_at`). Value is a valid ISO date string;
intent is unambiguous. Likely a project-wide convention; verify consistency with
other SPECs and standardize.

**D5 (MINOR)** — spec.md:243, spec-compact.md:105 — `stores/inbox.ts` is specified
to include `viewMode` field, but list-view is explicitly excluded (Exclusion #10,
spec.md:69). Scope ambiguity: either remove `viewMode` from the store spec or
document it as a forward-compatible placeholder (Phase D.2).

**D6 (MINOR)** — spec.md §4 traceability table (lines 205-218) — REQ-V3-UI-011
(detail page fields) has inline backend trace text (spec.md:108:
"REQ-V3-INBOX-001, REQ-V3-INBOX-021") but is absent from the §4 table. Minor
documentation gap.

**D7 (MINOR)** — acceptance.md:1-10 — frontmatter missing `labels` field present in
spec.md. Secondary document; low impact.

---

## Chain-of-Verification Pass

Second-look findings. Re-read each section that was skimmed in pass 1:

1. **Every REQ-XXX entry read?** Yes — all 28 REQs individually checked against EARS
   patterns and backend traces. Confirmed no duplicates, no gaps within modules.

2. **REQ sequencing end-to-end?** Verified: 001,002,003,004,005 → 010,011,012,013,
   014,015,016 → 020,021,022,023,024 → 030,031,032,033,034 → 040,041,042,043,044,
   045. No orphan numbers, no duplicates.

3. **Traceability for every REQ?** Caught 3 REQs (004/005/024) with no dedicated AC
   scenario — added as D2. REQ-011 missing from §4 table — added as D6.

4. **Exclusions specificity?** 12 exclusions, each with rationale (regulatory,
   scope, or dependency-cited). Boundary unambiguous: WebSocket/DnD/bulk/auto-polling/
   final_answer-editing all explicitly excluded. PASS.

5. **Contradictions between requirements?** Checked REQ-012 (approve shown when
   finalAnswer truthy) vs REQ-015 (400 if final_answer missing) — consistent
   (REQ-012 gates the button, REQ-015 handles edge if gate is bypassed). REQ-020
   (VALID_TRANSITIONS gating) vs SPEC-V3-INBOX-001 §4.3 (claims any→rejected) —
   correctly resolved via §7.1 (code authoritative). No internal contradictions
   found in UI SPEC itself.

6. **Backend cite line numbers spot-checked?** Verified 13 cites against source
   code (table above). All material claims match; one minor line-number imprecision
   (D3).

First pass was thorough. Second pass added D2/D3/D6 specifics but no new major
findings.

---

## Recommendation

**Verdict: PASS** — conditional on fixing D1 before implementation start.

The SPEC is fundamentally sound:
- Backend contract accuracy is exemplary (13/13 code citations verified correct).
- EARS compliance is clean across all 28 REQs.
- Exclusions are comprehensive and boundary-clear.
- Regulatory framing (21 CFR Part 11, WCAG 2.1 AA, Charter 지양-2/지양-4) is
  correctly HARD, not optional.
- No scope creep; no over-engineering; affected-file paths are all sane root-level
  (no `src/` errors).

**Mandatory pre-implementation fix (D1):**
Replace "25" with "28" in all four locations:
- `spec.md:77` — "5개 모듈, 총 25개 REQ" → "5개 모듈, 총 28개 REQ"
- `spec.md:344` (References §10) — "5 modules, 25 REQs" → "5 modules, 28 REQs"
- `spec-compact.md:16` — "25 REQs, 5 modules" → "28 REQs, 5 modules"
- `acceptance.md:265` (DoD §4.1) — "모든 25개 REQ-V3-UI-XXX" → "모든 28개 REQ-V3-UI-XXX"

**Recommended (non-blocking) fixes:**
- D2: Add AC-UI-011 (SLA badge), AC-UI-012 (archived filter), AC-UI-013 (reason
  prompt) to acceptance.md.
- D3: Remove or correct the `:118` cite in spec.md:126.
- D5: Either remove `viewMode` from stores/inbox.ts spec or annotate as
  Phase D.2 placeholder.

The count error is trivial to fix (arithmetic correction) and does not indicate a
structural flaw. Once D1 is corrected, this SPEC is approved for Run phase entry.

Verdict: PASS
