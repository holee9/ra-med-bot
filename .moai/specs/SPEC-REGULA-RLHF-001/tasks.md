# SPEC-REGULA-RLHF-001 — Implementation Plan (tasks.md)

> **Status**: draft plan, pending approval. Branch: `feat/issue-56-rlhf` (from `main` `a386149`).
> **Methodology**: TDD (brownfield). Project has 4169+ passing tests, high coverage. Pre-RED reading required.
> **Scope guard**: v1.0.0 REQs only. NO confidence-calibration, NO alternate-answers, NO qualityTags expansion. See §7 Follow-up.

---

## §1 Verified Baseline (by execution — L-007)

All counts verified by running the authoritative test extractors on 2026-06-25. Source test cited per row.

| Metric | Value | Source (test file:line) | Method |
|---|---|---|---|
| Latest migration | `0081_source_governance.sql` | `ls migrations/0*.sql \| tail -1` | Next = **0082** |
| `audit_action` pgEnum | **191** | `tests/unit/enterprise-migrations.test.ts:329` (`extractAuditActionEnumValues`) | runtime regex extractor, **lock-stepped** to `AuditAction` type (also 191, line 385) |
| `workflow_type` pgEnum | **17** | `lib/db/schema.ts:422` (pgEnum parse) | — |
| `PermissionAction` type | **38** | `lib/auth/permissions.ts:5` (union parse) | single source of truth for RBAC |
| Inngest registry | **4 functions** | `lib/inngest/functions.ts:16` (`export const functions = [...]`) | central registry — single point of registration |
| `PermissionAction` test (if any) | — | runtime assertion not found in enterprise-migrations; covered by `lib/signature/__tests__/rbac.test.ts` | — |

### Discrepancy resolved (orchestrator schema.ts parse)

The orchestrator's `audit_action = 39` (schema.ts pgEnum parse) was **wrong**. The authoritative runtime assertion in `tests/unit/enterprise-migrations.test.ts:329` asserts **191**, and the full test (377 tests) passes green. Root cause of the orchestrator's error: the test's extractor regex `[\s\S]*?(?=\n\/\/|\nexport|$)` is **non-greedy and stops at the next line-comment `//`**, so naive greedy parsing over-counts (208) or under-counts (39) depending on where the parser stops. **191 is authoritative.** The enum and `AuditAction` type are in strict 1:1 lock-step by the same test (line 328: `expect(values).toEqual(typeValues)`).

### Baseline test command
```
pnpm test --silent -- tests/unit/enterprise-migrations.test.ts
# → 377 passed (377)
```

---

## §2 Phase Decomposition (7 phases, 10 tasks max)

Phases ordered by dependency. Each phase = one TDD RED→GREEN→REFACTOR cycle batch. Files per phase align with SPEC §4.1.

### Phase A — DB Schema & Migration (foundational, blocks all)
**Target files**:
- NEW `migrations/0082_rlhf.sql` — `answer_feedback` table + RLS, `source_sections.feedback_score` column, 3 new `audit_action` enum values
- EDIT `lib/db/schema.ts` — add `answerFeedback` pgTable, `feedbackRatingEnum`, `qualityTagEnum` (8 values), extend `sourceSections` with `feedbackScore` column, extend `auditActionEnum` (+3)
- EDIT `lib/audit.ts` — extend `AuditAction` union (+3) to preserve lock-step

**Tasks**:
- **A1** (RED→GREEN): migration `0082_rlhf.sql` + schema.ts `answerFeedback` table, `feedbackRatingEnum` (up/down), `qualityTagEnum` (8 values: `citation_missing, citation_wrong, answer_incomplete, answer_wrong, outdated_info, jurisdiction_mismatch, helpful, excellent`), `source_sections.feedback_score` (numeric, nullable). RLS policy: users can only insert feedback for their own org. Test: migration file exists, table columns match, enum validation rejects non-enum values. → **AC-02**
- **A2** (RED→GREEN): extend `auditActionEnum` + `AuditAction` type with 3 values: `feedback_submitted`, `reranking_applied`, `reranking_rolled_back`. Lock-step test update: `enterprise-migrations.test.ts:329,385` → 194. → **AC-06** (partial)

**Delta after Phase A**: audit_action 191 → **194**, `source_sections` +1 column, 1 new table + 2 new enums.

### Phase B — Feedback Aggregation Library (pure logic, no I/O deps)
**Target files**:
- NEW `lib/rlhf/feedback-aggregator.ts` — `aggregateFeedback(records)`, `detectDownwardTrend(history)`, `computeMessageScore(records)`
- NEW `lib/rlhf/__tests__/feedback-aggregator.test.ts`

**Tasks**:
- **B1** (RED→GREEN): `aggregateFeedback` (mean of up=+1/down=-1 per messageId), `detectDownwardTrend` (sliding window 7-day, slope < 0 with ≥3 datapoints). Pure functions, deterministic. → **REQ-RLHF-005, REQ-RLHF-006**

### Phase C — Retrieval Re-ranker + Version Tracker (model-governance reuse)
**Target files**:
- NEW `lib/rlhf/reranker.ts` — `computeFeedbackWeight(sourceSectionId)`, `applyReranking(results, feedbackScores)`
- NEW `lib/rlhf/version-tracker.ts` — wraps `submitRlhfProposal` (existing) + `rollbackCombination` (existing) for re-ranking version metadata
- EDIT `lib/model-governance/rlhf-gate.ts` — **verify** `submitRlhfProposal` current API (already verified: takes `{orgId, submittedBy, promptId?, proposalText}`, returns `{changeRequestId}`, stores as `pending_review` — reuse as-is, do NOT modify gate semantics)
- NEW `lib/rlhf/__tests__/reranker.test.ts`, `version-tracker.test.ts`

**Tasks**:
- **C1** (RED→GREEN): `applyReranking` blends base vector score with `feedback_score` (weighted, configurable λ default 0.2). Test: reranking preserves ordering when all scores equal, boosts high-feedback sections, suppresses negative. → **REQ-RLHF-009, REQ-RLHF-010**
- **C2** (RED→GREEN): `version-tracker.recordReranking(version)` → calls `submitRlhfProposal` with metadata; `version-tracker.rollback(versionRef)` → calls `rollbackCombination`. Version metadata stored in `change_request` audit `meta_json` (reuse `buildAnswerVersionMetadata` from `audit-metadata.ts`). → **REQ-RLHF-013**
- **C3** (RED→GREEN): post-rerank verification gate — `verifyPostRerankInvariants(messageId)` re-checks confidence ≥ threshold, citation present, expert-review conditions. Reuse `evalGatePassed` / `checkEvalThreshold` from `eval-gate.ts`. **MUST be called from every reranking code path** (see §6 dead-code risk). → **REQ-RLHF-014, AC-07**

### Phase D — Knowledge Gap + Knowledge Promo Bridges (reuse-heavy, stub promo)
**Target files**:
- NEW `lib/rlhf/gap-promo-bridge.ts` — `createGapIssueForLowRatedAnswer(messageId, feedback)`, `proposePromotionCandidateForHighRatedAnswer(messageId, feedback)`
- NEW `lib/rlhf/__tests__/gap-promo-bridge.test.ts`

**Tasks**:
- **D1** (RED→GREEN): `createGapIssueForLowRatedAnswer` → wraps `createGitHubIssue` (existing in `lib/knowledge-gap/github-issue.ts`) with `GapIssueContext` derived from the low-rated message + qualityTags. Low-rated = rating `down` AND any of {citation_missing, citation_wrong, answer_incomplete, answer_wrong, outdated_info, jurisdiction_mismatch}. → **REQ-RLHF-007, AC-03**
- **D2** (RED→GREEN): `proposePromotionCandidateForHighRatedAnswer` → high-rated = rating `up` AND (`excellent` OR `helpful` in qualityTags). **Returns only a candidate descriptor** `{messageId, userId, evidence: {rating, tags}}`. Does NOT call `submitRlhfProposal` with auto-confirm. Writes an audit `feedback_submitted` + a `@MX:TODO` marker that the actual promotion wiring is deferred to #50. → **REQ-RLHF-008, REQ-RLHF-015 [HARD no-auto-confirm], AC-04**
  - **[HARD invariant]**: no code path in this function may insert into `change_request` with `approval_status != 'pending_review'`. Test asserts this.

### Phase E — Langfuse Emitter (thin wrapper, existing SDK)
**Target files**:
- NEW `lib/rlhf/langfuse-emitter.ts` — `emitFeedbackEvent(event)` wrapping `lib/observability/langfuse.ts`
- NEW `lib/rlhf/__tests__/langfuse-emitter.test.ts`

**Tasks**:
- **E1** (RED→GREEN): `emitFeedbackEvent` sends `{messageId, userId, rating, qualityTags, comment}` to Langfuse as a `feedback` event. Fails gracefully (no throw) when Langfuse is unavailable (matching existing `lib/observability/langfuse.ts` contract). → **REQ-RLHF-011**

### Phase F — API Routes + AnswerBlock UI Integration
**Target files**:
- NEW `app/api/rlhf/feedback/route.ts` — POST handler (zod-validated, `withPermission`-wrapped, writes `answer_feedback`, emits Langfuse, triggers gap/promo bridges async)
- NEW `app/api/rlhf/feedback/aggregate/route.ts` — GET (per-messageId aggregation)
- NEW `app/api/rlhf/heatmap/route.ts` — GET (per-question-type × corpus heatmap data)
- EDIT `components/chat/AnswerBlock.tsx` — extend with `FeedbackControl` sub-component (already `'use client'`, has `messageId` prop — clean integration point)
- NEW `components/answer-block/feedback-control.tsx` — thumbs up/down + tag chips + optional textarea
- NEW `app/(app)/quality/heatmap/page.tsx` — heatmap dashboard (admin-gated)
- NEW `tests/unit/api/rlhf-feedback.test.ts`, `__tests__/feedback-control.test.tsx`, `heatmap.test.tsx`

**Tasks**:
- **F1** (RED→GREEN): POST `/api/rlhf/feedback` — validates `qualityTags` ∈ 8-enum (AC-02 invariant at API boundary), inserts `answer_feedback` with `userId` from session, emits Langfuse, triggers `createGapIssueForLowRatedAnswer` or `proposePromotionCandidateForHighRatedAnswer` based on rating. `withPermission` requires new `rlhf.feedback` PermissionAction. → **REQ-RLHF-003, REQ-RLHF-004, AC-01**
- **F2** (RED→GREEN): GET `/api/rlhf/heatmap` — returns per-question-type × per-corpus mean feedback score, downward-trend flags. → **REQ-RLHF-012, AC-08**
- **F3** (RED→GREEN): `FeedbackControl` component renders in AnswerBlock, calls POST `/api/rlhf/feedback`, shows optimistic state + server confirmation. → **AC-01**

### Phase G — Reranking Wiring + Post-Rerank Gate Integration (cross-cutting)
**Target files**:
- EDIT retrieval pipeline (locate via grep `lib/rag/` or wherever retrieval scoring happens) — insert `applyReranking` call
- NEW `tests/integration/rlhf-reranking-flow.test.ts`

**Tasks**:
- **G1** (RED→GREEN): wire `applyReranking` into the actual retrieval pipeline. **Every retrieval path that returns AnswerBlock content MUST call `applyReranking` then `verifyPostRerankInvariants`**. Integration test: full feedback → aggregation → reranking → invariant-verification flow. → **REQ-RLHF-010, AC-05, AC-07** (these REQs are NOT satisfied by Phase C alone — only by wiring).

**Delta after Phase G**: PermissionAction 38 → **39** (new `rlhf.feedback`).

---

## §3 Migration Plan — `migrations/0082_rlhf.sql`

Follows project numbering convention (`NNNN_slug.sql`).

```sql
-- 0082_rlhf.sql — SPEC-REGULA-RLHF-001 (Issue #56)

-- §1 New pgEnum: feedback_rating
CREATE TYPE feedback_rating AS ENUM ('up', 'down');

-- §2 New pgEnum: quality_tag (8 values — REQ-RLHF-002, AC-02)
CREATE TYPE quality_tag AS ENUM (
  'citation_missing',
  'citation_wrong',
  'answer_incomplete',
  'answer_wrong',
  'outdated_info',
  'jurisdiction_mismatch',
  'helpful',
  'excellent'
);

-- §3 New table: answer_feedback (REQ-RLHF-001, REQ-RLHF-004)
CREATE TABLE answer_feedback (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating       feedback_rating NOT NULL,
  quality_tags quality_tag[] NOT NULL DEFAULT '{}'::quality_tag[],
  comment      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)  -- one feedback per user per message
);

CREATE INDEX idx_answer_feedback_message ON answer_feedback(message_id);
CREATE INDEX idx_answer_feedback_created ON answer_feedback(created_at);

-- RLS: users see only their org's feedback
ALTER TABLE answer_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY answer_feedback_org_isolation ON answer_feedback
  USING (EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.user_id = answer_feedback.user_id
      AND om.org_id = (SELECT org_id FROM messages WHERE id = answer_feedback.message_id)
  ));

-- §4 Extend audit_action enum (+3, REQ-RLHF-013)
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'feedback_submitted';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'reranking_applied';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'reranking_rolled_back';

-- §5 Extend source_sections (REQ-RLHF-009)
ALTER TABLE source_sections
  ADD COLUMN feedback_score numeric DEFAULT 0;

-- NOTE: message.feedback (audit_action) already exists in enum (verified 2026-06-25)
-- and will be reused for REQ-RLHF-004 where appropriate.
```

### Post-migration count deltas
| Metric | Before | After | Δ |
|---|---|---|---|
| Latest migration | 0081 | **0082** | +1 |
| `audit_action` enum | 191 | **194** | +3 (`feedback_submitted`, `reranking_applied`, `reranking_rolled_back`) |
| `PermissionAction` type | 38 | **39** | +1 (`rlhf.feedback`) — added in Phase F, not migration |
| `source_sections` columns | existing | +1 | `feedback_score` |
| New tables | — | 1 | `answer_feedback` |
| New enums | — | 2 | `feedback_rating`, `quality_tag` |

**Test updates required** (non-negotiable, lock-step tests):
- `tests/unit/enterprise-migrations.test.ts:329` → `194`
- `tests/unit/enterprise-migrations.test.ts:385` → `194`

---

## §4 Reuse Map (per REQ)

| REQ | Reused module (exists) | New module | Reuse type |
|---|---|---|---|
| REQ-RLHF-001 | `pgTable` pattern (schema.ts) | `answerFeedback` table | pattern-reuse |
| REQ-RLHF-002 | `pgEnum` pattern | `qualityTagEnum` (8 values) | new enum, established pattern |
| REQ-RLHF-003 | `components/chat/AnswerBlock.tsx` (has `messageId`, `'use client'`) | `FeedbackControl` sub-component | extend existing |
| REQ-RLHF-004 | `lib/audit.ts` (`writeAudit`, action `message.feedback` already in enum) | POST route inserts + audits | reuse writeAudit |
| REQ-RLHF-005 | — | `lib/rlhf/feedback-aggregator.ts` | new (pure fn) |
| REQ-RLHF-006 | — | `lib/rlhf/feedback-aggregator.ts` (`detectDownwardTrend`) | new (pure fn) |
| REQ-RLHF-007 | `lib/knowledge-gap/github-issue.ts` (`createGitHubIssue`) + `detector.ts` | `lib/rlhf/gap-promo-bridge.ts` wraps | **wrap existing** |
| REQ-RLHF-008 | (none — #50 not implemented) | candidate-proposal interface only | **stub** |
| REQ-RLHF-009 | `sourceSections` table (schema.ts:706) | +1 column `feedbackScore` | extend existing |
| REQ-RLHF-010 | retrieval pipeline (locate via grep pre-RED) | `lib/rlhf/reranker.ts` + wiring | **wire into existing** |
| REQ-RLHF-011 | `lib/observability/langfuse.ts` (Langfuse SDK already wrapped) | `lib/rlhf/langfuse-emitter.ts` thin wrapper | **wrap existing** |
| REQ-RLHF-012 | — | heatmap route + page | new |
| REQ-RLHF-013 | `lib/model-governance/rlhf-gate.ts` (`submitRlhfProposal`) + `rollback.ts` (`rollbackCombination`) + `audit-metadata.ts` (`buildAnswerVersionMetadata`) | `lib/rlhf/version-tracker.ts` orchestrator | **compose 3 existing** |
| REQ-RLHF-014 | `lib/model-governance/eval-gate.ts` (`checkEvalThreshold`, `evalGatePassed`) | `verifyPostRerankInvariants` | **reuse gates** |
| REQ-RLHF-015 [HARD] | existing `submitRlhfProposal` already blocks auto-confirm (`approval_status='pending_review'`, `eval_status='pending'`) | — no new code, add assertion test | **gate already correct** |

---

## §5 AC → Phase Mapping

| AC# | Phase(s) | Satisfied by |
|---|---|---|
| AC-01 | F1, F3 | POST route + FeedbackControl component |
| AC-02 | A1 | qualityTagEnum 8-value + API zod validation |
| AC-03 | D1 | `createGapIssueForLowRatedAnswer` wraps `createGitHubIssue` |
| AC-04 | D2 | `proposePromotionCandidateForHighRatedAnswer` returns candidate only; auto-confirm blocked by assertion test |
| AC-05 | C1 + G1 | reranker logic + wiring into retrieval |
| AC-06 | A2 + C2 | audit_action enum extension + version-tracker wrapping existing gate |
| AC-07 | C3 + G1 | `verifyPostRerankInvariants` + wiring into every rerank path |
| AC-08 | E1 + F2 | Langfuse emitter + heatmap route |

---

## §6 Dead-Code Risk Flags (recurring defect class — 5 prior PRs)

Based on the recurring dead-code defect class in Regula (import-but-not-called, gate wired to only some paths, called with empty `[]`, source-grep instead of behavior), flag highest-risk REQs.

### Risk Tier 1 (CRITICAL — add explicit anti-dead-code test)

| REQ | Risk pattern | Mitigation test |
|---|---|---|
| **REQ-RLHF-010** (retrieval re-ranking wired) | "applyReranking defined but never called from retrieval path" — exactly the import-but-not-called pattern that has bitten 3 prior PRs | Integration test (Phase G1) that inserts a feedback row, runs actual retrieval, asserts the returned ordering differs from baseline. **A unit test on `applyReranking` alone does NOT satisfy this REQ.** |
| **REQ-RLHF-014** (post-rerank gate on every path) | "`verifyPostRerankInvariants` called from the happy path but skipped on the cached path / the streaming path / the fallback path" — the gate-wired-to-only-some-paths pattern | Integration test that exercises every retrieval entrypoint (grep all `retrieval` callers) and asserts the gate fires. List the entrypoints in the test as a `entryPoints: string[]` literal so missing ones fail loudly. |
| **REQ-RLHF-007** (low-rated → gap issue) | "`createGapIssueForLowRatedAnswer` called with empty qualityTags or with the wrong GapIssueContext shape, producing an empty GitHub issue body" — the called-with-empty-`[]` pattern | Test that injects a realistic low-rated feedback and asserts the created issue body contains the actual message text + at least one qualityTag. |
| **REQ-RLHF-013** (version metadata recorded on every rerank) | "version-tracker.recordReranking imported but the retrieval pipeline bypasses it for performance" | Test that exercises the full reranking flow and asserts a `change_request` audit row with `source: 'rlhf'` exists afterward. |

### Risk Tier 2 (MEDIUM — add characterization test)

| REQ | Risk pattern |
|---|---|
| **REQ-RLHF-005/006** (aggregation) | aggregation computed but never read by any consumer (heatmap or dashboard). Mitigation: wire into `/api/rlhf/heatmap` in Phase F2 and assert non-empty response. |
| **REQ-RLHF-011** (Langfuse emit) | "emitter imported but only called in non-error path; error-path feedback silently dropped." Mitigation: test that emits after a simulated DB error still reaches Langfuse. |
| **REQ-RLHF-015** [HARD] | "auto-confirm gate accidentally bypassed by a future PR that calls `submitRlhfProposal` with `approval_status='approved'`." Mitigation: assertion test that the high-rated → promo path produces zero rows in `change_request` with non-pending status. |

### Risk Tier 3 (LOW — standard coverage)

REQ-RLHF-001, 002, 003, 004, 008, 009, 012 — straightforward CRUD/UI, covered by normal unit tests.

**Top dead-code-risk REQs to actively defend**: **REQ-RLHF-010, REQ-RLHF-014, REQ-RLHF-007, REQ-RLHF-013** (Tier 1).

---

## §7 Follow-up Issue Draft (excluded scope, Issue #56 comment)

**Recommendation**: Open as **follow-up issue #N (assign after #56 merges)**, not as a blocker to #56. These are the 3 extra requirements from the Issue #56 comment that are explicitly **excluded** from SPEC-REGULA-RLHF-001 v1.0.0.

```markdown
**Title**: [RLHF-v2] qualityTags expansion + confidence calibration + alternate-answer feedback

**Source**: Issue #56 comment (extra requirements), deferred during SPEC-REGULA-RLHF-001 planning.

**Scope** (3 items):
1. **qualityTags expansion (+4)**: add `citation_coverage_low`, `source_recency_stale`,
   `source_authority_weak`, `source_agreement_conflict` to the `quality_tag` enum
   (brings total from 8 → 12). Requires migration `00NN_rlhf_v2_quality_tags.sql`
   + zod schema update + UI tag-chip grid update.
2. **Confidence calibration retraining**: when sufficient feedback accumulates,
   retrain the confidence calibration layer (requires a calibration job, eval gate,
   and rollback). Depends on #50 KNOWLEDGE-PROMO landing first.
3. **Alternate answers implicit feedback**: when a user asks a follow-up after a
   low-rated answer, treat it as implicit negative feedback on the prior answer.
   Requires a conversation-state tracker.

**Depends on**: SPEC-REGULA-RLHF-001 (#56) merge, SPEC-REGULA-KNOWLEDGE-PROMO-001 (#50) merge.

**Why deferred**: keeps #56 to a reviewable size; the 3 items each touch a
different layer (enum/DB, ML pipeline, conversation tracking) and mixing them
with the v1 loop would inflate the PR beyond the 5-PR pipeline session pattern.
```

---

## §8 Open Questions for Approval

1. **Migration numbering**: confirmed `0082_rlhf.sql` (0081 is the latest, verified). ✓
2. **`rlhf.feedback` permission**: new `PermissionAction` value, granted to `ra-lead` and `ra-member` (not `viewer`). Confirm RBAC matrix — planned to add in `lib/auth/rbac.ts` during Phase F1.
3. **Langfuse event schema**: the wrapper will send `{messageId, userId, rating, qualityTags, comment}`. Confirm this matches the Langfuse team's expected event shape (no upstream contract found in `lib/observability/langfuse.ts` beyond the SDK wrapper).
4. **Heatmap dashboard route gate**: `app/(app)/quality/heatmap/page.tsx` — confirm `audit.read` or a new `quality.view` permission. Planned: `audit.read` (already exists, no PermissionAction delta).

---

## §9 Completion Criteria (per phase)

- Phase A: migration applies cleanly on fresh DB; lock-step tests green at 194; AC-02 green.
- Phase B: aggregator/trend unit tests green; AC-08 dependency satisfied.
- Phase C: reranker + version-tracker + post-rerank gate unit tests green; AC-05/06/07 unit portion.
- Phase D: gap/promo bridges green; AC-03/04 green; **REQ-RLHF-015 assertion test green**.
- Phase E: Langfuse emitter test green (including unavailable-SDK graceful path).
- Phase F: API routes + UI tests green; AC-01/08 green.
- Phase G: integration test green; **all Tier-1 dead-code-risk tests green**; AC-05/07 end-to-end.
- Final: full `pnpm test` green, `pnpm lint` (lint:hex) clean, no `#NNN` code-line refs (L-008), staged scope verified (L-009).
