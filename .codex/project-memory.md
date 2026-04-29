# Codex Project Memory — Regula RA Med Bot

Last reviewed: 2026-04-29

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

- No production Next.js app is scaffolded yet; root has no `package.json` at review time.
- Wiki access is enabled and readable. Wiki currently has Home, Lessons Learned, and Architecture Decisions index.
- Issues are enabled and readable; Issue #1 is the standing project philosophy / 4-Layer Memory System anchor.
- Current worktree had user-owned changes/deletions in `.wiki-temp/`; do not restore or stage them unless explicitly asked.

## Known Roadmap Risks

- Before Phase 2, verify harness remediation status. Critical blockers documented in `.moai/plans/harness-gap-audit.md` include:
  - C3: corpus ingestion/write-side owner must exist before RAG can demo real retrieval.
  - C4: regula agent `skills:` frontmatter must actually wire domain skills.
  - C1: security and observability ownership must be separated from compliance QA before enterprise hardening.
  - C2: onboarding needs an explicit frontend owner before Phase 4.
- Treat `.moai/specs` as authoritative but verify against current files and GitHub state before acting; planning docs can drift.

## Implementation Defaults

- Use Next.js 15 App Router, TypeScript, Tailwind v4 tokens, Radix UI, lucide-react, Zustand, TanStack Query, Drizzle, Postgres 16 + pgvector, Auth.js v5, and pnpm unless a newer SPEC supersedes this.
- For UI work, match prototype spacing, typography, colors, interactions, and screenshots closely.
- For GitHub delivery, create or reuse the issue before edits, keep progress there when useful, preserve unrelated workspace changes, and use PR metadata for merge-time issue closure.
