---
audit_id: AUDIT-REGULA-HARNESS-001
target: .claude/agents/regula/ + .claude/skills/regula*/
auditor: plan-auditor
audit_date: 2026-04-22
stance: adversarial-independent
scope: Phase 2~6 execution readiness vs handoff §7~§18
m1_context_isolation: Reasoning context (CLAUDE.md user instructions, agent-hooks.md, agent-authoring.md, skill-authoring.md, model-policy.md) ignored per M1. Audit rests solely on harness files + handoff README + Phase 1 SPEC as evidence.
---

# Harness Gap Audit — Regula

## Executive Summary

- **Critical findings:** 4
- **High findings:** 7
- **Medium findings:** 6
- **Low findings:** 3
- **Overall verdict:** REQUIRES_EXPANSION
- **Recommended action:** Block Phase 2 entry until the 4 Critical findings (C1-C4) are patched via harness updates. C1 (Phase 5 observability/security ownership collapse), C2 (§7.11 Onboarding unowned), C3 (Ingestion pipeline write-side unowned), and C4 (agent `skills:` frontmatter not wired) are not bridgeable by runtime improvisation — they are structural gaps that will propagate to all downstream Phases. High findings H1-H7 should be addressed before Phase 5.

Rationale for adversarial verdict: The harness was drafted top-down from handoff §7~§18 but audited against §N.M atomic coverage it shows systemic thin-coverage for §7.11, §11.10 ingestion write-path, §13.1 lucide enforcement, §14 keyboard shortcuts, §18 CI/CD, and §9.6 keyboard shortcuts. Additionally, two skills (regula-citation-contract, regula-streaming-contract) overlap in § data-source index rules without a clear boundary, and several agents lack the `skills:` frontmatter array that would actually inject the domain skills into their context — the skills are only listed informationally in the orchestrator table.

## Coverage Matrix

Legend: FULL = explicit ownership + detailed specification; PARTIAL = mentioned but lacks depth or has ambiguous owner; MISSING = no owner identified.

### §7 Screens & Views

| Section | Title | Owner | Status | Evidence |
|---|---|---|---|---|
| §7.1 | Shell — Sidebar | regula-frontend | FULL | regula-frontend.md:13 "Shell 구현 — Sidebar.tsx (260px 고정, nav/projects/footer)" |
| §7.2 | Shell — Topbar | regula-frontend | FULL | regula-frontend.md:13 "Topbar.tsx (56px, 브레드크럼/테마/공유/전문가 검토)" |
| §7.3 | Home | regula-frontend | PARTIAL | regula-frontend.md:15 lists "Home" but no Phase assigns Home implementation explicitly; orchestrator Phase 1 has architect do `app/(app)/page.tsx` (Home) at SKILL.md:58 — ownership split unclear |
| §7.4 | Chat / New Consultation | regula-frontend + rag-pipeline | FULL | regula/SKILL.md:122 "regula-chat-team = [frontend, rag-pipeline, backend, compliance-qa]" |
| §7.5 | History | regula-frontend | FULL | regula/SKILL.md:147 Phase 4 includes History view |
| §7.6 | Templates | regula-frontend + regula-backend | FULL | regula/SKILL.md:147,152 |
| §7.7 | Knowledge Base | regula-frontend + regula-backend | FULL | regula/SKILL.md:147 |
| §7.8 | Regulatory Updates | regula-frontend + regula-backend | FULL | regula/SKILL.md:147 |
| §7.9 | Dashboard | regula-frontend + regula-backend | PARTIAL | regula/SKILL.md:147 list; Dashboard §11.9 ACL (manager vs member) NOT addressed — README.md:677 "Respects ACL (manager vs. member)" unimplemented in any skill |
| §7.10 | Document Viewer | regula-frontend | PARTIAL | regula/SKILL.md:128 "frontend — DocViewer.tsx"; design spec (260px doc nav + 1200 panel + amber underline highlight) unowned — no detailed component instructions in regula-frontend.md |
| §7.11 | **Onboarding (First Visit)** | **MISSING** | **MISSING** | No agent/skill mentions 4-step modal, shield/book/folder/alert icons, `regula_onboarded=1` localStorage. Only `onboardingDone` store field at regula-frontend.md:18. See C2 below. |

### §8 Shared Components

| Section | Component | Owner | Status | Evidence |
|---|---|---|---|---|
| §8.1 | Citation | regula-frontend + regula-rag-pipeline + regula-citation-contract | FULL | regula-citation-contract/SKILL.md:15-24 |
| §8.2 | **ConfidenceBadge** | PARTIAL | PARTIAL | Mentioned implicitly under AnswerBlock (regula-frontend.md:14) but no named component ownership; three-level color scheme (high=green, med=amber, low=red) not specified in any skill |
| §8.3 | AnswerBlock | regula-frontend | FULL | regula-frontend.md:14 "AnswerBlock.tsx (meta/callout/prose/checklist/comparison/timeline/sources/related)" |
| §8.4 | **SourceCard** | MISSING | MISSING | Not named in any regula-* agent/skill. Design spec (240px min cards, index badge + org + type pill + 2-line title + mono year) unowned. README.md:496 |
| §8.5 | Checklist Row | regula-frontend | PARTIAL | regula/SKILL.md:142 "Checklist.tsx" (Phase 3) — row-level design (16×16 checkbox, tag ref badge) unowned |
| §8.6 | ComparisonTable | regula-frontend | FULL | regula/SKILL.md:142 |
| §8.7 | Timeline | regula-frontend | FULL | regula/SKILL.md:142 |
| §8.8 | Callout | regula-frontend + regula-design-system | FULL | regula-frontend.md:16, regula-design-system.md:37 "components/primitives/... Callout" |
| §8.9 | Chip / Button / IconButton | regula-frontend + regula-design-system | FULL | regula-frontend.md:16, regula-design-system.md:37 |
| §8.10 | SuggestionPill | regula-frontend | FULL | regula/SKILL.md:142 |

### §9 Interactions & Behavior

| Section | Title | Owner | Status | Evidence |
|---|---|---|---|---|
| §9.1 | Chat submission flow | regula-frontend + regula-streaming-contract | FULL | regula-streaming-contract/SKILL.md:10-36 |
| §9.2 | Citation click | regula-frontend + regula-citation-contract | FULL | regula-citation-contract/SKILL.md:92-115 |
| §9.3 | Expert review flag | regula-rag-pipeline + regula-backend + regula-expert-review-gating | FULL | regula-expert-review-gating/SKILL.md:11-62 |
| §9.4 | Project context | regula-frontend + regula-backend | PARTIAL | regula-frontend.md:18 `currentProjectId`; RAG retriever project-filter at regula-rag-pipeline.md not called out — projectId injection into retriever chain unowned |
| §9.5 | Theme toggle | regula-design-system | FULL | regula-design-tokens/SKILL.md:138-152 |
| §9.6 | **Keyboard shortcuts** | MISSING | MISSING | Cmd+K, Cmd+/, Cmd+J, Esc — no explicit owner. See H3. README.md:549-553 |
| §9.7 | Responsive breakpoints | regula-frontend | FULL | regula-frontend.md:19 "반응형 브레이크포인트 — ≥1100px 풀 스플릿, 900-1099..." |
| §9.8 | Animations | regula-frontend + regula-design-system | PARTIAL | regula-frontend.md:27 "prefers-reduced-motion"; specific animations (trace 200ms fade+4px translateY, message 300ms ease-out, tdot keyframe 1.2s) not enumerated in any skill |

### §11 API Contracts

| Section | Endpoint | Owner | Status | Evidence |
|---|---|---|---|---|
| §11.1 | POST /api/ra/consult (SSE) | regula-backend + regula-rag-pipeline + regula-streaming-contract | FULL | regula-streaming-contract/SKILL.md:149-188 |
| §11.2 | GET /api/ra/conversations | regula-backend | FULL | regula-backend.md:15 |
| §11.3 | GET /api/ra/conversations/[id] | regula-backend | FULL | regula-backend.md:15 |
| §11.4 | POST /api/ra/conversations/[id]/feedback | regula-backend | FULL | regula-backend.md:15 |
| §11.5 | GET /api/ra/sources/[id] | regula-backend | FULL | regula-backend.md:16 |
| §11.6 | GET /api/ra/templates | regula-backend | FULL | regula-backend.md:17 |
| §11.7 | GET /api/ra/updates | regula-backend | FULL | regula-backend.md:18 |
| §11.8 | POST /api/ra/expert-review | regula-backend + regula-expert-review-gating | FULL | regula-backend.md:19 |
| §11.9 | GET /api/ra/dashboard | regula-backend | PARTIAL | regula-backend.md:20 endpoint mentioned but ACL (manager vs member) RBAC enforcement not specified in any skill |
| §11.10 | **Ingestion (admin)** | **PARTIAL** | **PARTIAL** | regula-backend.md:21 mentions `/api/admin/ingest/*` but ONLY as Route Handler; the actual write-side pipeline (chunking + embedding + pgvector insert + `update-monitor/run` crawl) has NO owner. rag-pipeline covers retrieval (read) only. See C3. |

### §13 Assets

| Section | Topic | Owner | Status | Evidence |
|---|---|---|---|---|
| §13.1 | **lucide-react icon enforcement** | MISSING | PARTIAL | regula-expert-review-gating/SKILL.md:104 imports `ShieldAlert` (lucide); no skill or agent prohibits custom SVG fallback or enforces the mapping table (README.md:721-740). See M1. |
| §13.2 | Fonts | regula-design-system + regula-i18n | FULL | regula-design-tokens/SKILL.md:154-161, regula-i18n/SKILL.md:40-63 |
| §13.3 | Logo | MISSING | MISSING | "Before production, have design team finalize a vector logo" (README.md:752) — no agent owns logo wireup. See L1. |
| §13.4 | Illustrations prohibition | MISSING | MISSING | "commission rather than AI-generate" constraint (README.md:755) not enforced in any skill. See L2. |

### §14 Accessibility

| Aspect | Owner | Status | Evidence |
|---|---|---|---|
| WCAG 2.1 AA audit | regula-compliance-qa | FULL | regula-compliance-qa.md:15 |
| Axe-core in Playwright | regula-compliance-qa | FULL | regula-compliance-qa.md:15 |
| Visible focus ring | regula-design-system + regula-frontend | FULL | regula-design-tokens/SKILL.md:173 |
| aria-live="polite" streaming | regula-frontend | FULL | regula-frontend.md:28 |
| **Keyboard operable (all)** | PARTIAL | PARTIAL | Focus ring covered; keyboard shortcut specification (§9.6) unowned. See H3. |

### §16 Security & Compliance

| Requirement | Owner | Status | Evidence |
|---|---|---|---|
| Auth.js SSO + MFA + 30min timeout | regula-backend | FULL | regula-backend.md:22 |
| Org/project RLS | regula-backend | FULL | regula-backend.md:25 |
| Audit trail 21 CFR Part 11 | regula-backend + regula-audit-compliance | FULL | regula-audit-compliance/SKILL.md:37-56 |
| 7-year retention | regula-audit-compliance | FULL | regula-audit-compliance/SKILL.md:176-179 |
| Data residency (EU) | regula-backend + regula-audit-compliance | FULL | regula-audit-compliance/SKILL.md:181-190 |
| Zero-data-retention LLM | regula-backend + regula-rag-pipeline | FULL | regula-rag-pipeline.md:27 |
| Input validation (Zod, 8k, 60/hr rate limit) | regula-backend | FULL | regula-backend.md:26 |
| Output enforcement (citations) | regula-rag-pipeline + regula-citation-contract | FULL | regula-rag-pipeline.md:20 |
| Secrets rotation | MISSING | MISSING | Quarterly rotation (README.md:808) not owned. See H4. |
| **CSP strict (nonce-based)** | PARTIAL | PARTIAL | Listed only in regula-compliance-qa.md:20 as an AUDIT target, NOT an IMPLEMENTATION task. See C1. |
| **HSTS** | PARTIAL | PARTIAL | Same — audit only. See C1. |
| **X-Frame-Options DENY** | PARTIAL | PARTIAL | Same — audit only. See C1. |
| **OWASP Top 10 implementation** | PARTIAL | PARTIAL | Same — audit only. See C1. |
| SSRF / SQL injection review | MISSING | MISSING | No owner. See C1. |
| 21 CFR Part 11 electronic records / GxP | regula-audit-compliance | FULL | regula-audit-compliance/SKILL.md:6-8 |

### §17 Testing Strategy

| Layer | Owner | Status | Evidence |
|---|---|---|---|
| Unit (Vitest 80%+) | regula-compliance-qa | FULL | regula-compliance-qa.md:39 |
| Component (Storybook) | MISSING | MISSING | Storybook setup not owned by any agent. See H5. |
| Integration (msw) | regula-compliance-qa | FULL | regula-compliance-qa.md:40 |
| E2E (Playwright) | regula-compliance-qa | FULL | regula-compliance-qa.md:19 |
| LLM eval (promptfoo) | regula-compliance-qa | FULL | regula-compliance-qa.md:16 |
| Accessibility (Axe) | regula-compliance-qa | FULL | regula-compliance-qa.md:15 |
| Visual regression | MISSING | MISSING | Chromatic/Playwright screenshots not owned. See M2. |
| **Load test** | MISSING | MISSING | regula/SKILL.md:174 mentions "로드 테스트" as Phase 6 goal but no task assigns owner. See H6. |

### §18 Deployment & DevOps

| Aspect | Owner | Status | Evidence |
|---|---|---|---|
| Environments (local → preview → staging → prod) | regula-architect | PARTIAL | regula-architect.md:5-18 scoping covers scaffolding; environment pipeline unowned explicitly |
| Branch strategy (trunk-based, PR-required) | MISSING | MISSING | No owner. See M3. |
| **CI (GitHub Actions: Biome/typecheck/vitest/playwright/build/deploy)** | MISSING | MISSING | No agent mentions `.github/workflows/`. regula/SKILL.md:183 gives architect "production deploy 준비" but CI pipeline authoring not enumerated. See H7. |
| Migrations (Drizzle Kit review + squash) | regula-backend | FULL | regula-backend.md:85 |
| Feature flags | regula-backend | FULL | regula-backend.md:39 |
| Rollback strategy | MISSING | MISSING | No owner. See M4. |
| Monitoring (Sentry + Langfuse) | **CONFUSED OWNERSHIP** | PARTIAL | regula/SKILL.md:170 assigns Sentry/Langfuse wiring to compliance-qa; Langfuse integration also claimed by rag-pipeline.md:22. See C1 for ownership collapse. |

## Critical Findings

### C1. Phase 5 Security + Observability Ownership Collapse

**Severity:** Critical

**Evidence:**
- regula/SKILL.md:170 assigns "Sentry + Langfuse wiring, audit 완전성 정적 분석" to `compliance-qa`. This conflates IMPLEMENTATION (instrumentation) with VERIFICATION (static analysis). Compliance-QA's own mandate (regula-compliance-qa.md:9) is "품질·규제 준수를 독립적으로 검증" — not instrumentation.
- regula-compliance-qa.md:20 lists "Security 감사 — OWASP Top 10 체크리스트, CSP nonce, HSTS, X-Frame-Options DENY 헤더 검증" — but "검증 (verify)" is the only verb. Implementation of CSP middleware, HSTS headers, X-Frame-Options (where in `next.config.mjs`? in custom `middleware.ts`? owner?) is unassigned.
- regula-backend.md contains zero mention of `CSP`, `HSTS`, `X-Frame-Options`, `middleware.ts`, `SSRF`, or `SQL injection` as implementation responsibilities. Only rate-limit + Zod validation are owned.
- regula/SKILL.md:182 "보안 감사 (OWASP Top 10, CSP, HSTS, rate limit 검증)" — again, "검증" only.

**Impact:** Phase 5 team (regula-enterprise-team = backend, rag-pipeline, design-system, compliance-qa) has no agent tasked with IMPLEMENTING security headers, nonce rotation, CSRF protection, SSRF guards, or parameterized query enforcement. Phase 6 team (compliance-qa lead + architect, backend) repeats the same composition with audit-only framing. If the harness is entered as drafted, the product will ship with CSP/HSTS unconfigured because Compliance-QA will correctly report gaps but no one has the task to close them.

Also: Langfuse wiring is double-owned. rag-pipeline.md:22 "Langfuse 로깅 — 모든 LLM call을 Langfuse에 trace로 기록" vs. regula/SKILL.md:170 assigns wiring to compliance-qa. This will cause Phase 5 friction.

**Remediation:**
1. **Add `regula-security-audit` agent** (new) specialized in OWASP, CSP, HSTS, CSRF, SSRF, SQL injection prevention. Include in Phase 5 and Phase 6 teams.
2. **Add `regula-observability` agent** (new) owning Sentry + Langfuse + PostHog wiring, structured logging, alert rules. Include in Phase 5.
3. **Rewrite regula/SKILL.md:170, :182** to split "wire Sentry/Langfuse (observability agent)" from "verify audit completeness (compliance-qa)".
4. **Move Langfuse trace emission** from rag-pipeline.md:22 (keep invocation) to observability agent (owns wrapper/config).

### C2. §7.11 Onboarding Has Zero Owner

**Severity:** Critical

**Evidence:**
- handoff README.md:459-467 specifies 4-step modal (520px wide, centered), icon per step (shield/book/folder/alert), step-dot bottom bar with active dot expanded to 18px, `localStorage regula_onboarded=1` persistence.
- regula-handoff-reader/SKILL.md:22 assigns §7.1~7.11 to regula-frontend in the section-owner table.
- regula-frontend.md:15 enumerates "8개 View 페이지 — Home, Chat(new/[id]), History, Templates(list/[id]), Knowledge Base, Regulatory Updates(list/[id]), Dashboard, Projects, Sources, Settings". Onboarding is NOT in this list. (Also note: the prompt says "8개" but lists 10+ views — internal count error, see M5.)
- regula-frontend.md:18 mentions `onboardingDone` as a Zustand store field but does not describe the onboarding UI component.
- regula/SKILL.md Phase 1-6 task lists: no Phase includes `Onboarding.tsx` or `OnboardingModal.tsx` as a deliverable.
- Grep `onboarding|7.11|first visit|첫 방문|온보딩` across `.claude/agents/regula/` and `.claude/skills/regula*/` returns only regula-handoff-reader's section-index and regula-frontend.md:18 state field.

**Impact:** First-visit users will see no onboarding. Unowned requirements are unimplemented requirements. Without remediation, this ships as a defect.

**Remediation:**
1. Add "Onboarding (§7.11) — 4-step modal, step-dot progress, localStorage gate" as an explicit enumerated responsibility in regula-frontend.md core roles.
2. Add a Phase 4 or Phase 5 task in regula/SKILL.md assigning `(frontend) OnboardingModal.tsx (4 steps, localStorage regula_onboarded=1)`.
3. Correct the "8개 View 페이지" count in regula-frontend.md:15 — the enumerated list contains at least 10 destinations.

### C3. §11.10 Ingestion Pipeline Write-Side Has No Owner

**Severity:** Critical

**Evidence:**
- handoff README.md:679-683 specifies three admin endpoints: `POST /api/admin/ingest/corpus` (schedule re-ingest), `POST /api/admin/ingest/internal` (upload SOP / past filing), `POST /api/admin/update-monitor/run` (manual crawl of regulator websites).
- regula-backend.md:21,50 mentions `/api/admin/ingest/*` route handlers as an output but does NOT specify the downstream processing — chunking, embedding generation (OpenAI/Cohere/Voyage?), pgvector insertion, source metadata extraction, dedup, checksum, or the regulator-website crawler (`update-monitor/run`).
- regula-rag-pipeline.md is scoped to RETRIEVAL (read-side). Its 10 core roles (retrievers, rerank, prompt, streaming, confidence, expert-review, Langfuse) do NOT include ingestion or embedding generation.
- regula-architect.md:15 "Drizzle 스키마" includes pgvector extension but not the embedding pipeline.
- Grep `embed|chunk|update-monitor|crawl` across all regula-* agents returns zero results for pipeline implementation.
- The 7 retrievers (fda.ts, eu-mdr.ts, mfds.ts, nmpa.ts, pmda.ts, iso.ts, internal.ts; regula-rag-pipeline.md:15) have no corresponding ingestion counterpart. How are `sources.embedding vector(1536)` and `source_sections.embedding` (README.md:702-704) populated?

**Impact:** The corpus exists only in schema. No Phase produces actual retrieved data. Phase 2 (regula/SKILL.md:120) says "minimal RAG pipeline (FDA corpus 1개만 연결)" — but "연결" is passive voice; who ingests the FDA corpus into the DB? In Phase 4 / 5 /6 the full multi-corpus RAG cannot demonstrably work because no agent is tasked with populating it.

**Remediation:**
1. **Add `regula-corpus-ingestion` agent** (new) owning: chunking strategy (token size, overlap), embedding generation (which model? ada-002, voyage-3, Cohere-embed?), pgvector insert batch, upsert-by-checksum, metadata extraction, FDA/EU-MDR/MFDS crawlers (`update-monitor/run`).
2. Add Phase 2 entry task "(corpus-ingestion) FDA corpus chunking + embedding + pgvector upsert" as a PRECONDITION for Phase 2 retriever to return any data.
3. Phase 5 team should include corpus-ingestion for the `update-monitor/run` recurring crawl.

### C4. Agent `skills:` Frontmatter Field Not Wired

**Severity:** Critical

**Evidence:**
- regula/SKILL.md:16-25 declares a skill-agent mapping table:
  - regula-architect → regula-handoff-reader
  - regula-design-system → regula-design-tokens, regula-handoff-reader
  - regula-frontend → regula-streaming-contract, regula-citation-contract, regula-design-tokens, regula-handoff-reader
  - regula-rag-pipeline → regula-citation-contract, regula-streaming-contract, regula-expert-review-gating
  - regula-backend → regula-audit-compliance, regula-streaming-contract, regula-handoff-reader
  - regula-compliance-qa → regula-audit-compliance, regula-citation-contract, regula-expert-review-gating
- However, all six regula-* agent frontmatters contain ONLY `name`, `description`, `model: opus` — verified by grep `^---$|^effort:|^model:|^tools:|^skills:` across `.claude/agents/regula/`. There is no `skills:` YAML array in any agent.
- Consequence: Skills are NOT injected into the agent's context at startup. When `regula-frontend` is spawned as a teammate, the skill body of `regula-streaming-contract` (SSE contract types, useStreamingAnswer pattern) is NOT loaded — only the agent's own body.
- The orchestrator table at regula/SKILL.md:16-25 is therefore descriptive, not functional. The agents must load skills at runtime via `Skill()` invocation, but their bodies contain no instruction to do so.

**Impact:** Agents will run Phase 2-6 tasks without the skill bodies present. Streaming contract violations, citation shape drift, and audit-logging omissions are likely because the normative rules (e.g., regula-streaming-contract's 9-event TypeScript union, regula-citation-contract's 3-defense post-processing) live in skill bodies that never reach agent context. The harness's intended 1-to-1 skill-agent coupling is aspirational, not enforced.

**Remediation:**
1. Add `skills:` YAML array to each regula-* agent frontmatter matching the orchestrator table:
   - regula-frontend.md frontmatter `skills:\n  - regula-streaming-contract\n  - regula-citation-contract\n  - regula-design-tokens\n  - regula-handoff-reader`
   - Apply analogously to the other 5 agents.
2. Alternatively, if skill injection is to remain runtime-only, add an explicit `## Skills to Load at Start` section to each agent prompt with a deterministic `Skill("regula-streaming-contract")` invocation instruction as the first action.
3. Update orchestrator spawn prompts in regula/SKILL.md:69-88 to explicitly re-state skill names so the spawned teammate loads them from its spawn-time prompt context.

## High Findings

### H1. Phase 4 Lacks design-system → New Token Drift Risk

**Severity:** High

**Evidence:**
- regula/SKILL.md:149 "regula-breadth-team = [frontend, backend, compliance-qa]" — no design-system.
- Phase 4 introduces 6 new views (History, Templates, Knowledge Base, Regulatory Updates, Dashboard, Projects). Each view has distinct components per handoff §7.5-§7.9 (stat cards with `--text-5xl` serif values, region chips, left-accent borders for HIGH IMPACT, amber accent dots).
- New components frequently need new Tailwind token compositions. Without design-system on the team, frontend will hardcode `bg-[#...]` or `text-[32px]` — which regula-design-tokens/SKILL.md:132-134 explicitly prohibits.

**Remediation:** Add `design-system` to regula-breadth-team (Phase 4).

### H2. Phase 5 Lacks Frontend → Expert Review UI + Locale UI Unowned

**Severity:** High

**Evidence:**
- regula/SKILL.md:162 "regula-enterprise-team = [backend, rag-pipeline, design-system, compliance-qa]" — no frontend.
- Phase 5 tasks include: "expert-review 자동 게이팅" (5.2, needs ExpertReviewCallout.tsx from regula-expert-review-gating/SKILL.md:102-118), "다크 모드 폴리시 완료, locale 전환" (5.4 — LocaleToggle.tsx at regula-i18n/SKILL.md:168-175).
- Without frontend on team, these UI components cannot be authored. design-system produces styling but not components.

**Remediation:** Add `frontend` to regula-enterprise-team (Phase 5).

### H3. §9.6 Keyboard Shortcuts Have No Owner

**Severity:** High

**Evidence:**
- handoff README.md:549-553 specifies `⌘/Ctrl + K`, `⌘/Ctrl + /`, `⌘/Ctrl + J`, `Esc`.
- No regula-* agent or skill mentions "keyboard shortcut", "Cmd+K", "useHotkeys", or a dedicated keymap.
- regula-frontend.md:28 mentions only "focus visible" but not global shortcuts.
- Enterprise RA users expect power-keyboard flow. Missing Cmd+K to open new consultation is a severe productivity defect.

**Remediation:** Add "Keyboard shortcuts (§9.6) — global keymap hook (`useKeyboardShortcuts`), Cmd+K focuses composer, Cmd+/ toggles sidebar, Esc closes modal" as an explicit enumerated responsibility in regula-frontend.md core roles. Add Phase 4 task to implement.

### H4. Secrets Rotation Policy Has No Owner

**Severity:** High

**Evidence:**
- handoff README.md:808 "Secrets: env only; rotate quarterly; use Vercel Secrets / AWS Secrets Manager".
- No regula-* agent owns rotation cadence, runbook, or KMS integration.
- regula-architect.md:17 lists `.env.example` variables but not rotation policy.
- regula-audit-compliance/SKILL.md has 7-year retention but nothing about key rotation.

**Remediation:** Assign secrets rotation runbook to the proposed `regula-security-audit` agent (C1). Include `secrets-rotation.md` deliverable in Phase 5.

### H5. Storybook Setup + Component Isolation Unowned

**Severity:** High

**Evidence:**
- handoff README.md:819 "Component — Storybook + Vitest (with storybook-test), All shared components".
- regula-compliance-qa.md:39 lists only `tests/unit/`, `tests/integration/`, `tests/e2e/`, `tests/eval/`, `tests/fixtures/` — no `stories/` or `.storybook/`.
- regula-frontend.md outputs (lines 41-44) include `components/` but not `.storybook/main.ts` or `*.stories.tsx`.
- No agent declares Storybook installation, configuration, or story authoring.

**Remediation:** Add Storybook ownership to regula-frontend.md (story files co-located with components) + regula-architect.md (`.storybook/` config). Add Phase 2/3 task "write stories for Citation/AnswerBlock/Callout/Checklist/ComparisonTable/Timeline/SuggestionPill".

### H6. Load Test Ownership Vacancy

**Severity:** High

**Evidence:**
- regula/SKILL.md:174 Phase 6 goal "LLM eval harness (50+ RA 질문), Playwright E2E, 로드 테스트, 보안 리뷰, 문서".
- Phase 6 task breakdown (regula/SKILL.md:178-185) lists 6 tasks — none mention load testing. k6, Artillery, Locust, or RAG-specific latency benchmarking are absent.
- handoff README.md:777 "LCP ≤ 2.0s, INP ≤ 200ms, CLS ≤ 0.05, First answer token ≤ 1.5s". No agent has task to measure these.

**Remediation:** Add explicit Phase 6 task "(architect + compliance-qa) k6 load suite: 60 queries/hr/user, 100 concurrent SSE streams, first-token ≤ 1.5s assertion". Or, preferably, add a new agent `regula-performance` into Phase 6.

### H7. GitHub Actions CI Pipeline Has No Explicit Owner

**Severity:** High

**Evidence:**
- handoff README.md:832-839 specifies 7 CI steps (install/cache, Biome, typecheck, Vitest, Playwright, build, deploy preview).
- regula-architect.md covers scaffolding but does not mention `.github/workflows/`.
- regula/SKILL.md:183 Phase 6 task 5: "(architect) production deploy 준비 (Vercel config, env 정리, Sentry DSN, Langfuse 활성화)" — "Vercel config" is ambiguous; GitHub Actions pipeline is a separate concern.
- No agent mentions `ci.yml`, `preview.yml`, or `.github/workflows/*.yml` authoring.

**Remediation:** Add explicit responsibility "GitHub Actions CI/CD authoring (`.github/workflows/ci.yml`)" to regula-architect.md core roles, OR create a new `regula-devops` agent and add it to Phase 1 + Phase 6 teams.

## Medium Findings

### M1. §13.1 lucide-react Enforcement Not Guarded

**Severity:** Medium

**Evidence:** handoff README.md:719 "Replace with `lucide-react` in production" with 18+ icon-name mappings. Only regula-expert-review-gating/SKILL.md:104 imports a lucide icon. No skill contains the mapping table or forbids custom SVG. Frontend may drift to @heroicons or tabler-icons since moai-domain-uiux/SKILL.md:30 mentions multiple icon libraries as options.

**Remediation:** Add the icon mapping table to regula-design-tokens/SKILL.md or create an Icons subsection. Explicitly forbid non-lucide icon packages.

### M2. Visual Regression Testing Unowned

**Severity:** Medium

**Evidence:** handoff README.md:824 "Visual regression — Playwright screenshots or Chromatic — All pages, both themes". regula-compliance-qa.md tests list omits visual regression. No Storybook → Chromatic pipeline owner.

**Remediation:** Assign to regula-compliance-qa (Phase 6) with explicit deliverable `tests/visual/` + theme matrix.

### M3. Branch Strategy / PR-Required Gate Unowned

**Severity:** Medium

**Evidence:** handoff README.md:831 "trunk-based, short-lived branches, PR-required". No agent mentions CODEOWNERS, branch protection rules, or PR template.

**Remediation:** Assign to proposed regula-devops agent OR expand regula-architect.md with a Phase 1 task for `.github/CODEOWNERS` + branch protection GraphQL setup.

### M4. Rollback Strategy Unowned

**Severity:** Medium

**Evidence:** handoff README.md:842 "Vercel instant rollback + DB forward-only migrations with `down` scripts kept for 1 week". regula-backend.md:85 mentions "down 스크립트 포함, 1주일 보존" — partial. Vercel rollback procedure, schema-vs-code version skew handling unowned.

**Remediation:** Add rollback runbook ownership to regula-architect or proposed regula-devops.

### M5. regula-frontend "8개 View 페이지" Count Error

**Severity:** Medium

**Evidence:** regula-frontend.md:15 "8개 View 페이지 — Home, Chat(new/[id]), History, Templates(list/[id]), Knowledge Base, Regulatory Updates(list/[id]), Dashboard, Projects, Sources, Settings". The list contains Home, Chat, History, Templates, Knowledge Base, Regulatory Updates, Dashboard, Projects, Sources, Settings — that is 10, not 8. (§7 counts 11 screens including Onboarding + DocViewer modal.)

**Impact:** Ambiguity about which views are in scope. Implementation may skip Projects, Sources, or Settings because the count is "wrong".

**Remediation:** Update to "8+ View 페이지" or explicitly enumerate the correct count.

### M6. regula-citation-contract and regula-streaming-contract Boundary Ambiguity

**Severity:** Medium

**Evidence:**
- regula-citation-contract/SKILL.md:88 "HTML의 `data-source='N'`은 반드시 이 테이블의 `cite_index`와 일치해야 한다".
- regula-streaming-contract/SKILL.md:82-94 `SourcesEvent.items: Source[]` with `citeIndex: number`, and :271 "data-source의 index가 sources event의 citeIndex와 일치하는가".
- Both skills claim ownership of the data-source/cite_index contract. Which is authoritative if they ever disagree? A Phase 5 refactor that touches one will likely miss the other.

**Remediation:** Declare one as canonical (e.g., regula-streaming-contract owns event shape, regula-citation-contract owns HTML rendering + DB row coupling) and cross-reference from both with explicit handoff points.

## Low Findings

### L1. §13.3 Logo Finalization Unowned

**Severity:** Low

**Evidence:** handoff README.md:752 "Before production, have design team finalize a vector logo in SVG". Prototype uses CSS gradient (regula/SKILL.md not covered). No agent owns logo replacement pre-launch.

**Remediation:** Add Phase 6 launch-readiness checklist item: "logo vector asset finalized or CSS gradient approved as interim".

### L2. §13.4 Illustration Prohibition Not Encoded

**Severity:** Low

**Evidence:** handoff README.md:755 "If added later, commission rather than AI-generate — medical/regulatory audience is sensitive to generic AI imagery". No skill encodes a linter/QA check for AI-generated images in the codebase.

**Remediation:** Add to regula-design-tokens/SKILL.md prohibitions: "No AI-generated illustrations in `public/`". Add static check to regula-compliance-qa.md.

### L3. No Opus 4.7 Effort Level on Reasoning-Heavy Agents

**Severity:** Low (observability, not correctness)

**Evidence:** Grep `^effort:` across `.claude/agents/regula/` returns 0 matches. All six regula-* agents use bare `model: opus` without `effort: xhigh`. Project CLAUDE.md (user reasoning context — IGNORED per M1) and moai-constitution rule recommend xhigh for reasoning-intensive agents like compliance-qa.

**Note:** Per M1 Context Isolation, I cannot rely on CLAUDE.md for normative claims; this finding is based on the observable fact that the harness does not set effort and the handoff has no opinion on it. Marked Low because it is a tuning concern, not a coverage gap.

**Remediation:** Consider adding `effort: xhigh` to regula-compliance-qa and regula-rag-pipeline; `effort: high` elsewhere.

## Missing Agent/Skill Proposals

### New Agent 1: regula-security-audit

**Purpose:** Own implementation of OWASP Top 10 mitigations, CSP nonce pipeline, HSTS middleware, X-Frame-Options DENY, CSRF tokens, SSRF allowlist, parameterized query enforcement, and secrets rotation runbook. Separate from compliance-qa (which AUDITS the output).

**Prompt skeleton (outline):**
- Core roles: (1) `middleware.ts` implementing CSP nonce + HSTS + X-Frame-Options; (2) CSRF token flow for all POST/PATCH/DELETE; (3) SSRF allowlist for outbound HTTP (crawlers, webhooks); (4) SQL injection scan via grep for raw `db.execute(sql\`${...}\`)`; (5) Secrets rotation runbook `docs/runbooks/secrets-rotation.md`; (6) Pre-launch pen test checklist.
- Model: `opus`, effort: `xhigh`.
- Skills to inject: `regula-audit-compliance`, `moai-ref-owasp-checklist`.
- Team membership: Phase 5 (primary), Phase 6 (verification).

**Necessity evidence:** C1 establishes ownership collapse. Handoff README.md:796-810 has 11 security requirements; implementation ownership is currently 0.

### New Agent 2: regula-observability

**Purpose:** Wire Sentry (errors), Langfuse (LLM traces), PostHog (product analytics), structured logging. Distinct from Compliance-QA (which checks audit completeness) and RAG-Pipeline (which emits Langfuse spans).

**Prompt skeleton (outline):**
- Core roles: (1) Sentry SDK init in `app/layout.tsx` + server; (2) Langfuse SDK wrapper `lib/obs/langfuse.ts` used by rag-pipeline; (3) PostHog SDK for product analytics; (4) Structured logger `lib/obs/logger.ts`; (5) Alert rules (error rate, LLM cost anomaly, expert-queue backlog per handoff §18); (6) Dashboard templates.
- Model: `opus`.
- Team membership: Phase 5.

**Necessity evidence:** C1 shows Sentry/Langfuse double-owned and collapsed into compliance-qa. Handoff README.md:843 specifies three observability tools needing wiring.

### New Agent 3: regula-corpus-ingestion

**Purpose:** Own write-side of the corpus: chunking strategy, embedding generation, pgvector upsert, FDA/EU-MDR/MFDS/NMPA/PMDA crawlers, `update-monitor/run` cron, checksum-based dedup, source metadata ETL.

**Prompt skeleton (outline):**
- Core roles: (1) Chunking (token size 500, overlap 50, section-boundary preserving); (2) Embedding model selection + `lib/ingest/embed.ts`; (3) pgvector upsert with checksum dedup; (4) Per-regulator crawlers in `lib/ingest/crawlers/`; (5) `POST /api/admin/ingest/corpus` implementation; (6) `POST /api/admin/ingest/internal` SOP upload handler; (7) `POST /api/admin/update-monitor/run` orchestration.
- Model: `opus`, effort: `high`.
- Skills to inject: `regula-audit-compliance`, `regula-handoff-reader`.
- Team membership: Phase 2 (precondition, FDA corpus), Phase 5 (multi-corpus + update-monitor).

**Necessity evidence:** C3 establishes that §11.10 write-side and `source_sections.embedding vector(1536)` population have no owner.

### Optional New Skill 1: regula-rbac

**Purpose:** Document the ACL model (org_members role × project_members role × manager-vs-member ACL for dashboards). Currently backend.md:25 says "Row-Level Security" but no skill enumerates roles or escalation rules.

**Alternative:** Fold into regula-audit-compliance since RBAC and audit are coupled.

## Orchestrator Team 구성 권고

Diff vs. current regula/SKILL.md:

| Phase | Current | Proposed | Rationale |
|---|---|---|---|
| Phase 1 Foundation | architect, design-system, backend, compliance-qa | **+ corpus-ingestion (for DB schema coordination)**, optionally + observability (for env wiring) | Ingestion pipeline starts at scaffolding (pgvector + embedding-table DDL) |
| Phase 2 Chat core | frontend, rag-pipeline, backend, compliance-qa | **+ corpus-ingestion** (FDA corpus population is a precondition for Phase 2's "minimal RAG") | C3: retriever cannot return anything if corpus is empty |
| Phase 3 Structured | frontend, rag-pipeline, compliance-qa | same | No change needed |
| Phase 4 Breadth | frontend, backend, compliance-qa | **+ design-system** | H1: new views introduce new tokens |
| Phase 5 Enterprise | backend, rag-pipeline, design-system, compliance-qa | **+ frontend**, **+ security-audit (new)**, **+ observability (new)**, **+ corpus-ingestion (for update-monitor)** | H2 + C1 + C3 |
| Phase 6 Quality | compliance-qa (lead) + architect, backend | **+ rag-pipeline** (LLM eval iteration requires prompt changes), **+ security-audit**, optionally + performance (load test, H6) | H6 + C1 |

## Chain-of-Verification Pass

Second-look findings after re-reading each harness file:

**Additional defects discovered on second pass:**

- **V1 (additional Medium):** regula-rag-pipeline.md:22 "Langfuse 로깅 — 모든 LLM call을 Langfuse에 trace로 기록" and regula-audit-compliance/SKILL.md:16 "Observability와 분리. Sentry/PostHog은 버그 추적용. audit_logs는 규제 준수용. 절대 대체 관계 아님" — this boundary is correctly stated at skill level but regula/SKILL.md:170 violates it by assigning Sentry/Langfuse wiring to compliance-qa (an audit-only agent). Reinforces C1.

- **V2 (additional Low):** regula-handoff-reader/SKILL.md does not declare `allowed-tools` or `user-invocable` — which is fine per its descriptive nature, but inconsistent with regula-citation-contract/SKILL.md et al which also omit them. Skill frontmatter parity check: all seven regula-* skills use only `name` + `description` — again minimal but consistent. Not escalating.

- **V3 (reinforces C2):** regula-frontend.md:12 "Shell 구현" + :14 "Chat 파이프라인 컴포넌트" + :15 "8개 View 페이지" + :16 "공유 프리미티브" + :17 "useStreamingAnswer 훅" + :18 "Zustand 스토어" + :19 "반응형 브레이크포인트" — 7 core roles enumerated. Onboarding is not in any of them. Regression of C2 confirmed through systematic re-read.

- **V4 (new Low):** regula-compliance-qa.md:3 says "general-purpose 타입 (검증 스크립트 실행 필요)" — agent-type hint but frontmatter has no `tools:` nor does it mention `Agent(subagent_type: "general-purpose")`. Orchestrator regula/SKILL.md:25 notes "모두 `model: opus`, `general-purpose` agent_type 사용" — consistent, but no harness-level enforcement.

- **V5 (reinforces H5):** Re-check of regula-frontend.md outputs (lines 40-44) vs handoff §17 Component testing: Storybook indeed absent from both frontend and compliance-qa. Confirmed.

**Sections re-read end-to-end to verify thoroughness:** handoff README §7.1 through §7.11 (lines 324-467), §8.1 through §8.10 (lines 473-515), §11.1 through §11.10 (lines 606-682), §13.1 through §13.4 (lines 718-755), §14 (759-770), §16 (796-810), §17 (814-824), §18 (828-843). All regula-* agent files (6) read completely. All regula-* skill files (7) + orchestrator (regula/SKILL.md) read completely.

**No defects flipped from FAIL to PASS on second review.** Several findings strengthened (C1, C2). No findings removed.

## Conclusion

**Phase 2 entry: BLOCKED as-is.**

Before Phase 2 can proceed:
1. C4 (skills frontmatter wiring) must be fixed — otherwise agents run without their domain rules loaded, and regula-streaming-contract / regula-citation-contract become decorative.
2. C3 (corpus ingestion ownership) must be resolved — without it, Phase 2's "minimal RAG pipeline (FDA corpus 1개만 연결)" is unachievable because no one owns populating the FDA corpus.
3. C2 (Onboarding) is not a Phase 2 blocker (Onboarding is Phase 4 work) but must be docketed into a specific Phase before Phase 4 or it will be silently dropped.
4. C1 (security + observability ownership collapse) is not a Phase 2 blocker but MUST be resolved before Phase 5 or the enterprise-hardening phase will lack implementers for CSP, HSTS, CSRF, Sentry, Langfuse wiring.

**Blocking (must fix before Phase 2):**
- C3 (corpus-ingestion agent creation OR explicit ingestion task assignment to existing rag-pipeline + backend combination)
- C4 (skills: frontmatter or explicit skill-loading instruction in agent bodies)

**Must fix before Phase 4:**
- C2 (Onboarding ownership)
- H1 (design-system in Phase 4)

**Must fix before Phase 5:**
- C1 (security + observability agents)
- H2 (frontend in Phase 5)
- H4 (secrets rotation)

**Must fix before Phase 6:**
- H6 (load test ownership)
- H7 (CI/CD pipeline ownership)

**High-priority but non-blocking:**
- H3 (keyboard shortcuts — Phase 4)
- H5 (Storybook — Phase 2/3)
- M1, M2, M3, M4, M5, M6 — fix opportunistically

**Low (no gate):**
- L1, L2, L3 — pre-launch cleanup

Recommended sequence: (1) patch C4 harness-wide in one sitting (add `skills:` array to 6 agent files); (2) create regula-corpus-ingestion agent and add to Phase 1/2/5 teams; (3) insert explicit Onboarding task into Phase 4; (4) author regula-security-audit and regula-observability agents and re-compose Phase 5/6 teams per the proposed diff above. Only after these four patches is the harness sufficient to execute Phase 2 through Phase 6 without known structural gaps.
