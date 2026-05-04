# Codex Project Memory — Regula RA Med Bot

Last reviewed: 2026-05-03

## Core Philosophy

- Start every meaningful task by verifying Git access and repo state: local status, `origin`, GitHub Wiki, and GitHub Issues. This project treats repo + Wiki + Issues as the working memory, not only the local files.
- Default workflow is Issue -> SPEC -> implementation -> PR with `Closes #N` -> Wiki ADR/Lessons update for architecture decisions or durable learnings.
- Do not begin product implementation from intuition. Read the relevant handoff/SPEC first, then check live GitHub tracking, then edit.
- The product itself mirrors the workflow: evidence-first, audit-first, expert-reviewable. Regulatory claims without source evidence are defects.

## Operating Guardrails

- No issue, no implementation.
- No ADR/wiki note, no durable architecture decision.
- No citation/audit check, no RA feature completion.
- Use Issue #1 as the standing project-philosophy anchor and link new work back to it when the work changes process, architecture, memory, or regulatory safety posture.
- Treat GitHub Issues as task memory and GitHub Wiki as long-term memory. README is the entry point; this file is the minimal Codex reminder.

## Source Of Truth Order

1. `RA-bot-design/design_handoff_regula/README.md` and screenshots/prototype for product, UX, and visual fidelity.
2. `.moai/project/product.md`, `tech.md`, `structure.md` for compressed Korean project context.
3. `.moai/plans/master-roadmap.md` and relevant `.moai/specs/SPEC-REGULA-*`.
4. GitHub Wiki for ADRs and lessons; GitHub Issues for work tracking.
5. Prototype files under `design_files/` are reference only. Never ship `Regula RA System.html` or copy prototype JSX wholesale.

## Non-Negotiable Product Constraints

- Every factual LLM claim needs inline citation and citation post-processing. Missing citations must be stripped or flagged.
- `/api/ra/consult` is a multi-phase SSE contract: metadata, trace, prose deltas, structured blocks, terminal event.
- Expert review is a safety gate, not decoration: low confidence or high-risk terms must route to RA review.
- `audit_logs` is a Day 1 regulatory requirement: append-only, 7-year retention, log every LLM call, source access, and expert-review flag.
- Korean and English are first-class. Korean UI is the default; locale switching must preserve conversation state.
- The authenticated app is `noindex`; marketing SEO belongs outside the app.
- Serif/sans typography contrast is part of the brand. Preserve token names and map prototype tokens carefully.

## Current Execution State

- Production Next.js app exists at repo root with `package.json`, App Router, Drizzle, Auth.js, Tailwind, Vitest, and Biome config.
- Phase 1 Foundation is complete.
- Phase 2 Chat Core is complete under Issue #4.
- Phase 3 Structured Outputs is complete under Issue #5.
- Phase 4 Breadth is complete on `main` as of 2026-05-03: 8 views, 10 APIs, 5 additional RAG retrievers, project switching, 47 test files / 472 tests.
- Phase 5 Enterprise Hardening is complete under Issue #7 as of 2026-05-03: expert review queue, RBAC, audit completeness, dark mode, i18n, accessibility, observability, profile API, 74 REQ-ENTERPRISE, and 903/903 Vitest tests recorded in the issue verification history.
- Phase 6 Quality & Launch is complete as of 2026-05-04 per SPEC-REGULA-LAUNCH-001 and CHANGELOG 1.0.0. Review/fix record: `.moai/specs/SPEC-REGULA-LAUNCH-001/review-2026-05-04.md`.
- Local verification caveat: do not count `next build` as passed from the 2026-05-03 local run; it hung and was interrupted. CI build is registered in `.github/workflows/ci.yml`, but local build pass evidence still needs a bounded run.
- PR #15 was reviewed and closed as obsolete on 2026-05-03. It had no review threads or comments, all checks passed, but it was conflicting because `main` already contained the Phase 3/4 work.
- Wiki access is enabled and readable. Wiki currently has Home, Lessons Learned, and Architecture Decisions index.
- Issues are enabled and readable; Issue #1 is the standing project philosophy / 4-Layer Memory System anchor.

## Known Roadmap Risks

- Phase 5 residual risk is verification evidence, not feature scope: local `next build` still needs a bounded pass record because the 2026-05-03 run hung.
- Phase 6 residual risk is external evidence: RA lead dataset sign-off, staging load credentials, Neon production branch, local Vitest execution blocked by esbuild `spawn EPERM`, and local `bash` unavailable for shell syntax checks.
- Phase 4 integration still depends on real corpus fixtures, template files, object-storage provisioning, and regulatory update seed data for end-to-end verification.
- Treat `.moai/specs` as authoritative but verify against current files and GitHub state before acting; planning docs can drift.

## Implementation Defaults

- Use Next.js 15 App Router, TypeScript, Tailwind v4 tokens, Radix UI, lucide-react, Zustand, TanStack Query, Drizzle, Postgres 16 + pgvector, Auth.js v5, and pnpm unless a newer SPEC supersedes this.
- For UI work, match prototype spacing, typography, colors, interactions, and screenshots closely.
- For GitHub delivery, create or reuse the issue before edits, keep progress there when useful, preserve unrelated workspace changes, and use PR metadata for merge-time issue closure.
- In this Windows Codex environment, PATH may omit `git`, `node`, and `pnpm`. Check command availability first, prefer absolute Node paths when needed, and run potentially long commands with explicit timeouts plus progress updates.
