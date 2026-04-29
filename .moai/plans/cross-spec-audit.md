---
audit_id: AUDIT-REGULA-CROSS-001
target: SPEC-REGULA-CHAT-001 + STRUCTURED-001 + BREADTH-001 + ENTERPRISE-001 + LAUNCH-001 (FOUNDATION-001 v0.3.0 reference)
auditor: plan-auditor
audit_date: 2026-04-22
stance: adversarial-independent
m1_context_isolation: Reasoning context from SPEC authors ignored per M1 Context Isolation. Audit rests solely on the 6 spec.md files (FOUNDATION + 5 Wave-1 SPECs), handoff README.md, and harness-gap-audit.md.
---

# Cross-SPEC Consistency Audit — Wave 1 산출물

## Executive Summary

- **Critical findings:** 7
- **High findings:** 9
- **Medium findings:** 8
- **Low findings:** 4
- **Total findings:** 28
- **Overall verdict:** REQUIRES_PATCH
- **Recommended action:** Block Phase 2 kickoff until Critical findings C1-C7 are patched in manager-spec iteration 2. High findings H1-H9 should be resolved before Phase 5 kickoff. Several findings indicate systemic drift between SPEC authors operating in parallel — the "Wave 1 동시 작성" coordination assumption in STRUCTURED-001 spec.md:357 and risk row "Wave 1 동시 작성 중 조정" (spec.md:384) reveal that contract interfaces were *assumed* rather than *verified*.

Rationale for adversarial verdict: Despite surface-level coherence (depends_on fields populated, handoff sections mapped), the 5 SPECs contain at least 7 concrete mismatches where Phase N declares an interface that Phase N+1 consumes *with different semantics*. Most dangerous: CHAT emits `expert_review_required` as a fire-and-forget SSE event (CHAT spec.md:499-501, REQ-CHAT-055) while ENTERPRISE treats this same event as the *trigger* for `enqueueExpertReview` DB insert (ENTERPRISE spec.md:184, REQ-ENTERPRISE-009) — **both SPECs claim ownership of the expert_reviews row insert**, creating a double-insert or missed-insert race hazard. Similarly, `audit_logs.action` is treated as a pgEnum by ENTERPRISE (spec.md:619 "pgEnum 확장") but as `text NOT NULL` by BREADTH (spec.md:773 "not pgEnum"), and FOUNDATION's original schema (REQ-FND-044) is ambiguous — the schema table lists `action` as `text NOT NULL` (FOUNDATION spec.md:559) yet REQ-FND-049 describes it as a TypeScript union type, leaving the DB-level representation undefined. This is a structural defect.

---

## Dependency Graph

```
SPEC-REGULA-FOUNDATION-001 (v0.3.0, Phase 1, 74 REQ-FND)
         │
         ├───► SPEC-REGULA-CHAT-001 (Phase 2, 60 REQ-CHAT)
         │         depends_on: [FOUNDATION-001]                    [OK]
         │         │
         │         ├───► SPEC-REGULA-STRUCTURED-001 (Phase 3, 37 REQ-STRUCT)
         │         │         depends_on: [FOUNDATION-001, CHAT-001]         [OK]
         │         │         │
         │         │         └───► SPEC-REGULA-BREADTH-001 (Phase 4, 57 REQ-BREADTH)
         │         │                   depends_on: [FOUNDATION-001, CHAT-001, STRUCTURED-001]  [OK]
         │         │                   │
         │         │                   └───► SPEC-REGULA-ENTERPRISE-001 (Phase 5, 73 REQ-ENTERPRISE)
         │         │                             depends_on: [FOUNDATION, CHAT, STRUCTURED, BREADTH]  [OK]
         │         │                             │
         │         │                             └───► SPEC-REGULA-LAUNCH-001 (Phase 6, 48 REQ-LAUNCH)
         │         │                                       depends_on: [all 5 prior SPECs]            [OK]
```

**Graph verdict:** The declared dependency edges are **syntactically consistent** — no cycles, no phantom references, ordering is monotonic (Phase N only depends on Phases 1..N-1). However, **semantic dependency** diverges from the declared graph (see C1, C2 below). STRUCTURED-001 claims "Wave 1 동시 작성" for CHAT (STRUCTURED spec.md:357), which means STRUCTURED's assumption of CHAT interfaces was made *in parallel*, not *after CHAT was finalized*. This parallel-authoring origin is the root cause of several Critical findings.

---

## Scope Boundary Table — Phase N Out-of-Scope ↔ Phase N+1 In-Scope

| Phase N item (Out of Scope) | Phase N SPEC evidence | Phase N+1 item (In Scope) | Phase N+1 SPEC evidence | Match? |
|---|---|---|---|---|
| CHAT: Checklist/ComparisonTable/Timeline rendering → Phase 3 | CHAT spec.md:96 | STRUCTURED: Checklist/ComparisonTable/Timeline components | STRUCTURED spec.md:62-64 | **OK** |
| CHAT: `checklist/comparison/timeline/related` SSE emission → Phase 3 | CHAT spec.md:98, 131-134 | STRUCTURED: 4 SSE event emission | STRUCTURED spec.md:60, REQ-STRUCT-002 (spec.md:132) | **OK** (well-defined reservation pattern) |
| CHAT: Expert review workflow UI + POST endpoint → Phase 5 | CHAT spec.md:103-105 | ENTERPRISE: POST /api/ra/expert-review | ENTERPRISE spec.md:61, REQ-ENTERPRISE-001 (spec.md:131) | **OK surface / FAIL semantic** (see C1) |
| CHAT: Auto gating *logic* → Phase 2 (confidence only), full logic → Phase 5 | CHAT spec.md:48 ("confidence 기반만") AND CHAT spec.md:499-501 (REQ-CHAT-055: event emission) | ENTERPRISE: shouldAutoFlag + enqueueExpertReview | ENTERPRISE REQ-ENTERPRISE-007, 009 (spec.md:170-184) | **FAIL** — C1 |
| CHAT: `expert_review.resolve` writeAudit → Phase 5 | CHAT spec.md:105 | ENTERPRISE: `expert_review.resolve` enum | ENTERPRISE REQ-ENTERPRISE-028 (spec.md:311) | **OK** |
| BREADTH: Expert review workflow API/UI → Phase 5 | BREADTH spec.md:96 | ENTERPRISE: POST/GET/PATCH expert-review | ENTERPRISE REQ-ENTERPRISE-001-015 | **OK** |
| BREADTH: RBAC 세분화 → Phase 5 | BREADTH spec.md:97 ("organization_id = currentUser.organization_id 필터만 하드 적용") | ENTERPRISE: RBAC + withPermission | ENTERPRISE REQ-ENTERPRISE-016-027 | **OK surface** / see C2 |
| BREADTH: Dark mode polish → Phase 5 | BREADTH spec.md:98 | ENTERPRISE: Dark mode runtime | ENTERPRISE REQ-ENTERPRISE-039-045 | **OK** |
| BREADTH: i18n runtime → Phase 5 | BREADTH spec.md:99 | ENTERPRISE: i18n runtime + next-intl | ENTERPRISE REQ-ENTERPRISE-046-055 | **OK** |
| BREADTH: Sentry / Langfuse / PostHog → Phase 5 | BREADTH spec.md:100 | ENTERPRISE: 4-way observability | ENTERPRISE REQ-ENTERPRISE-066-073 | **OK** |
| BREADTH: Playwright e2e → Phase 6 | BREADTH spec.md:108 | LAUNCH: 7 spec files | LAUNCH REQ-LAUNCH-013-022 | **OK** |
| BREADTH: LLM eval → Phase 6 | BREADTH spec.md:109 | LAUNCH: promptfoo + 55 scenarios | LAUNCH REQ-LAUNCH-001-012 | **OK** |
| ENTERPRISE: Full E2E → Phase 6 | ENTERPRISE spec.md:82 "Playwright E2E 전체 스위트" | LAUNCH: 7 E2E spec files | LAUNCH REQ-LAUNCH-015-021 | **OK surface / FAIL semantic** (see H1 — LAUNCH only has 7 core flows, ENTERPRISE expects "E2E 전체 스위트") |
| ENTERPRISE: Load testing → Phase 6 | ENTERPRISE spec.md:83 | LAUNCH: k6 steady+spike | LAUNCH REQ-LAUNCH-023-028 | **OK** |
| ENTERPRISE: VPAT 공식 문서 → Phase 6 | ENTERPRISE spec.md:84 | LAUNCH: **No VPAT REQ found** | — | **FAIL** — H2 |
| ENTERPRISE: Feature flag system → Phase 6 | ENTERPRISE spec.md:85 | LAUNCH: **No feature flag REQ found** | LAUNCH spec.md:405 only references "Feature flag kill switch via Vercel Flags API" in runbook rollback, no implementation REQ | **FAIL** — H3 |
| STRUCTURED: `checklist.toggle` audit → Phase 5 | STRUCTURED spec.md:85 | ENTERPRISE: **`checklist.toggle` not in enum** | ENTERPRISE REQ-ENTERPRISE-028 (spec.md:311) lists 10 new actions — `checklist.toggle` absent | **FAIL** — C3 |
| STRUCTURED: Multi-user shared chat + `checklist_completions` → Phase 5 | STRUCTURED spec.md:82 | ENTERPRISE: **No `checklist_completions` migration mentioned** | — | **FAIL** — M1 |
| STRUCTURED: i18n English structured blocks → Phase 5 | STRUCTURED spec.md:83 | ENTERPRISE: i18n locale dictionary only, no structured block LLM regeneration REQ | — | **FAIL** — H4 (semantic gap) |
| BREADTH: History page rendering of `message_blocks` | BREADTH spec.md:80, REQ-BREADTH-029 | STRUCTURED: Phase 4 will "read-only import" structured-schema | STRUCTURED spec.md:554 Phase 4 handoff | **OK** |
| BREADTH: Regulatory updates auto-generation → Phase 5 | BREADTH spec.md:104 | ENTERPRISE: **No REQ for auto-generation** | — | **FAIL** — M2 |
| BREADTH: Project delete (soft/hard) → Phase 5 | BREADTH spec.md:105, REQ-BREADTH-040 | ENTERPRISE: **No REQ for project delete implementation**; only `conversation.delete` in permission matrix (spec.md:254) | — | **FAIL** — H5 |
| BREADTH: User CRUD → Phase 5 | BREADTH spec.md:106 | ENTERPRISE: **No REQ for user CRUD endpoints**, only `rbac.manage` permission in matrix | — | **FAIL** — H6 |
| BREADTH: Onboarding DB persist → Phase 5 | BREADTH spec.md:107 | ENTERPRISE: **No `users.onboarded_at` migration or REQ** | — | **FAIL** — M3 |
| BREADTH: `audit_logs` materialized view → Phase 5 | BREADTH spec.md:110 | ENTERPRISE: **No MV REQ** | — | **FAIL** — M4 |
| BREADTH: `users.intent` column promotion → Phase 5+ | BREADTH spec.md:111 | ENTERPRISE: **No REQ** (spec.md:79 lists related items but intent column not addressed) | — | **Low** — L1 |

**Critical Boundary Defects Summary:**
- **C1**: Expert review auto-gating *trigger ownership* is split between CHAT REQ-CHAT-055 and ENTERPRISE REQ-ENTERPRISE-009 — both claim to insert into `expert_reviews`
- **C2**: BREADTH implements 10 API endpoints in Phase 4 with NO permission guard, then ENTERPRISE must wrap all of them in Phase 5 (REQ-ENTERPRISE-021) — this is a retrofit, not a clean handoff
- **C3**: STRUCTURED defers `checklist.toggle` to Phase 5 but ENTERPRISE's enum extension doesn't include it
- **H2/H3**: ENTERPRISE defers VPAT + Feature flags to LAUNCH, but LAUNCH has no REQ for either

---

## REQ ID / File Path Collision Table

REQ-ID prefix collisions: **None.** Each Phase uses a distinct prefix (`REQ-FND-`, `REQ-CHAT-`, `REQ-STRUCT-`, `REQ-BREADTH-`, `REQ-ENTERPRISE-`, `REQ-LAUNCH-`). **PASS** on prefix uniqueness.

### File Path Collisions (Shared Multi-Phase Files)

| File | Phase 1 (FND) | Phase 2 (CHAT) | Phase 3 (STRUCT) | Phase 4 (BREADTH) | Phase 5 (ENT) | Phase 6 (LAUNCH) | Collision Severity |
|---|---|---|---|---|---|---|---|
| `app/api/ra/consult/route.ts` | — | CREATE (REQ-CHAT-001) | MODIFY (STRUCT spec.md:451, "확장") | MODIFY (REQ-BREADTH-047, retrieval substep) | WRAP (REQ-ENTERPRISE-021, withPermission) | — | **HIGH** — 4 distinct modifications |
| `app/(app)/chat/page.tsx` | CREATE (REQ-FND-017) | REPLACE (CHAT spec.md:84) | MODIFY (implicit via AnswerBlock extension) | — | — | — | **MEDIUM** — 3-phase evolution |
| `lib/ai/streaming.ts` | — | CREATE (REQ-CHAT-011) | READ-ONLY (STRUCT spec.md:463) | — | — | — | **LOW** |
| `lib/audit.ts` | CREATE (REQ-FND-048) | USE (REQ-CHAT-053-056) | NO-OP (REQ-STRUCT-037) | MODIFY union type (REQ-BREADTH-057) | MODIFY enum (REQ-ENTERPRISE-028) | — | **HIGH** — C4 (see below) |
| `lib/env.ts` | CREATE (REQ-FND-010a) | MODIFY (CHAT spec.md:85, `ANTHROPIC_API_KEY`) | — | MODIFY (BREADTH external deps: S3 keys) | MODIFY (REQ-ENTERPRISE-071, observability keys) | MODIFY (LAUNCH REQ-LAUNCH-039 16 env vars) | **MEDIUM** — 5 phases modify |
| `app/(app)/page.tsx` (Home) | CREATE placeholder (REQ-FND-016) | — | — | EXPAND (REQ-BREADTH-001) | — | — | **LOW** |
| `components/chat/AnswerBlock.tsx` | — | CREATE (REQ-CHAT-039) | EXTEND (REQ-STRUCT-028) | — | MODIFY (add ExpertReviewCallout, REQ-ENTERPRISE-011 implicit) | — | **MEDIUM** |
| `components/chat/RightContextPanel.tsx` | — | — | CREATE (REQ-STRUCT-029) | REWIRE REAL DATA (BREADTH spec.md:84 "실데이터 연결", REQ-BREADTH-050) | — | — | **MEDIUM** — C5 (see below) |
| `app/layout.tsx` | CREATE (REQ-FND-011) | — | — | — | MODIFY (FOUT script REQ-ENTERPRISE-041 + `<Analytics />` REQ-ENTERPRISE-069) | — | **LOW** |
| `app/api/ra/sources/[id]/route.ts` | — | CREATE basic (CHAT spec.md:62) | — | EXPAND deep-link (REQ-BREADTH-031) | WRAP (REQ-ENTERPRISE-021) | — | **MEDIUM** |
| `stores/ui.ts` | — | — | — | EXTEND (REQ-BREADTH-054) | EXTEND theme + locale (REQ-ENTERPRISE-039, 049) | — | **MEDIUM** |
| `middleware.ts` | CREATE (REQ-FND-053) | — | — | — | — | — | **LOW** |
| `lib/db/schema.ts` | CREATE 13 tables (REQ-FND-031) | — | — | — | ALTER users.role, audit_logs.action, add users.notification_pref, add expert_reviews index (ENTERPRISE spec.md:686-689) | — | **HIGH** — C6 |
| `messages` table (schema) | `meta_json` column **NOT present** (FOUNDATION REQ-FND-036) | Uses `meta_json` (REQ-CHAT-028) | — | — | — | — | **CRITICAL** — C7 |
| `app/api/ra/messages/[messageId]/sources/route.ts` | — | — | CREATE (STRUCT spec.md:453, for RightContextPanel) | — | — | — | — |
| `app/api/ra/updates/route.ts` | — | — | CREATE (STRUCT spec.md:454, for RightContextPanel) | CREATE (REQ-BREADTH-034) | — | — | **CRITICAL** — C4 (duplicate ownership) |

---

## Schema Change Log (cross-Phase)

FOUNDATION v0.3.0 defines **13 tables** (FOUNDATION REQ-FND-031). The table below tracks every schema-impacting change across Phases 2-6.

| Phase | Migration file | Change | Relevant REQ | Compatibility with FOUNDATION |
|---|---|---|---|---|
| Phase 2 | `migrations/0002_chat_indexes.sql` | FTS GIN index + optional `message_meta` auxiliary table | CHAT spec.md:626, REQ-CHAT-028 note | **AMBIGUOUS** — CHAT spec.md:346 says "Phase 2 내부 구현 결정" / "message_meta" fallback; FOUNDATION's `messages.meta_json` field existence is unclear (see C7) |
| Phase 3 | NO migration | FOUNDATION untouched (STRUCT spec.md:516) | — | OK |
| Phase 4 | NO migration (BREADTH spec.md:118 "schema migration 없음") | `(created_at, action)` index via CREATE INDEX CONCURRENTLY in deploy script (BREADTH spec.md:816) | — | **BORDERLINE** — Index is a schema object but not via Drizzle migration; deployment script creates it |
| Phase 5 | `migrations/00XX_rbac.sql` | `user_role` pgEnum + migrate text → enum + add `users.notification_pref` (REQ-ENTERPRISE-016, 027) | ENTERPRISE spec.md:686 | OK (explicit migration pattern) |
| Phase 5 | (inline) | `audit_logs.action` enum extension with 10+ new values | ENTERPRISE REQ-ENTERPRISE-028 | **FAIL** — C6 (see below) |
| Phase 5 | `expert_reviews` index `(status, assigned_to)` | R9 risk mitigation | ENTERPRISE spec.md:689 | OK |
| Phase 6 | NO new migration (LAUNCH OOS) | — | — | OK |

### Critical Schema Defect — C6 (action column type ambiguity)

FOUNDATION REQ-FND-044 (spec.md:559) declares `audit_logs.action` as:
> `action | text | NOT NULL | — | — | REQ-FND-049 enum 참조`

and REQ-FND-049 (spec.md:705) defines `action` as a **TypeScript union type**, not a pgEnum.

BREADTH REQ-BREADTH-057 (spec.md:773) explicitly states:
> "FOUNDATION REQ-FND-044 stores `action` as `text NOT NULL`, not pgEnum"

ENTERPRISE REQ-ENTERPRISE-028 (spec.md:310-313) states:
> "The `AuditAction` type in `lib/audit.ts` SHALL be extended to include..." — TypeScript union extension only

ENTERPRISE R1 risk (spec.md:619) inconsistently states:
> "`audit_logs.action` pgEnum 확장이 기존 행에 영향 | Medium | Postgres `ALTER TYPE ... ADD VALUE` 사용"

This is an **internal contradiction within ENTERPRISE** — REQ-028 treats action as TS union (pure text column), but risk R1 treats it as pgEnum requiring `ALTER TYPE`. Either:
- (a) FOUNDATION's text column is correct, ENTERPRISE R1 is wrong (no ALTER TYPE needed, just TS compile-time check), OR
- (b) FOUNDATION should be pgEnum, and R1 is correct.

**Impact:** If (a), then there is NO database-level enforcement that application code only writes the 10+ allowed actions — any string could be INSERTed, violating the "enum discipline" the SPECs assume. If (b), then BREADTH's claim "No DB migration required" (REQ-BREADTH-057) is wrong, because every new action value requires `ALTER TYPE ... ADD VALUE`.

### Critical Schema Defect — C7 (`messages.meta_json` existence)

FOUNDATION REQ-FND-036 (spec.md:419-433) defines the `messages` table columns and **does NOT include a `meta_json` column**. The listed columns are: `id, conversation_id, role, content_prose, confidence_level, confidence_score, duration_ms, expert_review_required, tokens_in, tokens_out, model, created_at`.

CHAT REQ-CHAT-028 (spec.md:342) states:
> "The `violations` array SHALL be stored in `messages.meta_json` field (requires REQ-FND-036 `meta_json` compatibility — Phase 2는 existing jsonb column 재사용)"

and CHAT spec.md:346 acknowledges:
> "**스키마 주석 (non-normative):** REQ-FND-036의 `messages` 스키마에 `meta_json` 컬럼이 존재하지 않을 경우, Phase 2는 별도의 보조 테이블 `message_meta (message_id pk, json jsonb)`를 신규 마이그레이션 `0002_chat_indexes.sql`에 포함..."

CHAT is **aware of the ambiguity** but punts the decision to "RUN 단계에서 확인". This is a deferred scope-boundary defect that will cause Phase 2 implementation to either modify FOUNDATION (violating CHAT spec.md:636 "FOUNDATION 미수정 원칙") or create a parallel table. **Both options are unauthorized architectural changes that should be resolved at SPEC time, not at implementation time.**

### Schema Changes FOUNDATION Declared vs. Enterprise Modifies

| Column/Object | FOUNDATION Declaration | ENTERPRISE Change | Consistency |
|---|---|---|---|
| `users.role` | text NOT NULL default `'member'` (REQ-FND-032) | ALTER to pgEnum `user_role` + default `'ra-member'` (REQ-ENTERPRISE-016) | **OK** (explicit migration) but value `'member'` → `'ra-member'` migration must handle existing rows |
| `users.locale` | pgEnum ko/en, default 'ko' (REQ-FND-032) | PATCH /api/ra/profile writes this (REQ-ENTERPRISE-049) | OK |
| `users.theme_pref` | pgEnum light/dark/system (REQ-FND-032) | PATCH /api/ra/profile writes this (REQ-ENTERPRISE-043) | OK |
| `users.notification_pref` | **NOT in FOUNDATION** | ADD column (REQ-ENTERPRISE-027) | OK (new column, migration required) |
| `audit_logs.action` | text NOT NULL, TS union extensibility (REQ-FND-049) | See C6 contradiction | **FAIL** |
| `expert_reviews` schema | Exists with 8 columns (REQ-FND-043) | Adds index `(status, assigned_to)` (ENTERPRISE spec.md:689) | OK |
| `message_blocks.block_type` | 6 values enum (REQ-FND-038) | STRUCTURED uses all 6 (STRUCT REQ-STRUCT-034) | OK |
| `source_sections` anchor UNIQUE | UNIQUE(source_id, anchor) (REQ-FND-044c) | BREADTH uses for deep-link (REQ-BREADTH-031) | OK |

---

## Non-Obvious Constraints 종합 매트릭스

The CLAUDE.md project instructions enumerate **7 Non-Obvious Product Constraints**. This table traces each constraint across all 5 Wave-1 SPECs.

| # | Constraint | FND Phase 1 | CHAT Phase 2 | STRUCT Phase 3 | BREADTH Phase 4 | ENTERPRISE Phase 5 | LAUNCH Phase 6 | Completion Phase | Gap? |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Citation 100% 강제 (inline `<sup>`) | Schema `cite_index` (REQ-FND-037) | **Enforcement** (REQ-CHAT-021-030) | REQ-STRUCT-018 excludes structured blocks | History rendering (REQ-BREADTH-029) | **No REQ found** | REQ-LAUNCH-006 (scorer verifies coverage=100%) | **Phase 2** (re-verified Phase 6) | OK |
| 2 | SSE 3-phase streaming (trace→prose→structured) | N/A Phase 1 | **Group A+E** (REQ-CHAT-001-010, REQ-CHAT-046-052) | Phase C emission (REQ-STRUCT-002, 007) | projectId snapshot only (REQ-BREADTH-052) | expert_review_required event insertion (REQ-ENTERPRISE-009) | REQ-LAUNCH-016 E2E SSE 7종 | **Phase 3** (structured emission) | OK |
| 3 | Expert-review 자동 게이팅 | Schema (REQ-FND-043) | **Event emit** (REQ-CHAT-029, 055) | Callout render (REQ-STRUCT-028) | History flag display (BREADTH spec.md:96) | **Full logic + enqueue + API** (REQ-ENTERPRISE-007-009) | E2E + scorer (REQ-LAUNCH-008, 018) | **Phase 5** | **C1 DEFECT** — CHAT and ENTERPRISE both claim enqueue ownership |
| 4 | 21 CFR Part 11 audit 7년 | **Trigger + REVOKE + role sep** (REQ-FND-046-047c) | `llm.call` / `source.access` / `expert_review.flag` call-sites (REQ-CHAT-053-056) | NO-OP (REQ-STRUCT-037) | +10 new actions (REQ-BREADTH-057) | +10 new actions (REQ-ENTERPRISE-028) + static analysis (REQ-ENTERPRISE-032) | Retention test (REQ-LAUNCH-030, 031) | **Phase 1 base + Phase 5 completeness** | **C6 DEFECT** (enum vs text) + **H7 DEFECT** (BREADTH and ENTERPRISE propose non-overlapping but potentially colliding enum extensions) |
| 5 | Serif/sans 타이포 5 contexts | REQ-FND-023 (font-serif order) | Section labels serif (REQ-CHAT-039 step 3, 5) | AnswerBlock section labels (STRUCT spec.md:607) | Hero serif (REQ-BREADTH-002), stat card serif (REQ-BREADTH-023) | Dark mode preservation (REQ-ENTERPRISE-044) | REQ-LAUNCH-021 extension (axe custom check) | Phase 1 + Phase 5 dark | OK |
| 6 | Korean+English first-class (i18n) | REQ-FND-012 `<html lang="ko">`, REQ-FND-019 Korean labels | `locale` field passed (REQ-CHAT-003), Korean system prompt | ko hardcoded (STRUCT REQ-STRUCT-004) | ko hardcoded (BREADTH spec.md:1031) | **Full runtime** (REQ-ENTERPRISE-046-055) | E2E ko↔en (REQ-LAUNCH-020) | **Phase 5** | OK |
| 7 | Auth 뒤 noindex / /login 제외 | **Full** (REQ-FND-014, 018, 056) | No change | No change | No change | `/expert-review` inherits default (ENTERPRISE spec.md:678, 642) | E2E (REQ-LAUNCH-015, 043) | **Phase 1** | OK |

**Constraint coverage verdict:** All 7 constraints have an ownership chain. **Constraints 3 and 4 contain Critical cross-SPEC defects** (see C1, C6). All others are coherent.

---

## Findings (Critical / High / Medium / Low)

### CRITICAL (C1-C7)

#### C1 — Expert-review enqueue ownership collision between CHAT and ENTERPRISE
**Severity:** Critical
**Evidence:**
- CHAT REQ-CHAT-055 (spec.md:498-501): "WHEN the system emits an `expert_review_required` event (confidence < 0.7 OR citation coverage < 80% OR policy keyword match), THEN the system SHALL call `writeAudit({ action: 'expert_review.flag', ... })`"
- CHAT spec.md:106: "Expert review `status` 전이 ... → Phase 5" — transition ownership is clear
- BUT CHAT does NOT say whether it inserts into `expert_reviews`. CHAT Non-Obvious Constraints table row 3 (spec.md:651) says: "Expert-review 자동 플래그 → 로직 구현 → REQ-CHAT-029, REQ-CHAT-055"
- CHAT spec.md:104: "`POST /api/ra/expert-review` 엔드포인트 → Phase 5 | `expert_review_required` 자동 발행만 Phase 2, 수동 제출은 Phase 5" — this only excludes the API endpoint, NOT the DB insert
- ENTERPRISE REQ-ENTERPRISE-009 (spec.md:184): "WHEN `lib/ai/consult.ts` Phase C computes confidence AND `shouldAutoFlag()` returns `{ flag: true, ... }`, THEN the generator SHALL yield an SSE event `{ type: 'expert_review_required', reason: string }` before the `done` event, AND call `writeAudit({ action: 'consult.expert_review_auto_flag', ... })` AND call `enqueueExpertReview({ conversationId, messageId, reason, requestedBy: 'system' })` which inserts into `expert_reviews`."
- ENTERPRISE REQ-ENTERPRISE-010 (spec.md:189): "WHEN `shouldAutoFlag()` fires, the system SHALL also set `messages.expert_review_required = true`"

**Problem:** CHAT emits the SSE event AND writes audit, but does NOT insert a row into `expert_reviews`. ENTERPRISE expects to insert into `expert_reviews` via `enqueueExpertReview` — AND also writes its own audit action `consult.expert_review_auto_flag` which is a **new enum value not in FOUNDATION REQ-FND-049 nor in BREADTH REQ-BREADTH-057 nor in ENTERPRISE REQ-ENTERPRISE-028's declared list**. Furthermore, ENTERPRISE REQ-ENTERPRISE-009 modifies `lib/ai/consult.ts` which is Phase 2's file — this is a retroactive modification of a Phase 2 deliverable.

Concrete hazards:
- Phase 2 runs: SSE event emitted, `audit_logs(action='expert_review.flag')` inserted, **no expert_reviews row**. A user visiting history would see `messages.expert_review_required=false` (since CHAT doesn't set it) and `expert_reviews` empty. Until Phase 5 ships, the flagged condition is lost.
- Phase 5 adds `enqueueExpertReview` call + `consult.expert_review_auto_flag` audit action — but action enum extension is in REQ-028 which does NOT include `consult.expert_review_auto_flag`. So REQ-009 references an action not declared in REQ-028.

**Fix requirement:** Either (a) CHAT inserts into `expert_reviews` with `requested_by=SYSTEM_USER_UUID` at Phase 2 (moves ownership earlier), or (b) ENTERPRISE explicitly states it modifies CHAT's `consult.ts` as scope-in and CHAT documents this with a forward reference + ENTERPRISE REQ-028 includes `consult.expert_review_auto_flag`. Current SPECs contradict.

#### C2 — BREADTH's 10 new Phase-4 APIs have NO permission guard, requiring retrofit in Phase 5
**Severity:** Critical
**Evidence:**
- BREADTH spec.md:97: "organization_id = currentUser.organization_id 필터만 하드 적용"
- BREADTH REQ-BREADTH-029 (spec.md:414): "403 IF `conversation.user_id !== session.user.id` AND user is not organization admin (Phase 5 확장)"
- ENTERPRISE REQ-ENTERPRISE-021 (spec.md:270-272): "All existing Route Handlers from CHAT-001, STRUCTURED-001, and BREADTH-001 SHALL be updated to wrap their handler exports with `withPermission(<action>)`."
- ENTERPRISE R2 risk (spec.md:620): "RBAC 도입이 Phase 4 BREADTH Route Handler 전부 수정 → 회귀 위험 | High"

**Problem:** ENTERPRISE itself flags this as High risk. All 10 BREADTH API endpoints must be modified in Phase 5. BREADTH's assertion at spec.md:116-126 "본 Phase는 기존 Phase 산출물을 **수정하지 않는다**" is violated in reverse — Phase 5 WILL modify Phase 4. The architectural decision to push permission guards to Phase 5 creates:
- 10 retroactive PRs each touching `app/api/ra/*/route.ts`
- Pre-Phase-5 deployment window where Phase 4 is live with **no permission guards** (only org_id filter) — this is a production security gap if Phase 4 ships to any environment before Phase 5 is complete
- The ENTERPRISE BREADTH→ENTERPRISE interface contract at ENTERPRISE spec.md:722-727 declares 6+ BREADTH endpoints to be wrapped; this implies 6+ regression risks

**Fix requirement:** Either (a) BREADTH SPEC requires a minimal `withPermission()` placeholder in Phase 4 (even if just role-based not scope-based), or (b) production deployment is blocked until Phase 5 is complete (LAUNCH SPEC should enforce this, but it does not — see H1).

#### C3 — STRUCTURED's `checklist.toggle` audit action deferred to Phase 5 is NOT in ENTERPRISE's enum extension
**Severity:** Critical
**Evidence:**
- STRUCTURED spec.md:85: "`checklist.toggle` audit action enum 추가 및 writeAudit call-site → Phase 5 | FOUNDATION `action` enum은 Phase 5에서 새 값 추가 (REQ-FND-049a)"
- STRUCTURED REQ-STRUCT-037 (spec.md:343): "The Phase 3 implementation SHALL NOT invoke `writeAudit(...)` for checklist toggle events"
- ENTERPRISE REQ-ENTERPRISE-028 (spec.md:311) lists exactly: `'auth.login'`, `'auth.logout'`, `'auth.mfa_fail'`, `'session.invalidate'`, `'expert_review.create'`, `'expert_review.assign'`, `'expert_review.resolve'`, `'rbac.permission_deny'`, `'profile.theme_update'`, `'profile.locale_update'`
- **`checklist.toggle` is ABSENT from this list.**

**Problem:** STRUCTURED explicitly defers this to Phase 5 (ENTERPRISE), but ENTERPRISE does not add it. This means:
- In Phase 5, a user checks a checklist item, and there is no audit record — violating the 21 CFR Part 11 completeness invariant
- ENTERPRISE REQ-ENTERPRISE-032 (audit-completeness.ts) would scan Phase 3's PATCH `/api/ra/messages/:messageId/blocks/:blockId` endpoint (STRUCT REQ-STRUCT-021) and flag it as "handler without writeAudit" (this endpoint is PATCH, covered by REQ-ENTERPRISE-032's scope)
- Either `checklist.toggle` must be added to REQ-028, or REQ-STRUCT-037 must permit Phase 3 to add it immediately

**Fix requirement:** Add `'checklist.toggle'` to ENTERPRISE REQ-ENTERPRISE-028's enum list, and add a REQ stating "WHEN checklist item is toggled via PATCH, THEN writeAudit is invoked".

#### C4 — `app/api/ra/updates/route.ts` has duplicate ownership between STRUCTURED and BREADTH
**Severity:** Critical
**Evidence:**
- STRUCTURED spec.md:454 Deliverables table: "`app/api/ra/updates/route.ts` (GET with `relatedTo` filter)" owned by regula-backend, related to §7.4, §7.8
- STRUCTURED REQ-STRUCT-032 (spec.md:314): "`GET /api/ra/updates?relatedTo={projectId}&limit=3`"
- BREADTH spec.md:80 API routes: "`app/api/ra/updates/route.ts` (GET feed, §11.7)"
- BREADTH REQ-BREADTH-034 (spec.md:463-478): "`GET /api/ra/updates` SHALL return a personalized feed... SELECT ru.* FROM regulatory_updates ru WHERE EXISTS..."
- BREADTH Deliverables #17 (spec.md:909): "`app/api/ra/updates/route.ts` | 신규 | regula-backend"

**Problem:** Both SPECs declare `GET /api/ra/updates` as a NEW file. STRUCTURED Phase 3 creates it (to power RightContextPanel "관련 규제 업데이트" section with `relatedTo` filter). BREADTH Phase 4 lists it as **new (not modify)**, implying recreation. Two different query semantics:
- STRUCTURED REQ-STRUCT-032: `relatedTo=projectId&limit=3` (specific filter)
- BREADTH REQ-BREADTH-034: personalization via `projects.target_markets && ru.affected_product_types` SQL array overlap, plus `cursor`/`limit` pagination

**Fix requirement:** One SPEC must mark this file as "modify" (the second one). Current declarations imply the Phase 4 file replaces the Phase 3 file or there is merge collision. Most logical: STRUCTURED creates minimal endpoint covering `?relatedTo=...`, BREADTH extends it with cursor pagination and personalization. BREADTH Deliverable should read "수정 (Phase 3 확장)" not "신규".

#### C5 — `components/chat/RightContextPanel.tsx` is CREATED by STRUCTURED but STRUCTURED requires data from APIs that are explicitly Phase 4 scope
**Severity:** Critical
**Evidence:**
- STRUCTURED REQ-STRUCT-029 (spec.md:297-300): Creates `RightContextPanel.tsx` with 3 sections
- STRUCTURED REQ-STRUCT-031 (spec.md:307-311): Section "활용 출처" calls `GET /api/ra/messages/:messageId/sources?limit=5` — STRUCTURED creates this endpoint (spec.md:453)
- STRUCTURED REQ-STRUCT-032 (spec.md:313-316): Section "관련 규제 업데이트" calls `GET /api/ra/updates?relatedTo={projectId}&limit=3`
- STRUCTURED REQ-STRUCT-030 (spec.md:303): "IF `currentProjectId` is non-null, THEN the panel SHALL render a colored card with... project name + meta line"
- BUT: STRUCTURED does NOT create `GET /api/ra/projects/:id` or `GET /api/ra/projects` — this is BREADTH REQ-BREADTH-036-039 (spec.md:497-531)
- STRUCTURED spec.md:306: "Vitest에서 mock project 데이터 주입 → 카드 DOM 확인" — tests only mock the project, no real API declared
- BREADTH spec.md:84: "`components/chat/RightContextPanel.tsx` **실데이터 연결** (현재 프로젝트 + 활용 출처 top 5 + 관련 규제 업데이트 3개 TanStack Query 연동)"

**Problem:** STRUCTURED creates the component but cannot fully wire it. The "현재 프로젝트" section in REQ-STRUCT-030 requires `GET /api/ra/projects/:id` which only exists in Phase 4. STRUCTURED would have to:
- Mock the project data in Phase 3 (tests only), leaving production UI broken in Phase 3 — or —
- Create a stub endpoint in Phase 3 (out-of-scope per STRUCTURED)

Additionally, BREADTH REQ-BREADTH-050 (spec.md:658-664) re-specifies the "현재 프로젝트" section rendering in detail, implying BREADTH rewrites this section of RightContextPanel. BREADTH list of unchanged files includes "componets/chat/AnswerBlock.tsx ... 컴포넌트 (Phase 3) — 재사용만" (spec.md:124) but does NOT list RightContextPanel as unchanged — BREADTH modifies it (spec.md:84 "실데이터 연결", REQ-BREADTH-050).

**Fix requirement:** Either (a) move RightContextPanel creation to Phase 4 (where all 3 APIs exist), leaving STRUCTURED to only define schema interfaces; or (b) STRUCTURED creates a "skeleton" version with 3 sections but "현재 프로젝트" renders as placeholder until Phase 4 wiring, which STRUCTURED REQ-STRUCT-030 does not currently specify as placeholder-only.

#### C6 — `audit_logs.action` database column type — pgEnum vs. text — is internally contradictory
(Documented above in "Schema Change Log / Critical Schema Defect — C6")

#### C7 — `messages.meta_json` column existence is unresolved across FOUNDATION and CHAT
(Documented above in "Schema Change Log / Critical Schema Defect — C7")

---

### HIGH (H1-H9)

#### H1 — LAUNCH does not implement "E2E 전체 스위트" that ENTERPRISE defers to it
**Severity:** High
**Evidence:**
- ENTERPRISE spec.md:82 Out of Scope: "Playwright E2E 전체 스위트 → Phase 6 | 본 SPEC은 a11y smoke test만 포함, 핵심 플로우 E2E는 Phase 6"
- LAUNCH REQ-LAUNCH-015 through REQ-LAUNCH-021 define **7 E2E spec files only**: `auth`, `consultation`, `citation-click`, `expert-review`, `project-switch`, `i18n`, `a11y`
- NOT covered: History view scrolling + filter + search (BREADTH REQ-BREADTH-008-012), Templates page download (REQ-BREADTH-013-014), Knowledge Base grouping (REQ-BREADTH-015-017), Regulatory Updates personalization and impact analysis modal (REQ-BREADTH-018-021), Dashboard 4 stat cards + period toggle + distribution chart (REQ-BREADTH-022-027), Onboarding 4-step modal (REQ-BREADTH-007), Project CRUD (REQ-BREADTH-036-039), RBAC role denial UI flows (ENTERPRISE REQ-ENTERPRISE-025), Theme toggle + dark mode FOUT (ENTERPRISE REQ-ENTERPRISE-039-041), Audit completeness visual in admin UI, many more

**Problem:** "E2E 전체" in ENTERPRISE is treated by LAUNCH as "7 core flows". This is a substantial scope gap. Full coverage would require 15-20 spec files minimum.

**Fix requirement:** Either expand LAUNCH's E2E REQ-LAUNCH-015-021 to cover all handoff §7 views + all cross-phase flows, or ENTERPRISE should narrow its Out-of-Scope language from "전체 스위트" to "커버리지 확장".

#### H2 — VPAT is deferred to Phase 6 by ENTERPRISE but LAUNCH has no VPAT REQ
**Severity:** High
**Evidence:**
- ENTERPRISE spec.md:84: "VPAT 공식 문서 → Phase 6 | 본 SPEC은 감사 기반 상태 확보까지, 공식 문서화는 Phase 6"
- LAUNCH does not contain REQ-LAUNCH-### for VPAT. Searching LAUNCH spec.md: the string "VPAT" appears only in LAUNCH spec.md:47 ("VPAT 작성" in the group list) and LAUNCH spec.md:655 ("VPAT 초안 작성") as a Phase 6 handoff point — but no REQ enforces it

**Problem:** Phase 5 Out-of-Scope boundary claims Phase 6 will cover it, but Phase 6 has no REQ. This is a broken cross-Phase contract.

**Fix requirement:** Add REQ-LAUNCH-049 (or similar) for VPAT draft authoring, under Group F (Documentation).

#### H3 — Feature flag system is deferred to Phase 6 by ENTERPRISE but LAUNCH has no feature flag REQ
**Severity:** High
**Evidence:**
- ENTERPRISE spec.md:85: "Feature flag 시스템 (Statsig / Vercel Flags) → Phase 6 | handoff §18 "gradual rollout" — production release 전 도입"
- LAUNCH REQ-LAUNCH-042 (runbook rollback step 3): "Feature flag kill switch via Vercel Flags API" — referenced but not implemented
- LAUNCH does not have a REQ for feature flag vendor selection, flag creation, or gradual rollout configuration

**Problem:** Same pattern as H2. ENTERPRISE promises Phase 6 will handle feature flags, LAUNCH only references them in a rollback step.

**Fix requirement:** Add REQ-LAUNCH-### for feature flag system installation + at least 1 flag for expert review rollout.

#### H4 — ENTERPRISE i18n does not regenerate historical structured blocks, but STRUCTURED defers "en structured blocks" to Phase 5
**Severity:** High
**Evidence:**
- STRUCTURED spec.md:83: "i18n: English structured 블록 생성 + 기존 ko 블록 번역 → Phase 5 | Phase 3는 `locale: 'ko'` 하드코딩"
- ENTERPRISE REQ-ENTERPRISE-051 (spec.md:438-440): "WHEN the user submits a consult question via Composer, THEN the `ConsultRequest.locale` field SHALL be set to the current `useUIStore.getState().locale` value"
- ENTERPRISE REQ-ENTERPRISE-052 (spec.md:443): "Existing LLM-generated messages (prose text) SHALL NOT be retranslated when the UI locale changes. The `messages.content_prose` column stores the original language of generation."

**Problem:** ENTERPRISE explicitly says it will NOT retranslate historical prose, but STRUCTURED's Out of Scope says "기존 ko 블록 번역 → Phase 5". These contradict. Either:
- (a) Historical prose is NEVER retranslated — ENTERPRISE is correct and STRUCTURED's Phase 5 claim is wrong
- (b) Historical prose IS retranslated in Phase 5 — ENTERPRISE REQ-052 is wrong

Also: ENTERPRISE addresses "English structured 블록 생성" implicitly via REQ-ENTERPRISE-051's locale branch, but `buildSystemPrompt(locale)` is only for new queries. No REQ for generating structured blocks in English, which STRUCTURED defers here.

**Fix requirement:** Either STRUCTURED updates its Out-of-Scope to match ENTERPRISE's actual approach, or ENTERPRISE adds a REQ stating structured block generation also branches on locale.

#### H5 — Project delete implementation deferred to Phase 5 but ENTERPRISE has no project delete REQ
**Severity:** High
**Evidence:**
- BREADTH spec.md:105: "Project deletion (soft or hard) → Phase 5 | 감사 이슈 회피 위해 Phase 4는 create/update만. delete는 Phase 5에서 soft delete 컬럼 도입과 함께"
- BREADTH REQ-BREADTH-040 (spec.md:537-540): "DELETE on `/api/ra/projects/[id]` returns 405 Method Not Allowed"
- ENTERPRISE REQ-ENTERPRISE-020 (spec.md:250-263) permission matrix lists `project.manage` (ra-lead) and `rbac.manage` (admin) — but no `project.delete`
- ENTERPRISE does NOT add `projects.deleted_at` or `projects.status='archived'` (REQ-BREADTH-039 PATCH allows status='archived' but no Phase 5 promotes this to actual soft delete semantics with filtering)

**Problem:** BREADTH defers project delete with a scoped rationale ("soft delete column in Phase 5"), but ENTERPRISE does not add the column or the endpoint. Project delete remains broken through Phase 6.

**Fix requirement:** Either ENTERPRISE adds `projects.deleted_at` migration + DELETE endpoint, or BREADTH's Out-of-Scope claim is revised.

#### H6 — Users CRUD deferred to Phase 5 but ENTERPRISE has no user CRUD REQ
**Severity:** High
**Evidence:**
- BREADTH spec.md:106: "Users CRUD (조직 구성원 추가/편집) → Phase 5 | 본 Phase는 Auth.js SSO 기반 자동 프로비저닝만"
- ENTERPRISE permission matrix includes `rbac.manage` (REQ-ENTERPRISE-020, spec.md:262) implying admin-level user management, but no REQ implements `app/api/ra/users/*` endpoints

**Problem:** Admin cannot manage roles/org membership without user CRUD, yet RBAC requires roles to be assigned. Deferred without an implementation owner.

**Fix requirement:** Either ENTERPRISE adds user management endpoints or BREADTH's Out-of-Scope reason is revised to "deferred to Post-launch".

#### H7 — BREADTH introduces 10 new audit actions (REQ-BREADTH-057) but ENTERPRISE introduces 10+ more (REQ-ENTERPRISE-028) — no merged enum declaration
**Severity:** High
**Evidence:**
- BREADTH REQ-BREADTH-057 (spec.md:764-776): Phase 4 adds 10 actions: `conversations.list`, `conversation.view`, `message.feedback`, `template.list`, `template.download`, `updates.list`, `dashboard.view`, `projects.list`, `project.create`, `project.update`
- ENTERPRISE REQ-ENTERPRISE-028 (spec.md:310-313): Phase 5 adds 10 actions: `auth.login`, `auth.logout`, `auth.mfa_fail`, `session.invalidate`, `expert_review.create`, `expert_review.assign`, `expert_review.resolve`, `rbac.permission_deny`, `profile.theme_update`, `profile.locale_update`

Cumulative action list:
- Phase 1 (FND): `llm.call`, `source.access`, `expert_review.flag` — 3
- Phase 4 (BREADTH): +10 → 13
- Phase 5 (ENTERPRISE): +10 (by REQ-028), but BREADTH's 10 already exist → cumulative **23 distinct actions**

ENTERPRISE REQ-ENTERPRISE-028 does NOT acknowledge BREADTH's 10 additions. It says "extend to include at minimum" which implies ENTERPRISE is adding to a baseline including BREADTH's 10, BUT REQ-ENTERPRISE-028's introductory phrase refers to FOUNDATION REQ-FND-049 as the starting point — not BREADTH REQ-BREADTH-057. Also:
- ENTERPRISE REQ-009 mentions `'consult.expert_review_auto_flag'` (spec.md:184) — NOT in either list
- BREADTH REQ-BREADTH-057's 10 actions are NOT in ENTERPRISE's enum matrix

**Problem:** Either ENTERPRISE must explicitly list all 10 BREADTH actions in its union type extension (to avoid TypeScript regression), or ENTERPRISE REQ-028's "at minimum" phrase must be enforced with a cumulative baseline. The current drafts can easily cause ENTERPRISE to drop BREADTH's 10 additions during implementation.

**Fix requirement:** ENTERPRISE REQ-028 must either enumerate the cumulative 23+ actions OR explicitly declare "BREADTH-REQ-BREADTH-057's 10 actions remain in the union".

#### H8 — CHAT "first token ≤ 1.5s P95" vs. STRUCTURED follow-up latency — no combined budget
**Severity:** High
**Evidence:**
- CHAT REQ-CHAT-057 (spec.md:513): "The time from Route Handler receipt of a valid POST request to emission of the first `prose_delta` event SHALL be ≤ 1.5 seconds at P95"
- STRUCTURED spec.md:494: "prose `done` → 첫 structured event 간 지연 | P50 ≤ 1.0s, P95 ≤ 3.0s"
- STRUCTURED spec.md:495: "Haiku follow-up 총 지연 (모든 블록 생성 합) | P95 ≤ 5.0s"
- LAUNCH REQ-LAUNCH-024 (spec.md:307): `consult_full: p(95)<8000`
- BREADTH REQ-BREADTH-048 (spec.md:640): "5-corpus parallel retrieval P95 ≤ 800ms"

**Problem:** The handoff §15 "first token ≤ 1.5s" was measured for Phase 2 (FDA single corpus + Sonnet only). Phase 4 adds intent classifier (Claude Haiku, BREADTH REQ-BREADTH-044, "~200ms") + 5-corpus parallel retrieval (~800ms) + Cohere Rerank (~300ms) before Sonnet. Total pre-Sonnet budget: ~1.3s. First Sonnet token arrival requires additional latency (perhaps 500-800ms). **The 1.5s first-token SLO is likely violated in Phase 4+ configurations**, yet LAUNCH REQ-LAUNCH-024 still uses 1.5s.

BREADTH acknowledges this at spec.md:640: "retrieval slice is budgeted at 800ms allowing rerank (300ms) + Haiku classify (200ms) + Sonnet streaming TTFB (remaining ~2700ms)" — but 2700ms for Sonnet TTFB contradicts the 1.5s total first-token budget. Math: 200+800+300+2700 = 4000ms > 1500ms. **Self-contradicting.**

Also STRUCTURED adds `P95 3s` from prose-done to first structured event, and LAUNCH's full-response budget is 8s. If prose takes 1.5s + 2s streaming = 3.5s + structured follow-up 3-5s = 6.5-8.5s, the 8s budget is tight.

**Fix requirement:** LAUNCH REQ-LAUNCH-024 must be revised post-Phase 4 to a realistic P95 (perhaps 3-4s), OR Phase 4 retrieval must be reduced, OR Phase 2's 1.5s SLO must be caveated as "single-corpus baseline, cumulative SLO revised in Phase 4".

#### H9 — LAUNCH preflight script does not include STRUCTURED, ENTERPRISE custom scripts (tokens-symmetry, module-boundaries, contrast-check, i18n-check)
**Severity:** High
**Evidence:**
- ENTERPRISE spec.md:577-586 defines 13 automation CI gates including `pnpm tokens:check`, `pnpm modules:check`, `pnpm contrast:check`, `pnpm i18n:check`, `pnpm i18n:hardcoded-check`, `pnpm a11y`, `pnpm rbac:check`, `pnpm audit:check`
- LAUNCH REQ-LAUNCH-040 (spec.md:394-395) preflight: "(1) `pnpm biome check`, (2) `pnpm typecheck`, (3) `pnpm test:unit`, (4) `pnpm test:integration`, (5) `pnpm test:e2e --project=chromium`, (6) `pnpm eval:ci`, (7) `pnpm audit --audit-level=high`, (8) `gitleaks detect --no-git`, (9) `pnpm build`"

**Problem:** LAUNCH's preflight omits 8 of ENTERPRISE's 13 CI gates. If these gates are Phase 5 completion conditions and not re-run by Phase 6 preflight, a regression in RBAC coverage, tokens symmetry, i18n completeness, or module boundaries could be shipped to production.

**Fix requirement:** LAUNCH REQ-LAUNCH-040 preflight must include or reference ENTERPRISE's gates. Either add them explicitly, or state "plus all Phase 5 CI gates (ENTERPRISE §...)".

---

### MEDIUM (M1-M8)

#### M1 — `checklist_completions` normalization table deferred to ENTERPRISE but no REQ created
**Evidence:** STRUCTURED spec.md:82 "Multi-user 공유 대화에서 checklist 완료 상태 분리 → Phase 5 | `checklist_completions` 정규화 테이블 migration은 Phase 5 enterprise hardening". ENTERPRISE has no REQ for this migration.
**Fix:** Either ENTERPRISE adds the migration REQ, or STRUCTURED defers to Post-launch.

#### M2 — Regulatory updates auto-generation deferred to ENTERPRISE but no REQ
**Evidence:** BREADTH spec.md:104 "Impact analysis LLM 실시간 생성 → Phase 5". ENTERPRISE has no REQ.
**Fix:** Add REQ or defer to Post-launch.

#### M3 — Onboarding DB persist deferred to ENTERPRISE but no REQ
**Evidence:** BREADTH spec.md:107 "Onboarding DB persist (`users.onboarded_at` 컬럼) → Phase 5 | Phase 4는 localStorage only". ENTERPRISE has no `users.onboarded_at` migration.
**Fix:** Add migration REQ or accept that this remains localStorage-only until Post-launch.

#### M4 — audit_logs materialized view deferred to Phase 5 but no REQ
**Evidence:** BREADTH spec.md:110 "audit_logs materialized view → Phase 5". ENTERPRISE has no MV REQ.
**Fix:** Add MV REQ or explicitly state "MV deferred to Post-launch observability expansion".

#### M5 — CHAT's "first token ≤ 1.5s" test assumes seed corpus of 650 chunks, but BREADTH adds 5 corpora (~3000+ chunks potentially)
**Evidence:**
- CHAT REQ-CHAT-057 (spec.md:513): "measured under 4-core CPU, PostgreSQL co-located, Anthropic API available, **seed corpus of 650 chunks**"
- BREADTH REQ-BREADTH-042 (spec.md:569-578): 5 new corpora added, no chunk count specified but handoff implies multi-corpus is larger
**Problem:** Phase 2 baseline has 650 chunks; Phase 4 has potentially 5000+. The P95 benchmark environment changes, but no SPEC revises the performance claim.
**Fix:** BREADTH should revise CHAT's performance SLO for multi-corpus, or LAUNCH should perform Phase-4-representative load testing with realistic corpus size.

#### M6 — CHAT rate limit is in-memory token bucket, but BREADTH adds multi-user concurrent flows, and LAUNCH load test runs 50 VU
**Evidence:**
- CHAT REQ-CHAT-007 (spec.md:211-213): "in-memory token bucket keyed by `session.user.id`"
- CHAT spec.md:117 Out of Scope: "Redis/memcached 기반 rate limit → Post-launch"
- LAUNCH REQ-LAUNCH-023 (spec.md:303): "steady_50 (ramping-vus: 0→50 in 2m)" — 50 distinct VU
**Problem:** In-memory token bucket on Vercel serverless is per-function-instance. 50 VU load test with distinct sessions would be limited by the in-memory map size across cold starts. Load testing may mask the rate-limiting behavior.
**Fix:** Add caveat to LAUNCH REQ-LAUNCH-023 or note that in-memory rate limiting is not load-testable.

#### M7 — `expert_reviews.message_id` column — added in FOUNDATION but unclear if BREADTH and ENTERPRISE align
**Evidence:** FOUNDATION REQ-FND-043 (spec.md:541) adds `message_id` to expert_reviews. ENTERPRISE REQ-ENTERPRISE-002 (spec.md:137-145) Zod schema uses `messageIds: z.array(z.string().uuid()).optional()` — plural array, not singular FK. ENTERPRISE REQ-ENTERPRISE-009 passes `messageId` singular to `enqueueExpertReview`.
**Problem:** Zod schema accepts multi-message flag but DB schema has single `message_id`. If user manually flags 3 messages, ENTERPRISE must either insert 3 rows (not spec'd) or drop 2 messages.
**Fix:** Either use `messageIds[0]` and document, or add a `expert_review_messages` junction table.

#### M8 — LAUNCH runs full E2E on all 3 browser matrix (REQ-LAUNCH-014) but ENTERPRISE a11y E2E only runs on single project
**Evidence:** LAUNCH REQ-LAUNCH-021 (spec.md:289) runs on 3 browsers. ENTERPRISE REQ-ENTERPRISE-056 (spec.md:469) does not specify browser matrix — "runs axe-core against all core pages" implies single run.
**Problem:** ENTERPRISE's Phase 5 a11y result may pass on one browser but fail on webkit when LAUNCH re-runs. Either Phase 5 is under-specified or Phase 6 re-runs are redundant.
**Fix:** Align browser matrix across Phase 5 and Phase 6.

---

### LOW (L1-L4)

#### L1 — `users.intent` column promotion deferred without Phase 5 REQ
**Evidence:** BREADTH spec.md:111 "`users.intent` 컬럼 승격 (Phase 4는 audit_logs meta_json에 저장) → Phase 5 이후". ENTERPRISE does not add this.
**Fix:** Explicit Post-launch label or add REQ.

#### L2 — Inngest reg-updates crawler deferred to Phase 5 but no REQ
**Evidence:** BREADTH spec.md:103 "Regulatory updates 수집 자동화 (Inngest crawler job) → Phase 5". ENTERPRISE has no Inngest REQ.
**Fix:** Either add REQ or Post-launch label.

#### L3 — `sources.last_synced_at` real-time update deferred to Phase 5 but no REQ
**Evidence:** BREADTH spec.md:112. ENTERPRISE does not address this column.
**Fix:** Explicit label.

#### L4 — Audit static analysis script expected but AST-grep tool choice unclear
**Evidence:** ENTERPRISE REQ-ENTERPRISE-032 (spec.md:331) says "ts-morph" but harness-gap-audit doesn't verify a regula-compliance-qa agent is prepared to implement ts-morph integration.
**Fix:** regula-compliance-qa agent definition should own this.

---

## Harness Gap와 SPEC의 교차

harness-gap-audit.md flagged 4 Critical findings (C1-C4) that relate to Wave 1 SPECs:

### C1 (Phase 5 observability/security ownership collapse)
- **SPEC implication:** ENTERPRISE Phase 5 introduces 4-vendor observability (Sentry/PostHog/Langfuse/Vercel Analytics) at REQ-ENTERPRISE-066-073, owned by "regula-backend + regula-architect". The 4-vendor complexity is NOT mitigated by a dedicated "regula-observability" agent in the harness. ENTERPRISE relies on cross-agent coordination. **Impact:** Critical finding stands — ENTERPRISE assumes the harness provides security + observability review, but Wave 1 SPECs didn't propose a new agent. Agent definition shortage will block Phase 5 implementation.

### C2 (§7.11 Onboarding unowned)
- **SPEC implication:** BREADTH REQ-BREADTH-007 (spec.md:198-200) specifies Onboarding modal with 4 steps, 520px width, localStorage key `regula_onboarded`. Owner declared: regula-frontend (BREADTH spec.md:899). **Impact:** BREADTH Phase 4 does resolve harness C2 by assigning regula-frontend. Harness should update to reflect this assignment.

### C3 (Ingestion pipeline write-side unowned)
- **SPEC implication:** BREADTH REQ-BREADTH-042 (spec.md:569-578) declares 5 retrievers (read-only). Corpus ingestion is NOT a BREADTH deliverable — BREADTH spec.md:103 defers "Regulatory updates 수집 자동화" to Phase 5, and spec.md:802 external dependency "규제 코퍼스 원천 데이터 (Phase 4 kickoff 전 수집)" — "파싱·임베딩·DB적재는 Phase 5 Inngest crawler 전까지 manual seed script". **Impact:** Harness C3 stands in BREADTH. LAUNCH REQ-LAUNCH-003 requires 55 eval scenarios from these corpora but NO SPEC owns corpus ingestion. This is a cross-SPEC gap.

### C4 (agent `skills:` frontmatter not wired)
- **SPEC implication:** No SPEC addresses agent frontmatter. This remains a pure harness defect. Wave 1 SPECs did not remediate.

**Harness-SPEC gap summary:** BREADTH Phase 4 partially addresses harness C2 but NOT C3. ENTERPRISE Phase 5 does NOT address harness C1 with a dedicated agent. Harness C3 and C4 remain gaps after Wave 1.

---

## Conclusion

### Summary Verdict: **REQUIRES_PATCH**

Wave 1 SPECs are **70% coherent at surface level** but contain **7 Critical and 9 High findings** that must be resolved before Phase 2 kickoff. Most defects arise from:
- **Parallel authoring without interface verification** (C1, C4, C5)
- **Deferred scope without receiving-phase REQ** (C3, H2, H3, H5, H6, M1-M4)
- **Cumulative vs. absolute enum declaration ambiguity** (C6, H7)
- **Schema inconsistency between FOUNDATION declaration and consumers** (C7)
- **Performance SLO not revised for multi-phase composition** (H8)

### Required Patches Before Phase 2 Kickoff

These must land in Wave 1 iteration 2 (via manager-spec) before the Phase 2 SPEC is finalized and handed to Run:

1. **C1 patch:** Clarify expert-review `expert_reviews` row insertion ownership. Recommended: CHAT Phase 2 inserts the row with `requested_by=SYSTEM_USER_UUID` under a new REQ-CHAT-055a. ENTERPRISE REQ-009 then calls this existing row as "ensure enqueued" (idempotent) instead of creating.
2. **C2 patch:** Add BREADTH REQ "all new API endpoints SHALL include a minimal `withPermission()` placeholder (role-based only, scope-based deferred to Phase 5)". Alternative: Block Phase 4 production deployment until Phase 5 completes.
3. **C3 patch:** Add `'checklist.toggle'` to ENTERPRISE REQ-ENTERPRISE-028's enum list.
4. **C4 patch:** BREADTH Deliverable #17 (`app/api/ra/updates/route.ts`) should be relabeled "수정 (STRUCTURED Phase 3 확장)" with clear delta description. Alternatively, STRUCTURED Phase 3 moves updates endpoint to Phase 4 and uses mocked data for its RightContextPanel wiring.
5. **C5 patch:** Move `components/chat/RightContextPanel.tsx` creation to Phase 4 (BREADTH). STRUCTURED Phase 3 defines only the schema / props interface; BREADTH creates the component. OR: STRUCTURED explicitly marks "현재 프로젝트" section as Phase-3 placeholder with Phase 4 wire-up.
6. **C6 patch:** Resolve `audit_logs.action` type. Recommended: Keep as `text NOT NULL` in DB (matching FOUNDATION REQ-FND-044), enforce allowed values only via TypeScript union at application layer. Fix ENTERPRISE risk R1 (remove pgEnum language).
7. **C7 patch:** Resolve `messages.meta_json`. Recommended: FOUNDATION adds `meta_json jsonb NOT NULL default '{}'` to REQ-FND-036. Remove CHAT's auxiliary-table fallback.
8. **H2-H3 patch:** Add LAUNCH REQs for VPAT draft and Feature flag setup.
9. **H7 patch:** ENTERPRISE REQ-028 must acknowledge BREADTH's 10 actions and keep them.
10. **H8 patch:** LAUNCH REQ-LAUNCH-024 must revise first-token P95 upward (proposal: 2.5-3s for Phase 4+ multi-corpus), OR CHAT REQ-CHAT-057 must be narrowed to "Phase 2 single-corpus baseline".

### Recommended Verdict for Each SPEC

| SPEC | Verdict | Rationale |
|---|---|---|
| FOUNDATION-001 v0.3.0 | **REVIEW** (not audit scope — reference only) | `messages.meta_json` and `audit_logs.action` ambiguities propagate to all dependents. |
| CHAT-001 v0.1.0 | **REQUIRES_PATCH** | C1, C4, C5, C7, H8 |
| STRUCTURED-001 v0.1.0 | **REQUIRES_PATCH** | C3, C4, C5, H4 |
| BREADTH-001 v0.1.0 | **REQUIRES_PATCH** | C2, C4, C6, H7, H8, M1-M4 |
| ENTERPRISE-001 v0.1.0 | **REQUIRES_PATCH** | C1, C3, C6, H1, H4, H5, H6, H7, M1-M4 |
| LAUNCH-001 v0.1.0 | **REQUIRES_PATCH** | H1, H2, H3, H8, H9, M5, M6, M8 |

### Positive Findings

Despite 28 findings, notable strengths:
- REQ-ID prefix discipline is **perfect** (no collisions across 275 REQs)
- Handoff §-section coverage is **comprehensive** (§4-§20 all mapped)
- Non-Obvious Constraint #7 (noindex) handling is **airtight** across all phases
- CHAT's SSE event type `reserve` pattern (CHAT spec.md:131-134) is **exemplary** forward compatibility
- FOUNDATION's 13-table schema is **well-structured** with appropriate FK onDelete policies
- ENTERPRISE's 13 CI gates are **comprehensive**
- LAUNCH's launch_readiness_checklist (25 items across 6 categories) is **rigorous**

The SPECs are close to launchable; the 7 Critical findings are mostly interface resolution issues that can be patched in one iteration without restructuring. Estimated iteration 2 effort: 2-3 days for manager-spec to resolve all Critical + High findings.

---

Version: 1.0.0
Auditor: plan-auditor (adversarial stance)
Next Step: manager-spec iteration 2 to resolve Critical findings C1-C7 and High findings H1-H9 before Phase 2 kickoff approval.
