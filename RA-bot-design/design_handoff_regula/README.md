# Handoff: Regula — RA (Regulatory Affairs) Expert System

> **For Claude Code / Developer:** Read this document fully before writing any code. This is a complete specification package for recreating a designed product in a production codebase.

---

## 📋 Table of Contents

1. [Overview](#1-overview)
2. [About the Design Files](#2-about-the-design-files)
3. [Fidelity](#3-fidelity)
4. [Recommended Tech Stack](#4-recommended-tech-stack)
5. [Project Structure](#5-project-structure)
6. [Design Tokens](#6-design-tokens)
7. [Screens & Views](#7-screens--views)
8. [Shared Components](#8-shared-components)
9. [Interactions & Behavior](#9-interactions--behavior)
10. [State Management](#10-state-management)
11. [Backend Integration & API Contracts](#11-backend-integration--api-contracts)
12. [Data Models](#12-data-models)
13. [Assets & Icons](#13-assets--icons)
14. [Accessibility](#14-accessibility)
15. [Performance & SEO](#15-performance--seo)
16. [Security & Compliance](#16-security--compliance)
17. [Testing Strategy](#17-testing-strategy)
18. [Deployment & DevOps](#18-deployment--devops)
19. [Suggested Additional Features](#19-suggested-additional-features)
20. [Implementation Roadmap](#20-implementation-roadmap)
21. [Files in this Handoff](#21-files-in-this-handoff)

---

## 1. Overview

**Regula** is a web-based AI expert system for medical device Regulatory Affairs (RA). Users — primarily non-RA specialists in Development / Quality departments — submit regulatory questions; the system retrieves from official regulatory corpora (FDA, EU MDR, MFDS, NMPA, PMDA, ISO/IEC) plus internal SOPs, and returns structured, cited answers with actionable checklists, comparative tables, timelines, and downloadable reports.

**Target audience:**
- Primary: Dev/QA teams asking RA questions (non-experts)
- Secondary: Internal RA leads reviewing flagged answers
- Tertiary: Overseas dealers requesting regulatory clarifications

**Core value propositions:**
1. **Evidence-first**: every claim has an inline citation to a primary source
2. **Context-aware**: answers reflect the user's current project, product class, target market
3. **Expert-reviewable**: low-confidence or high-stakes answers auto-flag for human RA review
4. **Actionable**: not just text — checklists, comparison tables, submission timelines, templates

---

## 2. About the Design Files

The files in `design_files/` are **design references created in HTML with React (via in-browser Babel)**. They are **prototypes** demonstrating intended look, structure, and interaction — **not production code to copy directly**.

- `Regula RA System.html` is the entry point — open it in a browser to see the full prototype
- `src/*.jsx` files are split by concern (views, shell, modals, data, icons)
- `styles/tokens.css` contains all design tokens as CSS custom properties
- `styles/components.css` contains all component-level styles

**Your task:** Recreate these designs in a new production Next.js codebase using the stack recommended below. Use the HTML files as the source of truth for layout, spacing, colors, typography, and interaction patterns. Do not ship the HTML.

---

## 3. Fidelity

**High-fidelity (Hi-fi).** Every color, spacing value, typography choice, and micro-interaction in the design has been deliberated. Implementation should be **pixel-accurate** to the prototype. Exact values are documented in Section 6 (Design Tokens) and Section 7 (Screens & Views).

Where the prototype uses seed data (sample questions, fake user names, placeholder citations), treat these as illustrative — real implementation will wire to backend APIs (Section 11).

---

## 4. Recommended Tech Stack

Recommended **modern production stack** for this project:

### Frontend
| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | SSR for SEO, built-in routing, server actions, edge-ready |
| Language | **TypeScript 5.4+** | Type safety critical for regulatory data models |
| UI Library | **React 18** | Industry standard |
| Styling | **Tailwind CSS v4** + CSS Variables | Tokens map 1:1 to `tokens.css` via `@theme` |
| Component Primitives | **Radix UI** (headless) | A11y-compliant modals, dropdowns, tabs |
| Icons | **lucide-react** | Line-icon system matches prototype style |
| Forms | **React Hook Form + Zod** | Schema validation for question submission |
| State (client) | **Zustand** | Lightweight; UI state, current project, theme |
| State (server) | **TanStack Query v5** | Caching, optimistic updates for chat |
| Streaming | **Vercel AI SDK (`ai` package)** | Token-by-token answer streaming |
| Rich rendering | **react-markdown + rehype-raw** | Citation-tagged markdown from LLM |
| Charts | **Recharts** | Dashboard stat bars, timelines |
| Virtualization | **TanStack Virtual** | History/Knowledge Base long lists |
| Animation | **Framer Motion** | Micro-interactions |
| Fonts | **next/font/google** — IBM Plex Sans, IBM Plex Mono, Source Serif 4, Noto Serif KR |

### Backend
| Layer | Choice | Rationale |
|---|---|---|
| Runtime | **Node.js 20 LTS** | Long-term support |
| API | **Next.js Route Handlers + Server Actions** | Co-located with frontend |
| LLM Orchestration | **LangChain** or **LlamaIndex** (TS) | RAG pipelines |
| LLM Provider | **Anthropic Claude Sonnet 4.5** + **Claude Haiku 4.5** | Sonnet for main reasoning, Haiku for classification/routing |
| Vector DB | **pgvector** (on Postgres) or **Pinecone** | Hybrid search on regulatory corpus |
| Database | **PostgreSQL 16** (via **Supabase** or **Neon**) | Relational core |
| ORM | **Drizzle ORM** | Type-safe, lightweight |
| Auth | **Auth.js (NextAuth v5)** with SSO (Microsoft/Google) | Enterprise IDP ready |
| Object Storage | **S3 / R2** | Document originals, user uploads |
| Queue | **Inngest** or **Trigger.dev** | Async doc ingestion, regulatory update scraping |
| Full-text Search | **Postgres FTS** or **Meilisearch** | Fallback for keyword queries |
| Observability | **Sentry** (errors) + **PostHog** (product analytics) + **Langfuse** (LLM traces) | |

### Infra / DevEx
| Layer | Choice |
|---|---|
| Hosting | **Vercel** (frontend) + **Railway / Fly.io** (worker services) or full **AWS** if compliance requires |
| CI/CD | **GitHub Actions** |
| Package manager | **pnpm** |
| Monorepo (if needed) | **Turborepo** |
| Linting / Formatting | **Biome** (replaces ESLint + Prettier) |
| Testing | **Vitest** (unit) + **Playwright** (e2e) + **Storybook** (component) |
| Compliance logging | Every LLM call + every source access logged for audit |

---

## 5. Project Structure

```
regula/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── sso/callback/route.ts
│   ├── (app)/                       # Authenticated shell
│   │   ├── layout.tsx               # Sidebar + Topbar wrapper
│   │   ├── page.tsx                 # Home
│   │   ├── chat/
│   │   │   ├── page.tsx             # New consultation
│   │   │   └── [conversationId]/page.tsx
│   │   ├── history/page.tsx
│   │   ├── templates/
│   │   │   ├── page.tsx
│   │   │   └── [templateId]/page.tsx
│   │   ├── knowledge/page.tsx       # Knowledge Base
│   │   ├── updates/
│   │   │   ├── page.tsx
│   │   │   └── [updateId]/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── projects/[projectId]/page.tsx
│   │   ├── sources/[sourceId]/page.tsx
│   │   └── settings/page.tsx
│   ├── api/
│   │   ├── ra/consult/route.ts      # Main RAG endpoint (streaming)
│   │   ├── ra/conversations/route.ts
│   │   ├── ra/sources/route.ts
│   │   ├── ra/templates/route.ts
│   │   ├── ra/updates/route.ts
│   │   ├── ra/projects/route.ts
│   │   └── ra/expert-review/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── shell/
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   └── UserMenu.tsx
│   ├── chat/
│   │   ├── Composer.tsx
│   │   ├── Thinking.tsx             # Streaming trace animation
│   │   ├── AnswerBlock.tsx
│   │   ├── ConfidenceBadge.tsx
│   │   ├── Citation.tsx
│   │   ├── SourceCard.tsx
│   │   ├── SourcesGrid.tsx
│   │   ├── Checklist.tsx
│   │   ├── ComparisonTable.tsx
│   │   ├── Timeline.tsx
│   │   ├── SuggestedFollowups.tsx
│   │   └── RightContextPanel.tsx
│   ├── views/
│   │   ├── HomeView.tsx
│   │   ├── HistoryView.tsx
│   │   ├── TemplatesView.tsx
│   │   ├── UpdatesView.tsx
│   │   ├── DashboardView.tsx
│   │   ├── SourcesView.tsx
│   │   └── DocViewer.tsx            # Modal source viewer
│   ├── onboarding/
│   │   └── OnboardingModal.tsx
│   ├── primitives/                  # Wrapped Radix
│   │   ├── Button.tsx
│   │   ├── IconButton.tsx
│   │   ├── Chip.tsx
│   │   ├── Dialog.tsx
│   │   ├── Dropdown.tsx
│   │   └── Callout.tsx
│   └── icons/Icon.tsx
├── lib/
│   ├── ai/
│   │   ├── consult.ts               # Main RAG orchestration
│   │   ├── retrievers/              # Per-corpus retrievers
│   │   │   ├── fda.ts
│   │   │   ├── eu-mdr.ts
│   │   │   ├── mfds.ts
│   │   │   └── internal.ts
│   │   ├── prompts.ts
│   │   ├── confidence.ts            # Confidence scoring
│   │   ├── expert-review.ts         # Flagging heuristics
│   │   └── streaming.ts
│   ├── db/
│   │   ├── schema.ts                # Drizzle schema
│   │   ├── queries.ts
│   │   └── client.ts
│   ├── auth.ts
│   ├── i18n.ts
│   └── utils.ts
├── hooks/
│   ├── useConversation.ts
│   ├── useTheme.ts
│   ├── useProject.ts
│   └── useStreamingAnswer.ts
├── stores/
│   ├── ui.ts                        # Sidebar collapsed, tweaks
│   └── conversation.ts
├── styles/
│   └── tokens.css                   # Mapped to Tailwind @theme
├── public/
│   └── fonts/                       # Self-hosted font subsets (optional)
├── tests/
│   ├── unit/
│   ├── e2e/
│   └── fixtures/
├── .env.example
├── drizzle.config.ts
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── biome.json
├── package.json
└── README.md
```

---

## 6. Design Tokens

**Source of truth:** `design_files/styles/tokens.css`. Map to Tailwind v4 via `@theme` in `styles/tokens.css`:

### Brand — Deep Navy
| Token | Hex | Usage |
|---|---|---|
| `brand-900` | `#0a1628` | Dark inverse surfaces |
| `brand-800` | `#0f1e3a` | Primary button bg |
| `brand-700` | `#16294f` | Primary button hover, text-brand |
| `brand-600` | `#1f3a6b` | Primary accent |
| `brand-500` | `#2b4d8a` | Focus rings |
| `brand-400` | `#4a6fa8` | Tertiary accent |
| `brand-300` | `#7e9bc4` | Muted brand |
| `brand-200` | `#c5d2e5` | Brand borders |
| `brand-100` | `#e6ecf5` | Citation badge bg |
| `brand-50` | `#f4f7fb` | Subtle brand surface |

### Accent — Regulatory Amber (use sparingly, for citations/highlights)
| Token | Hex |
|---|---|
| `amber-700` | `#8a5a00` |
| `amber-600` | `#b27300` |
| `amber-500` | `#d89400` — primary amber |
| `amber-400` | `#e6ab33` |
| `amber-100` | `#fdf3d9` |
| `amber-50` | `#fffaed` |

### Semantic
| Token | Hex | Usage |
|---|---|---|
| `success` | `#0f7a4d` | High confidence, check-complete |
| `success-bg` | `#e6f4ed` | |
| `warn` | `#a85c00` | Medium confidence |
| `warn-bg` | `#fdf1de` | |
| `danger` | `#a8142b` | Low confidence, errors |
| `danger-bg` | `#fce8eb` | |

### Neutrals (warm cool gray — document feel)
`ink-950` `#0c1116` → `ink-50` `#f7f9fb`. Full ladder in `tokens.css`.

### Typography
| Token | Value |
|---|---|
| `--font-sans` | `'IBM Plex Sans', 'Pretendard', ui-sans-serif, system-ui, sans-serif` |
| `--font-serif` | `'Source Serif 4', 'Noto Serif KR', Georgia, serif` |
| `--font-mono` | `'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace` |

**Serif usage:** H1 headings, document viewer body, stat values, user questions in chat, quoted regulatory text. The serif/sans contrast is a core brand differentiator — do not replace with sans-only.

### Type Scale
`--fs-xs` 11 → `--fs-5xl` 48. Base body = 14px; chat messages 15px; hero 32–48px.

### Spacing — 4px base
`--s-1` 4 → `--s-12` 96

### Radii
`--r-xs` 4 → `--r-2xl` 20, plus `--r-full` 999

### Shadows
5-step scale `shadow-xs` → `shadow-xl`, tuned with navy-tinted rgba

### Layout Constants
- `--nav-w: 260px`
- `--topbar-h: 56px`
- `--right-w: 360px` (context panel)
- `--content-max: 840px` (chat column)

### Motion
- `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` — entrances
- `--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)` — state
- Duration: `120ms / 200ms / 320ms`

### Dark Mode
Full dark variant defined under `[data-theme="dark"]` in `tokens.css`. Toggle via `document.documentElement.setAttribute('data-theme', ...)`. Persist in localStorage + user profile.

---

## 7. Screens & Views

> All screens sit inside the shell (Sidebar 260px + Topbar 56px). Content column max 840px centered for reading screens, 1240px for list/grid screens.

### 7.1 Shell — Sidebar

**Layout:** fixed width 260px, full height, `border-right: 1px solid var(--border-subtle)`.

**Composition (top → bottom):**
1. **Header** (56px, matches topbar height)
   - 28×28 gradient logo mark (`#0f1e3a → #1f3a6b`) with 6px amber dot bottom-right
   - "Regula" (serif, 18px, 500)
   - "RA · Med Device" tag (11px, uppercase, tracked 0.08em, muted)
2. **New consultation button** — outlined, with `⌘ K` kbd hint
3. **Search input** — compact, icon prefix, subtle bg
4. **Nav list** — `Home · New Consultation · History · Templates · Knowledge Base · Regulatory Updates · Dashboard`
   - Active state: `bg-active` + 2px brand-600 left accent bar
   - Badges for counts (Templates 6, Updates 4)
5. **Projects section** — colored dot + title + count (tabular numerals)
6. **Footer** — user avatar (gradient) + name + role (e.g., "QA / 개발팀 · Pro") + settings cog

**Mobile:** hidden by default, slide-in from left as overlay when menu icon tapped.

### 7.2 Shell — Topbar

**Layout:** 56px height, `border-bottom`, horizontal flex.

**Composition (left → right):**
- Breadcrumb: `Workspace › <current section>`
- Spacer
- Theme toggle icon button (sun/moon)
- Share icon button
- **전문가 검토** button (shield icon + label) — always visible, accent brand

### 7.3 Home

**Purpose:** Primary landing; quick start + recent activity.

**Composition:**
1. **Hero** (centered, top padding 72px)
   - Eyebrow pill: green pulse dot + "최신 규제 데이터 · 2026-04-22 기준" (mono date)
   - H1: `무엇을 <em>검토</em>해 드릴까요?` (serif, 48px, italic accent in brand-700)
   - Sub: "의료기기 규제 문서·표준·사내 자료를 교차 분석하여 근거 기반의 솔루션을 제공합니다." (18px, tertiary)
   - **Quick grid** (4 cards, 2×2 on desktop): icon in tinted square + title + description. Clicking pre-fills composer with matching question.

2. **최근 질의** section (label with 3px brand bar prefix)
   - 4 most recent — flat rows with message icon, question, `프로젝트 · 시간 · N citations` meta

3. **빠른 템플릿** — 3-card grid preview (full list at /templates)

### 7.4 Chat / New Consultation

**Most important screen.** Two-column split: `1fr` (main) + `360px` (right context panel, hidden on <1100px).

#### Main Column

**Empty state:**
- Hero `새로운 <em>상담</em>` (serif 36px)
- Sub prompt
- Composer sticky bottom

**When messages exist — for each turn:**
1. **User question** — serif 26px, weight 500, letter-spacing -0.01em
2. **If streaming:** Thinking trace box
   - Title: "분석 중" + pulsing dots animation
   - Per-step list: mono 12px, spinner → check icon transition, reveals one step every 700ms
3. **If complete: AnswerBlock** (see 8.3)

**Composer (sticky bottom, max-width 840px):**
- White card, 12px radius, shadow-md, focus-ring on internal focus
- Textarea — 16px font, placeholder, auto-grow to 200px max
- Action row (below textarea):
  - Chips: `전체 소스 / 규제만 / 사내 SOP / 파일 첨부` (active state: brand-50 bg + brand-200 border)
  - Submit button (right) — 34×34 brand-800 square with send/loader icon
- Foot: "Shift + Enter 줄바꿈 · Enter 전송" + mono model version

#### Right Context Panel

Three sections, each with uppercase section label:
1. **현재 프로젝트** — colored card with project dot, name, Class · NB · Submission date
2. **활용 출처** — compact list of top 5 sources (index badge + title + org · year)
3. **관련 규제 업데이트** — 3 items, colored left border (amber for high-impact), date · region in mono

### 7.5 History

**Purpose:** All past consultations, filterable.

- Header: `상담 이력` (serif 32px) + count subtitle + filter chips (`전체 / 진행중 / 보관`)
- List: single card container, rows separated by subtle border
- Each row: 32×32 message icon tile + serif 16px question + meta line (project · time · citations) + chevron right on hover

### 7.6 Templates

**Purpose:** Reusable submission document templates.

- Header: `템플릿` + description
- 3-column grid (auto-fill, min 260px)
- Each card: tinted icon tile + title + description + footer (mono region tag | uses count)

### 7.7 Knowledge Base (Sources)

**Purpose:** Transparency into what Regula knows.

- Header: `지식 베이스`
- Grouped by: **공식 규제 기관 / 국제 표준 / 사내 지식**
- Per-source card: icon + name + count badge + description + "Synced · 2분 전" status pill

### 7.8 Regulatory Updates

**Purpose:** Personalized feed of regulation changes affecting user's products.

- Header: `규제 업데이트`
- Vertical list of cards. Each card:
  - Left accent border (3px): amber for `HIGH IMPACT`, brand-400 otherwise
  - Meta row: region chip (mono, brand-50) + mono date + optional `HIGH IMPACT` tag (amber-700)
  - Serif 18px title
  - `영향 제품군: <bold product list>`
  - Actions: `영향도 분석` (sparkle) + `원문 보기` (file) buttons

### 7.9 Dashboard

**Purpose:** Team-level activity overview.

- Header + period subtitle
- **Stat grid** (4 cards): label (uppercase) + serif 32px value + delta (up/down arrow, success/danger color, `+18% vs 지난달`)
- 2-column row:
  - **질의 유형별 분포** (2fr) — horizontal bars with labels, colored bars, tabular count
  - **규제 소스 커버리지** (1fr) — dot + label + mono count rows
- **팀 최근 활동** — full-width card, avatar rows

### 7.10 Document Viewer (Modal)

**Opens when:** user clicks any citation or source card.

- Full-screen overlay (navy 50%), centered panel max-width 1200
- **Header bar:** source index badge, org · year meta, title (truncated), `원문` button, close icon
- **Body split:** 260px doc nav (anchors) + scrolling main
- **Main content:** source badge pill (`REGULATION (EU) 2017/745 · MDR`) → serif doc title → metadata row → serif body with highlighted relevant passage (amber underline + amber-100 bg on the cited sentence)

### 7.11 Onboarding (First Visit)

4-step modal, 520px wide, centered:
1. 환영합니다 — shield icon
2. 출처 중심 — book icon
3. 프로젝트 컨텍스트 — folder icon
4. 안전 장치 (전문가 검토) — alert icon

Bottom bar: step dots (active expanded to 18px width) · `건너뛰기` · `다음 →`. localStorage `regula_onboarded=1` on completion.

---

## 8. Shared Components

### 8.1 Citation `<sup class="cite">N</sup>`
Monospace 10px, weight 600, brand-100 bg, brand-700 text, 3px radius. Hover → brand-600 bg white text. Click → opens DocViewer for that source. Every claim in LLM output must be wrapped; enforce via prompt + post-processing.

### 8.2 ConfidenceBadge
Three levels: `high` (green), `med` (amber), `low` (red). Pill with colored dot + label + percentage. Placed in `answer-meta` row.

### 8.3 AnswerBlock (composite)
Top-to-bottom order:
1. **Meta row**: ConfidenceBadge · "N 출처" · "분석 X.Xs" · actions (copy, download, thumb, regenerate)
2. **Expert-review callout** (amber) — shown conditionally
3. **Section label: 요약 답변**
4. **Prose** — 15px line-height 1.65, citations inline as `<sup>`
5. **Section label: 핵심 체크리스트** + completion counter
6. **Checklist** — toggleable rows with ref tag (mono badge)
7. **Section label: 주요 관할권별 비교**
8. **Comparison table** — sticky first column bg, region-chip headers
9. **Section label: 실행 타임라인**
10. **Timeline** — vertical line with dots (amber for current), date/title/desc
11. **Section label: 출처 (N)**
12. **Sources grid** — 240px min cards
13. **Section label: 이어서 질문하기**
14. **Suggested follow-up pills**

### 8.4 SourceCard
Index badge (brand-100 mono) + uppercase org + type pill (color-coded by type) + 2-line clamped title + mono year + external-link icon. Hover: lift 1px, border-strong, shadow-sm.

### 8.5 Checklist Row
16×16 checkbox (radius 4), border-strong → fills success when done. Label + `tag` ref badge (mono in bg-surface-2).

### 8.6 ComparisonTable
Full-width table, first column styled like header (bg-surface-2 right border). Region chips in `<th>`. Vertical-align top for long cells.

### 8.7 Timeline
Left vertical 1px line, 9px bullets (`bg-surface` fill with 2px brand border). `.current` item: fully amber. Date mono, title 13px, desc 11px tertiary.

### 8.8 Callout
Three variants: `info` (brand-tinted), `warn` (amber-tinted), `expert` (amber, stronger). Icon + bold title + body.

### 8.9 Chip / Button / IconButton
Standard sizes (sm/md), variants (primary/ghost/accent/default). Keep hover transitions at 120ms.

### 8.10 SuggestionPill
Rounded-full, border-subtle → hovering adds brand-400 border + brand-50 fill. Plus icon prefix.

---

## 9. Interactions & Behavior

### 9.1 Chat submission flow
1. User types in Composer; Enter (no shift) submits; Shift+Enter newline
2. Optimistically add user message to UI
3. Open SSE / fetch-stream to `/api/ra/consult`
4. Phase A — **Trace steps** stream first (each step ≥500ms apart for perceptibility)
5. Phase B — **Answer tokens** stream into prose
6. Phase C — **Post-answer structured blocks** arrive (checklist, comparison, timeline, sources) as JSON deltas
7. Citations in prose are clickable from the moment they render

### 9.2 Citation click
- Opens DocViewer modal
- Scrolls to highlighted paragraph; URL hash `#source=N&offset=M` for deep linking

### 9.3 Expert review flag
- Automatic: confidence < 0.7, or query hits policy-blocked keywords (contains "임상시험 면제", "응급", etc.)
- Manual: topbar "전문가 검토" button posts current conversation to `/api/ra/expert-review`
- Confirmation toast; appears in expert queue

### 9.4 Project context
- Sidebar project click sets current project (zustand)
- All subsequent questions include `projectId` in request; RAG retriever filters/weights internal docs accordingly
- Right panel header reflects selected project

### 9.5 Theme toggle
- Topbar or Tweaks panel
- Set `data-theme` on `<html>`, persist `ui.theme` in user profile + localStorage
- `prefers-color-scheme` respected on first visit

### 9.6 Keyboard shortcuts
- `⌘/Ctrl + K` — new consultation (focus composer)
- `⌘/Ctrl + /` — toggle sidebar
- `⌘/Ctrl + J` — open command palette (future)
- `Esc` — close modal/doc viewer

### 9.7 Responsive breakpoints
- `>=1100px` — full split (main + right panel)
- `900–1099px` — hide right panel, main expands
- `720–899px` — hide sidebar, burger menu in topbar
- `<720px` — mobile layout, composer fills viewport, quick grid → 1 col

### 9.8 Animations
- Trace steps: 200ms fade + 4px translateY up
- Message entry: 300ms ease-out
- Thinking dots: `tdot` keyframe 1.2s infinite
- Hover elevation: 120ms ease-out `translateY(-1px)` + shadow
- All transitions respect `prefers-reduced-motion`

---

## 10. State Management

### 10.1 Global (Zustand)
```ts
// stores/ui.ts
{
  theme: 'light' | 'dark',
  sidebarCollapsed: boolean,
  currentProjectId: string | null,
  tweaksOpen: boolean,
  onboardingDone: boolean,
}
```

### 10.2 Server-synced (TanStack Query)
- `useConversations()` — list
- `useConversation(id)` — detail with messages
- `useProjects()`, `useProject(id)`
- `useTemplates()`
- `useSources()` — knowledge base
- `useUpdates()` — regulatory updates feed
- `useDashboardStats()`

### 10.3 Streaming chat
Custom hook `useStreamingAnswer`:
- Accepts question + context (projectId, filters)
- Manages SSE connection with abort controller
- Exposes `{ status, traceSteps[], prose, structured, error }`
- On finish, invalidates conversation list query

---

## 11. Backend Integration & API Contracts

All endpoints are **Next.js Route Handlers** under `/api/ra/*`. Auth via session cookie (Auth.js). Requests/responses typed via Zod schemas shared between client + server.

### 11.1 `POST /api/ra/consult` (streaming)

**Request:**
```ts
{
  question: string,
  conversationId?: string,          // null = new conversation
  projectId?: string,
  sourceFilter: 'all' | 'regs' | 'internal',
  attachments?: { fileId: string }[],
  locale: 'ko' | 'en',
}
```

**Response: Server-Sent Events**, each event is JSON:
```ts
// 1. Conversation metadata (first)
{ type: 'meta', conversationId: string, messageId: string }

// 2. Retrieval trace (one per step)
{ type: 'trace', step: string, status: 'active' | 'done' }

// 3. Prose streaming (token by token)
{ type: 'prose_delta', delta: string }

// 4. Structured payload (after prose complete)
{ type: 'confidence', level: 'high'|'med'|'low', score: number }
{ type: 'sources', items: Source[] }
{ type: 'checklist', items: ChecklistItem[] }
{ type: 'comparison', title: string, cols: string[], rows: string[][] }
{ type: 'timeline', items: TimelineItem[] }
{ type: 'related', items: string[] }
{ type: 'expert_review_required', reason: string }

// 5. Terminal
{ type: 'done', duration_ms: number }
{ type: 'error', code: string, message: string }
```

**Backend pipeline:**
1. Classify intent with Haiku (regulation-lookup / strategy / comparison / etc.)
2. Rewrite query for retrieval (expand acronyms, add synonyms)
3. Hybrid search: vector (pgvector) + FTS, with per-corpus retrievers
4. Re-rank with Cohere Rerank or cross-encoder
5. Format retrieved chunks into prompt with strict citation rules
6. Stream answer from Sonnet 4.5
7. Post-process: extract citations, compute confidence, decide expert-review flag
8. Persist to DB; log to Langfuse

### 11.2 `GET /api/ra/conversations`
Paginated list. Filters: `projectId`, `status` (active/archived), `q` (search).

### 11.3 `GET /api/ra/conversations/[id]`
Full detail incl. all messages, structured blocks, sources.

### 11.4 `POST /api/ra/conversations/[id]/feedback`
`{ messageId, rating: 'up'|'down', comment?: string }`

### 11.5 `GET /api/ra/sources/[id]`
Returns full document with section anchors. Supports `?offset=N` for deep linking.

### 11.6 `GET /api/ra/templates`, `GET /api/ra/templates/[id]/download`
Returns `.docx` or `.pdf` binary.

### 11.7 `GET /api/ra/updates`
Feed personalized by user's products: `{ items: [...], nextCursor }`.

### 11.8 `POST /api/ra/expert-review`
Submit conversation + optional message IDs for human RA lead review. Returns ticket id.

### 11.9 `GET /api/ra/dashboard`
Team metrics. Respects ACL (manager vs. member).

### 11.10 Ingestion (internal / admin only)
- `POST /api/admin/ingest/corpus` — schedule re-ingest of a regulatory corpus
- `POST /api/admin/ingest/internal` — upload SOP or past filing
- `POST /api/admin/update-monitor/run` — manual crawl of regulator websites

---

## 12. Data Models

Drizzle schema sketch (Postgres):

```ts
users              (id, email, name, role, locale, theme_pref, created_at)
organizations      (id, name, tier)
org_members        (org_id, user_id, role)
projects           (id, org_id, name, device_class, target_markets[], color, submission_date, status)
project_members    (project_id, user_id)
conversations      (id, project_id, user_id, title, status, created_at, archived_at)
messages           (id, conversation_id, role, content_prose, confidence_level, confidence_score,
                    duration_ms, expert_review_required, created_at)
message_sources    (message_id, source_id, relevance_score, quoted_offset, quoted_length, cite_index)
message_blocks     (message_id, block_type enum, block_json)  -- checklist, comparison, timeline, related
checklist_items    (id, message_id, title, ref, completed, completed_by, completed_at)
sources            (id, org_label, title, year, type, region, url, full_text_tsv, embedding vector(1536))
  -- type: Regulation|Guidance|Standard|Industry|Internal
source_sections    (id, source_id, anchor, heading, text, embedding vector(1536))
templates          (id, title, description, region, category, file_key, usage_count)
regulatory_updates (id, title, region, severity, published_at, source_url, affected_product_types[],
                    impact_analysis_text)
user_product_filters (user_id, product_types[], regions[])
expert_reviews     (id, conversation_id, requested_by, assigned_to, status, notes)
audit_logs         (id, actor_id, action, resource_type, resource_id, meta_json, created_at)
  -- every source access, every consult, every expert flag — for 21 CFR Part 11 audit
```

---

## 13. Assets & Icons

### 13.1 Icons
Prototype uses custom SVG set (`src/Icon.jsx`). **Replace with `lucide-react`** in production — the visual style matches (1.75px stroke, rounded caps). Mapping:

| Prototype name | lucide name |
|---|---|
| search | Search |
| plus | Plus |
| send | SendHorizonal |
| sparkle | Sparkles |
| shield | ShieldCheck |
| book | BookOpen |
| folder | FolderOpen |
| file | FileText |
| clock | Clock |
| globe | Globe |
| alert | AlertCircle |
| layers | Layers |
| database | Database |
| bar | BarChart3 |
| workflow | Workflow |
| flag | Flag |
| history | History |
| bookmark | Bookmark |
| ...etc | see Icon.jsx for full list |

### 13.2 Fonts
All via `next/font/google`:
- IBM Plex Sans (400/500/600/700)
- IBM Plex Mono (400/500/600)
- Source Serif 4 (400/500/600 + italic 400/500)
- Noto Serif KR (400/500/600)
- Pretendard — not on Google Fonts; self-host via `@fontsource-variable/pretendard` npm package

### 13.3 Logo
Current: CSS gradient "R" mark with amber dot. **Before production, have design team finalize a vector logo** in SVG. Budget: square mark + wordmark variants, monochrome fallback.

### 13.4 Illustrations / imagery
None in current prototype. If added later, commission rather than AI-generate — medical/regulatory audience is sensitive to generic AI imagery.

---

## 14. Accessibility

- **WCAG 2.1 AA minimum** — essential for enterprise + regulated industry buyers
- All interactive elements keyboard-operable; visible focus ring (brand-500 3px `--ring-focus`)
- Color contrast: verified in both themes for all foreground/background pairs
- Screen reader:
  - Citation `<sup>` → `aria-label="Source {index}: {title}"` with popover details
  - Confidence badge → `aria-label="Confidence: {level}, {score} percent"`
  - Streaming — announce milestones via `aria-live="polite"` region
- Motion: every animation wrapped in `@media (prefers-reduced-motion: reduce)` disable
- Forms: label + description + error all wired with `aria-describedby`
- Locale switching does not trigger full reload (preserve conversation)

---

## 15. Performance & SEO

### Performance targets
- **LCP ≤ 2.0s** on broadband
- **INP ≤ 200ms**
- **CLS ≤ 0.05**
- First answer token ≤ 1.5s after submit

### Techniques
- RSC for list/dashboard pages (streamed HTML)
- `<Suspense>` around streaming answer block
- Route prefetching via Next.js `<Link>`
- Image: all via `next/image` with explicit dimensions
- Fonts: `display: swap`, preload primary weights
- Code-split heavy dependencies (Recharts, react-markdown) via `next/dynamic`
- Virtualize History + Knowledge Base lists when >100 rows

### SEO
App is behind auth → noindex entirely. Only public = `/login` + marketing site (separate). Add structured `robots.txt` and auth-wall middleware.

---

## 16. Security & Compliance

Medical device RA is a regulated domain. Build with audit in mind from day 1.

- **Auth:** SSO-first (SAML / OIDC), MFA required, session timeout 30min idle
- **Authorization:** Org/project-scoped; enforce at DB query layer (RLS in Postgres if using Supabase)
- **PII/PHI:** this product handles neither; still log all data-access events
- **Audit trail:** every LLM call, every source access, every expert-review flag — immutable append-only `audit_logs` table, 7-year retention (per FDA expectations)
- **Data residency:** EU customers → EU-only hosting (Vercel EU, Supabase EU). Configurable per org.
- **LLM data handling:** Use Anthropic's **zero-data-retention** mode via enterprise API; never send customer internal SOPs to consumer endpoints
- **Input safety:** Zod-validated, rate-limited per user (e.g., 60 queries/hour), max 8k chars per question
- **Output safety:** system prompt enforces "never invent regulations"; post-processing verifies every citation corresponds to a real retrieved source — else strip or flag
- **Secrets:** env only; rotate quarterly; use Vercel Secrets / AWS Secrets Manager
- **Headers:** CSP strict (nonce-based), HSTS, X-Frame-Options DENY
- **Privacy policy & DPA:** draft with legal before launch; 21 CFR Part 11 electronic records considerations if used in GxP workflows

---

## 17. Testing Strategy

| Layer | Tool | Coverage target |
|---|---|---|
| Unit (utils, prompts, formatters) | Vitest | 80%+ |
| Component | Storybook + Vitest (with storybook-test) | All shared components |
| Integration (API routes) | Vitest + msw | All route handlers |
| E2E | Playwright | Core flows: login, new consultation, citation click, expert review request, project switch |
| LLM eval | **promptfoo** or custom harness | Regression set of 50+ curated RA questions vs. expected citations/answers, run pre-release |
| Accessibility | Axe-core in Playwright | 0 violations on core pages |
| Visual regression | Playwright screenshots or Chromatic | All pages, both themes |

---

## 18. Deployment & DevOps

- **Environments:** `local → preview (per PR) → staging → production`
- **Branch strategy:** trunk-based, short-lived branches, PR-required
- **CI (GitHub Actions):**
  1. Install + cache
  2. Biome check
  3. Typecheck
  4. Vitest
  5. Playwright smoke
  6. Build
  7. Deploy preview (Vercel)
- **Migrations:** Drizzle Kit, manually reviewed, squashed per release
- **Feature flags:** Statsig or Vercel Flags — for gradual rollout of expert-review queue, new retrievers, etc.
- **Rollback:** Vercel instant rollback + DB forward-only migrations with `down` scripts kept for 1 week
- **Monitoring:** Sentry + Langfuse dashboard in ops chat; alert on error rate, LLM cost anomaly, expert-queue backlog

---

## 19. Suggested Additional Features

Beyond the 8 screens in the prototype, consider these for roadmap:

1. **Document diff viewer** — paste old/new regulation versions side-by-side with AI-summarized changes (huge for MDR transition work)
2. **Submission planner (Gantt)** — integrates timeline items across all active projects, dependencies, critical path
3. **Predicate device finder** — structured search of FDA 510(k) database with similarity-ranked matches (Jaccard on indication + technological characteristics)
4. **Regulatory Q&A drafts for NB audits** — upload audit question, get draft response with citations; "track changes" mode for human editor
5. **Email digest** — weekly personalized regulatory-update summary (Resend/Postmark)
6. **Slack / MS Teams integration** — `/regula <question>` in-channel, results posted with citations
7. **Browser extension** — highlight text on any page (e.g., competitor's 510(k)), send to Regula for analysis
8. **Multi-voice mode** — "Explain as if to an engineer" vs. "Explain as if to a regulator" — audience-controlled prose style
9. **Document templating with merge fields** — fill 510(k) cover sheet with project data automatically
10. **Confidence calibration ground truth loop** — every expert-review verdict feeds back as a training signal
11. **Public regulator-comparison pages** — `/compare/eu-mdr-vs-fda-510k` as SEO marketing content (separate marketing site)
12. **Webhook / API for internal RIM systems** — for large customers who want to ingest Regula answers into their Regulatory Information Management
13. **Voice mode** — Whisper + streamed TTS for hands-free use during lab/desk review sessions
14. **Smart draft mode** — user writes a document; Regula inline-suggests regulatory references at the caret position
15. **Saved views + alerts** — e.g., "notify me when any MDCG document mentions 'AI SaMD'"

---

## 20. Implementation Roadmap

Rough sequencing (assumes 2 full-stack engineers):

**Phase 1 — Foundation (2–3 weeks)**
- Next.js project, Tailwind token mapping, Auth.js SSO, Drizzle schema, RSC shell layout (Sidebar + Topbar), Home + empty Chat

**Phase 2 — Chat core (3–4 weeks)**
- Composer, streaming hook, Thinking, AnswerBlock (prose + citations + sources), DocViewer, minimal RAG pipeline wired to one corpus (FDA)

**Phase 3 — Structured outputs (2 weeks)**
- Checklist, ComparisonTable, Timeline, Suggested follow-ups, RightContextPanel

**Phase 4 — Breadth (3 weeks)**
- History, Templates, Knowledge Base, Regulatory Updates, Dashboard, Project switching

**Phase 5 — Enterprise hardening (3 weeks)**
- Expert review flow, audit logs, RBAC, dark mode polish, i18n, Accessibility audit, Sentry/Langfuse

**Phase 6 — Quality & launch (2 weeks)**
- LLM eval harness + regression set, Playwright e2e, load test, security review, docs/support

**Total: ~15 weeks to production-quality MVP.**

---

## 21. Files in this Handoff

```
design_handoff_regula/
├── README.md                                 ← THIS FILE
├── design_files/
│   ├── Regula RA System.html                ← Open in browser to see prototype
│   ├── styles/
│   │   ├── tokens.css                       ← Design tokens (source of truth)
│   │   └── components.css                   ← Prototype component styles
│   └── src/
│       ├── App.jsx
│       ├── Icon.jsx
│       ├── Modals.jsx                       ← Onboarding + Tweaks
│       ├── Shell.jsx                        ← Sidebar + Topbar
│       ├── data.jsx                         ← Seed data (realistic examples)
│       └── views/
│           ├── ChatView.jsx                 ← Core chat/answer view
│           ├── HomeView.jsx
│           └── OtherViews.jsx               ← History, Templates, Updates, Dashboard, Sources, DocViewer
└── screenshots/
    ├── 01-home.png
    ├── 02-chat-answer.png
    ├── 03-dashboard.png
    ├── 04-templates.png
    ├── 05-updates.png
    ├── 06-history.png
    ├── 07-knowledge-base.png
    └── 08-dark-mode.png
```

---

## Getting Started with Claude Code

Once you've unzipped this handoff into your local machine:

```bash
cd design_handoff_regula
# Open the prototype to see it live
open "design_files/Regula RA System.html"
# Or serve it locally if your browser blocks file:// for CORS
npx serve design_files
```

Then, in your target project directory (create new or existing):

```bash
cd /path/to/your/project
claude
```

And prompt Claude Code:

> Please read `../design_handoff_regula/README.md` carefully, then set up a new Next.js 15 project with the recommended stack. Start with Phase 1 of the implementation roadmap: project scaffolding, Tailwind + tokens mapping, Auth.js skeleton, Drizzle schema, and the shell layout (Sidebar + Topbar) matching the prototype. Before writing code, confirm the folder structure and stack choices with me.

Claude Code will handle the rest iteratively. Keep the handoff folder alongside your project so it's readable at any time.

---

*Prepared from design session on 2026-04-22. Questions about design intent or missing specs? Re-open the prototype in the `design_files/` folder — it is the source of truth for any visual detail not captured here.*
