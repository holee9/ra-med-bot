## SPEC-REGULA-BREADTH-001 Progress
- Started: 2026-05-02
- Phase 0.9 complete: TypeScript/Next.js detected → moai-lang-typescript
- Phase 0.95 complete: 5 domains, 30+ files → Full Pipeline mode
- Phase 1 complete: 30 tasks decomposed (T-001 through T-030)

### Phase 4 Kickoff Status
- SPEC version: 0.2.0 (cross-spec-audit C2/C5/C6/H8 incorporated)
- Methodology: TDD (RED-GREEN-REFACTOR; per .moai/config/sections/quality.yaml)
- Total REQs: 58 (REQ-BREADTH-001 ~ REQ-BREADTH-058)
- Total files: 45 (39 new + 6 modified)
- Total tasks: 30 atomic TDD tasks across 5 domains
- Critical path: T-001/T-002/T-003 → RAG layer (T-005..T-009) → APIs (T-010..T-019) → Queries (T-020) → Views (T-022..T-029) → Project switching (T-030)

### Domains Identified
1. Foundation (audit enum migration, retriever interface, Zustand stores) — 4 files
2. RAG Pipeline (5 retrievers + router + merge + consult integration) — 9 files
3. API Routes (10 endpoints) — 10 files
4. Frontend Queries (8 TanStack Query hooks) — 8 files
5. Views & Components (7 pages + onboarding modal + project switching wiring) — 14 files

### Decision Points Status
- DP-1 (embedding dimension 1024 vs 1536): **RESOLVED at planning time**. Phase 2 SPEC-REGULA-CHAT-001 TD-6 confirms `OpenAI text-embedding-3-small` 1536 dim, aligning with `vector(1536)` schema. No migration required for Phase 4.
- DP-2 (dashboard aggregate query optimization): **DEFERRED to runtime profiling**. Phase 4 uses direct queries + composite index `(created_at, action)` + Query staleTime 5min. Materialized View deferred to Phase 5.
- DP-3 (intent meta storage location): **CONFIRMED audit_logs.meta_json approach**. No schema migration. Phase 5 evaluates `messages.intent` pgEnum promotion based on `SELECT meta_json->>'intent'` P95.
- DP-4 (onboardingDone persist location): **CONFIRMED localStorage only**. DB ingestion (`users.onboarded_at`) deferred to Phase 5.
- DP-5 (projectId switching during AnswerBlock history): **CONFIRMED snapshot-at-submit pattern**. Existing AnswerBlocks render with original projectId; new submits use new snapshot.

### Critical Blockers Before Implementation
None at planning level. Phase 4 kickoff prerequisites (out-of-band):
1. 5 corpora raw data must be ingested with embeddings before integration tests for T-007/T-008 can use real fixtures (unit tests use mocks).
2. S3/R2 bucket provisioning required before T-015 end-to-end download verification.
3. 10+ regulatory_updates seed rows with hand-authored impact_analysis_text required before T-027 visual verification.
4. Sample template files (PDF + DOCX) required before T-015 + T-025 download e2e.

### Next Step
Phase 2 (Run) has started.

Completed:
1. T-001 audit action enum expansion committed (`69443cf`).
2. T-002 retriever interface standardization committed locally (`c7b739e`, ahead of `origin/main`).

In progress:
1. T-003 UI store and T-004 project store files exist in the working tree with unit tests under `tests/unit/stores/`.
2. These store changes are not yet committed in the current working tree.

Next recommended sequence:
1. Finish and verify T-003/T-004 store work.
2. Continue T-005/T-006/T-007/T-008 and T-010/T-021 after foundation store state is stable.
3. Keep T-009 consult integration serial after the RAG layer.
4. Run T-011 through T-019 API work after T-001 + T-010.
5. Run T-020 hooks after APIs.
6. Run T-022 through T-029 views after hooks + seed data.
7. Run T-030 project switching wiring last.
